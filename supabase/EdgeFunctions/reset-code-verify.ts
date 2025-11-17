/*
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';
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
  const id = String(payload?.id || '').trim();
  const email = String(payload?.email || '').trim().toLowerCase();
  const code = String(payload?.code || '').replace(/\D+/g, '').trim();
  if (!id && (!email || !code || code.length !== 6)) {
    return new Response(JSON.stringify({
      valid: false,
      reason: 'bad_request'
    }), {
      status: 200,
      headers: corsHeaders
    });
  }
  const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  // Busca do registro
  let rec = null;
  if (id) {
    const { data, error } = await supabase.from('password_reset_codes').select('id, email, code, expires_at, used_at, created_at').eq('id', id).maybeSingle();
    if (error) return new Response(JSON.stringify({
      valid: false,
      reason: 'db_error'
    }), {
      status: 200,
      headers: corsHeaders
    });
    rec = data;
    // Se veio id mas também enviou email/code, conferimos consistência
    if (rec && email && rec.email?.toLowerCase() !== email) {
      return new Response(JSON.stringify({
        valid: false,
        reason: 'email_mismatch'
      }), {
        status: 200,
        headers: corsHeaders
      });
    }
    if (rec && code && String(rec.code || '').trim() !== code) {
      return new Response(JSON.stringify({
        valid: false,
        reason: 'code_mismatch'
      }), {
        status: 200,
        headers: corsHeaders
      });
    }
  } else {
    const { data, error } = await supabase.from('password_reset_codes').select('id, email, code, expires_at, used_at, created_at').eq('email', email).eq('code', code).order('created_at', {
      ascending: false
    }).limit(1).maybeSingle();
    if (error) return new Response(JSON.stringify({
      valid: false,
      reason: 'db_error'
    }), {
      status: 200,
      headers: corsHeaders
    });
    rec = data;
  }
  // Regras de validação
  if (!rec) return new Response(JSON.stringify({
    valid: false,
    reason: 'not_found'
  }), {
    status: 200,
    headers: corsHeaders
  });
  if (rec.used_at) return new Response(JSON.stringify({
    valid: false,
    reason: 'used'
  }), {
    status: 200,
    headers: corsHeaders
  });
  if (new Date(rec.expires_at).getTime() < Date.now()) return new Response(JSON.stringify({
    valid: false,
    reason: 'expired'
  }), {
    status: 200,
    headers: corsHeaders
  });
  // OK
  return new Response(JSON.stringify({
    valid: true
  }), {
    status: 200,
    headers: corsHeaders
  });
});
*/