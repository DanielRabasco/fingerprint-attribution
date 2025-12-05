// /api/open.js
import { createClient } from '@supabase/supabase-js';

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const allowedOrigins = [
  'https://fingerprint-project-theta.vercel.app',
  'http://localhost',
  'http://localhost:3000',
  'http://localhost:4200',
];

// Helper CORS
function setupCors(req, res) {
  const origin = req.headers.origin;

  if (origin && (allowedOrigins.includes(origin) || origin.startsWith('http://localhost'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

  // Payload desde el frontend (fingerprint-based)
  const {
    fpId,                // 👈 fingerprintjs visitorId (OBLIGATORIO para atribución)
    language,
    timezone,
    userAgent,           // opcional, si lo mandas desde el front
    screen,              // opcional: { innerW, innerH, screenW, screenH, dpr }
    deviceId,            // opcional
    token,               // opcional: por si quieres arrastrar el token de la landing
  } = req.body || {};

  if (!fpId) {
    return res.status(400).json({ error: 'missing_fingerprint' });
  }

  // 1) Buscar el último click_event con ese fingerprint
  const { data: clickEvents, error: clickError } = await supa
    .from('click_events')
    .select('*')
    .eq('fp_id', fpId)
    .order('ts', { ascending: false })
    .limit(1);

  if (clickError) {
    console.error('[api/open] Error fetching click_events', clickError);
    return res.status(500).json({ error: 'click_lookup_failed' });
  }

  const click = clickEvents?.[0] || null;

  // 2) Lógica de match: mismo fingerprint + < 5 minutos
  let matched = false;

  if (click && click.ts) {
    const deltaSeconds = (Date.now() - new Date(click.ts).getTime()) / 1000;
    if (deltaSeconds < 300) {
      matched = true;
    }
  }

  // 3) Insert en app_opens (solo columnas que existen en tu tabla)
  const { error: insertError } = await supa.from('app_opens').insert({
    event_token: click?.event_token || token || null,                 // arrastras el token si existe
    device_id: deviceId || null,
    ip,
    user_agent: userAgent || userAgentHeader,
    language: language || click?.language || null,
    timezone: timezone || click?.timezone || null,
    fp_id: fpId,
    // ts lo pone el DEFAULT now()
  });

  if (insertError) {
    console.error('[api/open] Error inserting app_open', insertError);
    return res.status(500).json({
      error: 'insert_failed',
    });
  }

  return res.status(200).json({ match: matched });
}
