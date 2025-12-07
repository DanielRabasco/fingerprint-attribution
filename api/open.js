// /api/open.js
import { createClient } from '@supabase/supabase-js';

const supa = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const allowedOrigins = [
  'https://fingerprint-project-theta.vercel.app', // producción
];

function setupCors(req, res) {
  const origin = req.headers.origin;

  const isLocalhost =
    origin &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  const isAllowedExplicitly =
    origin && allowedOrigins.includes(origin);

  if (origin && (isLocalhost || isAllowedExplicitly)) {
    // Refleja exactamente el origin permitido
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Requested-With, Accept'
  );
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export default async function handler(req, res) {
  setupCors(req, res);

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // IP y user-agent
  const rawIp =
    req.headers['x-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    '';
  const ip = String(rawIp).split(',')[0].trim() || null;
  const userAgentHeader = req.headers['user-agent'] || null;

  const body = req.body || {};

  const fpId =
    body.fpId ||
    body.fp_id ||
    body?.payload?.fpId ||
    body?.payload?.fp_id ||
    null;

  const language =
    body.language ||
    body?.payload?.language ||
    null;

  const timezone =
    body.timezone ||
    body?.payload?.timezone ||
    null;

  const userAgent =
    body.userAgent ||
    body?.payload?.userAgent ||
    body?.payload?.ua_js ||
    userAgentHeader;

  const deviceId =
    body.deviceId ||
    body?.payload?.deviceId ||
    null;

  const token =
    body.token ||
    body?.payload?.token ||
    null;

  if (!fpId) {
    console.error('[api/open] missing_fingerprint. Body recibido:', JSON.stringify(body));
    return res.status(400).json({ error: 'missing_fingerprint' });
  }

  console.log('[api/open] fpId recibido:', fpId, 'ip recibida:', ip);

  // 1) Buscar el último click_event con ese fingerprint + IP
  let clickQuery = supa
    .from('click_events')
    .select('*')
    .eq('fp_id', fpId);

  // Si tenemos IP, la usamos también para el match
  if (ip) {
    clickQuery = clickQuery.eq('ip', ip);
  }

  const { data: clickEvents, error: clickError } = await clickQuery
    .order('ts', { ascending: false })
    .limit(1);

  console.log('[api/open] clickEvents devueltos por Supabase:', clickEvents);

  if (clickError) {
    console.error('[api/open] Error fetching click_events', clickError);
    return res.status(500).json({ error: 'click_lookup_failed' });
  }

  const click = clickEvents?.[0] || null;

  // 2) Match por fingerprint + IP + tiempo
  let matched = false;
  let deltaSeconds = null;

  if (click && click.ts) {
    deltaSeconds = (Date.now() - new Date(click.ts).getTime()) / 1000;
    if (deltaSeconds < 60) {
      matched = true;
    }
  }

  console.log(
    '[api/open]',
    'fpId:', fpId,
    'ip:', ip,
    'click_found:', !!click,
    'deltaSeconds:', deltaSeconds,
    'matched:', matched
  );

  // 3) Insert en app_opens
  const { error: insertError } = await supa.from('app_opens').insert({
    event_token: click?.event_token || token || null,
    device_id: deviceId,
    ip,
    user_agent: userAgent,
    language: language || click?.language || null,
    timezone: timezone || click?.timezone || null,
    fp_id: fpId,
  });

  if (insertError) {
    console.error('[api/open] Error inserting app_open', insertError);
    return res.status(500).json({ error: 'insert_failed' });
  }

  return res.status(200).json({
    match: matched,
    debug: {
      clickFound: !!click,
      deltaSeconds,
      usedIp: ip,
    },
  });
}
