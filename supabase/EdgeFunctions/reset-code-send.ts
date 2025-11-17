/*
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response('ok', {
    headers: corsHeaders
  });
  let payload = {};
  try {
    payload = await req.json();
  } catch  {}
  const email = String(payload?.email || '').trim();
  if (!email) return new Response(JSON.stringify({
    error: 'email'
  }), {
    status: 400,
    headers: corsHeaders
  });
  const sgKey = Deno.env.get('SENDGRID_API_KEY');
  const from = Deno.env.get('MAIL_FROM');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!sgKey || !from || !supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({
      error: 'env'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const supabase = createClient(supabaseUrl, serviceKey);
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const ins = await supabase.from('password_reset_codes').insert({
    email,
    code,
    expires_at: expires
  });
  if (ins.error) return new Response(JSON.stringify({
    error: ins.error.message
  }), {
    status: 500,
    headers: corsHeaders
  });
  const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sgKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [
            {
              email
            }
          ]
        }
      ],
      from: {
        email: from
      },
      subject: 'Código para recuperar senha',
      content: [
        {
          type: 'text/html',
          value: `<p>Seu código é <strong>${code}</strong>. Expira em 15 minutos.</p>`
        }
      ]
    })
  });
  if (!r.ok) {
    const err = await r.text().catch(()=>'');
    return new Response(JSON.stringify({
      error: err || 'email_error'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
  return new Response(JSON.stringify({
    ok: true
  }), {
    status: 200,
    headers: corsHeaders
  });
});
*/