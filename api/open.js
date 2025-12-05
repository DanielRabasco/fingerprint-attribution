import { createClient } from '@supabase/supabase-js';
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Dominios permitidos para llamar a esta API
const allowedOrigins = [
  'https://fingerprint-project-theta.vercel.app',
  'http://localhost:3000',
  'http://localhost:4200',
  'http://localhost'
];

export default async function handler(req, res) {
  const origin = req.headers.origin;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Responder al preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).end();

  const rawIp =
    req.headers['x-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    '';
  const ip = String(rawIp).split(',')[0].trim();

  const { token, model, os, language, timezone, screenW, screenH, dpr } = req.body;

  // get click by token
  const { data: clicks, error: clicksError } = await supa
    .from('click_events')
    .select('*')
    .eq('event_token', token)
    .limit(1);

  if (clicksError) {
    console.error('Error fetching clicks', clicksError);
    return res.status(500).json({ error: 'click_lookup_failed' });
  }

  const click = clicks?.[0];

  // match logic simple: IP + token + time < 5min
  let matched = false;
  if (click) {
    const delta = (Date.now() - new Date(click.ts_click).getTime()) / 1000;
    if (delta < 300 && click.ip === ip) matched = true;
  }

  const { error: insertError } = await supa.from('app_opens').insert({
    token,
    ip,
    model,
    os,
    locale: language,
    timezone,
    screen_w: screenW,
    screen_h: screenH,
    dpr,
    ts_open: new Date().toISOString(),
   // matched_click_id: matched ? click.id : null,
  });

  if (insertError) {
    console.error('Error inserting app_open', insertError);
    return res.status(500).json({ error: 'insert_failed' });
  }

  return res.json({ match: matched });
}
