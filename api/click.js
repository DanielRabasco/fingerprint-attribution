import { createClient } from '@supabase/supabase-js';

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res){
  if(req.method!=='POST') return res.status(405).end();
  const { nanoid } = await import('nanoid');
  const ip = (req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0];
  const { payload } = req.body || {};
  const token = nanoid(10);

  await supa.from('clicks').insert({
    token, campaign: 'android', ip,
    ua_http: req.headers['user-agent'],
    ua_js: payload?.ua_js,
    language: payload?.language,
    timezone: payload?.timezone,
    inner_w: payload?.innerW,
    inner_h: payload?.innerH,
    screen_w: payload?.screenW,
    screen_h: payload?.screenH,
    dpr: payload?.dpr,
    fp_id: payload?.fp_id,
    ts_click: new Date(payload?.ts_click).toISOString()
  });

  res.json({ token });
}
