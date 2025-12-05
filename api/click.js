// /api/click.js
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

module.exports = async (req, res) => {
  console.log('[api/click] start');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('[api/click] Missing env vars SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    return res.status(500).json({ error: 'missing_env' });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { campaign, payload } = req.body || {};
    console.log('[api/click] body:', { campaign, payload_exists: !!payload });

    // token único que luego puedes usar como event_token / en la intent URL
    const token = randomUUID();

    // IP desde los headers de Vercel
    const ip =
      (req.headers['x-forwarded-for'] || '')
        .toString()
        .split(',')[0]
        .trim() ||
      req.socket?.remoteAddress ||
      null;

    // Fingerprint: aceptamos tanto fp_id como fpId por si cambias el front
    const fp_id = payload?.fp_id || payload?.fpId || null;

    const userAgent = payload?.ua_js || req.headers['user-agent'] || null;
    const language = payload?.language || null;
    const timezone = payload?.timezone || null;

    // Montamos un resumen de pantalla en un string (la columna es text)
    let screen = null;
    if (payload) {
      const innerW = payload.innerW ?? null;
      const innerH = payload.innerH ?? null;
      const screenW = payload.screenW ?? null;
      const screenH = payload.screenH ?? null;
      const dpr = payload.dpr ?? null;
      screen = JSON.stringify({ innerW, innerH, screenW, screenH, dpr });
    }

    // Timestamp del click si viene en el payload; si no, usamos default now() de la tabla
    let ts = null;
    if (payload?.ts_click) {
      ts = new Date(payload.ts_click).toISOString(); // ms → ISO
    }

    const { data, error } = await supabase
      .from('click_events')
      .insert({
        event_token: token,
        ip,
        user_agent: userAgent,
        language,
        timezone,
        screen,
        ts,
        fp_id,
      })
      .select('*');

    if (error) {
      console.error('[api/click] Supabase insert ERROR:', error);
      return res
        .status(500)
        .json({ error: 'supabase_insert_failed', details: error.message });
    }

    console.log('[api/click] Supabase insert OK. Row:', data && data[0]);

    // devolvemos el token por si lo quieres usar en URLs, pero el match real lo hace fp_id
    return res.status(200).json({ token });
  } catch (e) {
    console.error('[api/click] UNCAUGHT ERROR:', e);
    return res.status(500).json({ error: 'server_error' });
  }
};
