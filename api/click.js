// api/click.js (CommonJS en Vercel)
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

module.exports = async (req, res) => {
  console.log('[api/click] start');

  if (req.method !== 'POST') {
    console.log('[api/click] method not allowed:', req.method);
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // 👉 service_role, NO anon

  if (!supabaseUrl || !serviceKey) {
    console.error('[api/click] Missing env vars SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    return res.status(500).json({ error: 'missing_env' });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { campaign, payload } = req.body || {};
    console.log('[api/click] body:', { campaign, payload_exists: !!payload });

    const token = randomUUID();

    const { data, error } = await supabase
      .from('click_events')           // 👈 tu tabla
      .insert({
        campaign,
        payload,
        token,
        created_at: new Date().toISOString()
      })
      .select('*');

    if (error) {
      console.error('[api/click] Supabase insert ERROR:', error);
      return res.status(500).json({ error: 'supabase_insert_failed', details: error.message });
    }

    console.log('[api/click] Supabase insert OK. Row:', data && data[0]);

    return res.status(200).json({ token });
  } catch (e) {
    console.error('[api/click] UNCAUGHT ERROR:', e);
    return res.status(500).json({ error: 'server_error' });
  }
};
