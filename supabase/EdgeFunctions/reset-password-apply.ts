/*
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
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
  const email = (payload?.email || '').trim();
  const code = String(payload?.code || '').trim();
  const newPassword = String(payload?.newPassword || '');
  if (!email || !code || !newPassword) return new Response(JSON.stringify({
    error: 'payload'
  }), {
    status: 400,
    headers: corsHeaders
  });
  const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  const { data, error } = await supabase.from('password_reset_codes').select('id,expires_at,used_at').eq('email', email).eq('code', code).order('created_at', {
    ascending: false
  }).limit(1).maybeSingle();
  if (error || !data) return new Response(JSON.stringify({
    error: 'code'
  }), {
    status: 400,
    headers: corsHeaders
  });
  if (data.used_at) return new Response(JSON.stringify({
    error: 'used'
  }), {
    status: 400,
    headers: corsHeaders
  });
  if (new Date(data.expires_at).getTime() < Date.now()) return new Response(JSON.stringify({
    error: 'expired'
  }), {
    status: 400,
    headers: corsHeaders
  });
  const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  let targetUserId = null;
  let page = 1;
  for(;;){
    const res = await admin.auth.admin.listUsers({
      page,
      perPage: 200
    });
    const found = (res?.data?.users || []).find((u)=>(u.email || '').toLowerCase() === email.toLowerCase());
    if (found) {
      targetUserId = found.id;
      break;
    }
    if (!res?.data?.users || res.data.users.length === 0) break;
    page += 1;
  }
  if (!targetUserId) return new Response(JSON.stringify({
    error: 'user'
  }), {
    status: 404,
    headers: corsHeaders
  });
  await admin.auth.admin.updateUserById(targetUserId, {
    password: newPassword
  });
  await supabase.from('password_reset_codes').update({
    used_at: new Date().toISOString()
  }).eq('id', data.id);
  return new Response(JSON.stringify({
    ok: true
  }), {
    status: 200,
    headers: corsHeaders
  });
});
*/