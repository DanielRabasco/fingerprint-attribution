import { createClient } from '@supabase/supabase-js';
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const rawIp =
    req.headers['x-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    '';
  const ip = String(rawIp).split(',')[0].trim();

  // 👇 Recibimos EXACTAMENTE el mismo payload que en el click
  const { payload, model, os, screenW, screenH, dpr } = req.body || {};
  const fp_id = payload?.fp_id || null;
  const language = payload?.language || null;
  const timezone = payload?.timezone || null;

  if (!fp_id) {
    console.log('[api/open] NO FP_ID → no match');
    return res.json({ match: false });
  }

  // Buscar el click más reciente de ese fingerprint
  const { data: clicks, error: clicksError } = await supa
    .from('click_events')
    .select('*')
    .eq('fp_id', fp_id)
    .order('ts', { ascending: false })
    .limit(1);

  if (clicksError) {
    console.error('Error fetching click by fp_id', clicksError);
    return res.status(500).json({ error: 'click_lookup_failed' });
  }

  const click = clicks?.[0];

  let matched = false;

  if (click) {
    const clickTs = click.ts ? new Date(click.ts).getTime() : 0;
    const deltaSeconds = (Date.now() - clickTs) / 1000;

    if (deltaSeconds < 300) {
      matched = true;
    }
  }

  // Inserta el open
  const { error: insertError } = await supa.from('app_opens').insert({
    fp_id,
    ip,
    model,
    os,
    locale: language,
    timezone,
    screen_w: screenW,
    screen_h: screenH,
    dpr,
    ts: new Date().toISOString(),
    matched_click_id: matched && click ? click.id : null,
    match_score: matched ? 100 : 0,
  });

  if (insertError) {
    console.error('Error inserting app_open', insertError);
    return res.status(500).json({ error: 'insert_failed' });
  }

  return res.json({ match: matched });
}
