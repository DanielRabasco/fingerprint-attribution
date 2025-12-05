import { createClient } from '@supabase/supabase-js';
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).end();
  const ip = (req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0];
  const { token, model, os, language, timezone, screenW, screenH, dpr } = req.body;

  // get click by token
  const { data: clicks } = await supa.from('clicks').select('*').eq('token',token).limit(1);
  const click = clicks?.[0];

  // match logic simple: IP + token + time < 5min
  let matched = false;
  if(click){
    const delta = (Date.now() - new Date(click.ts_click).getTime())/1000;
    if(delta<300 && click.ip===ip) matched=true;
  }

  await supa.from('app_opens').insert({
    token, ip, model, os, locale: language, timezone, screen_w: screenW,
    screen_h: screenH, dpr, ts_open: new Date().toISOString(),
    matched_click_id: matched?click.id:null, match_score: matched?100:0
  });

  res.json({ match: matched });
}
