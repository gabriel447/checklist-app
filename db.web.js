import { createClient } from '@supabase/supabase-js';

let supabase;
const getClient = () => {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;
  if (!url || !key) return null;
  if (!supabase) supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
  return supabase;
};

export const isSupabaseReady = () =>
  !!(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_KEY);

export function initDB() {
  return Promise.resolve();
}

export async function getOrCreateUserId() {
  const client = getClient();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data?.user?.id || null;
}

export async function setUserId() {
  return true;
}

const toIntBool = (v) => (v === true ? 1 : v === false ? 0 : null);

export async function listChecklists() {
  const client = getClient();
  if (!client) return [];
  const { data } = await client
    .from('checklists')
    .select('id,nome,created_at,updated_at')
    .order('created_at', { ascending: false });
  return data || [];
}

export async function getChecklist(id) {
  const client = getClient();
  if (!client) return null;
  const { data } = await client.from('checklists').select('*').eq('id', id).maybeSingle();
  return data || null;
}

export async function saveChecklist(data, userId) {
  const client = getClient();
  if (!client) throw new Error('Supabase não configurado');
  const nowISO = new Date().toISOString();
  const payload = {
    user_id: userId,
    created_at: nowISO,
    updated_at: nowISO,
    nome: data.nome || '',
    ruaNumero: data.ruaNumero || '',
    locClienteLink: data.locClienteLink || '',
    locCtoLink: data.locCtoLink || '',
    fotoCto: data.fotoCto || null,
    fotoCtoDataUri: data.fotoCtoDataUri || null,
    corFibra: data.corFibra || '',
    possuiSplitter: toIntBool(data.possuiSplitter),
    portaCliente: data.portaCliente || '',
    locCasaLink: data.locCasaLink || '',
    fotoFrenteCasa: data.fotoFrenteCasa || null,
    fotoFrenteCasaDataUri: data.fotoFrenteCasaDataUri || null,
    fotoInstalacao: data.fotoInstalacao || null,
    fotoInstalacaoDataUri: data.fotoInstalacaoDataUri || null,
    fotoMacEquip: data.fotoMacEquip || null,
    fotoMacEquipDataUri: data.fotoMacEquipDataUri || null,
    nomeWifi: data.nomeWifi || '',
    senhaWifi: data.senhaWifi || '',
    testeNavegacaoOk: toIntBool(data.testeNavegacaoOk),
    clienteSatisfeito: toIntBool(data.clienteSatisfeito),
  };
  const { data: inserted } = await client
    .from('checklists')
    .insert(payload)
    .select('id')
    .single();
  return inserted?.id;
}

export async function updateChecklist(id, data) {
  const client = getClient();
  if (!client) throw new Error('Supabase não configurado');
  const nowISO = new Date().toISOString();
  const payload = {
    updated_at: nowISO,
    nome: data.nome || '',
    ruaNumero: data.ruaNumero || '',
    locClienteLink: data.locClienteLink || '',
    locCtoLink: data.locCtoLink || '',
    fotoCto: data.fotoCto || null,
    fotoCtoDataUri: data.fotoCtoDataUri || null,
    corFibra: data.corFibra || '',
    possuiSplitter: toIntBool(data.possuiSplitter),
    portaCliente: data.portaCliente || '',
    locCasaLink: data.locCasaLink || '',
    fotoFrenteCasa: data.fotoFrenteCasa || null,
    fotoFrenteCasaDataUri: data.fotoFrenteCasaDataUri || null,
    fotoInstalacao: data.fotoInstalacao || null,
    fotoInstalacaoDataUri: data.fotoInstalacaoDataUri || null,
    fotoMacEquip: data.fotoMacEquip || null,
    fotoMacEquipDataUri: data.fotoMacEquipDataUri || null,
    nomeWifi: data.nomeWifi || '',
    senhaWifi: data.senhaWifi || '',
    testeNavegacaoOk: toIntBool(data.testeNavegacaoOk),
    clienteSatisfeito: toIntBool(data.clienteSatisfeito),
  };
  await client.from('checklists').update(payload).eq('id', id);
  return true;
}

export async function deleteChecklist(id) {
  const client = getClient();
  if (!client) throw new Error('Supabase não configurado');
  await client.from('checklists').delete().eq('id', id);
  return true;
}

export async function getCurrentUser() {
  const client = getClient();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data?.user || null;
}

export async function signIn({ email, password }) {
  const client = getClient();
  if (!client) throw new Error('Supabase não configurado');
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) return null;
  const user = data.user || null;
  if (user) {
    try {
      const { data: existing } = await client
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      if (!existing) {
        const md = user.user_metadata || {};
        await client
          .from('users')
          .upsert({
            id: user.id,
            first_name: md.first_name || '',
            last_name: md.last_name || '',
            phone: md.phone || '',
          });
      }
    } catch {}
  }
  return user;
}

export async function signUp({ email, password, firstName, lastName, phone }) {
  const client = getClient();
  if (!client) return { user: null, session: null };
  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined;
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        first_name: firstName || null,
        last_name: lastName || null,
        phone: phone || null,
        display_name: `${(firstName || '').trim()} ${(lastName || '').trim()}`.trim() || null,
      },
    },
  });
  if (error) return { user: null, session: null };
  if (!data?.session && email && password) {
    try {
      await client.auth.signInWithPassword({ email, password });
    } catch {}
  }
  const curr = await client.auth.getUser();
  const sessionRes = await client.auth.getSession();
  const session = sessionRes?.data?.session || null;
  const userId = curr?.data?.user?.id || data?.user?.id;
  if (userId && session) {
    try {
      await client
        .from('users')
        .upsert({
          id: userId,
          first_name: firstName || '',
          last_name: lastName || '',
          phone: phone || '',
        });
    } catch {}
  }
  const out = await client.auth.getUser();
  return { user: out?.data?.user || data?.user || null, session };
}

export async function signOut() {
  const client = getClient();
  if (!client) return true;
  await client.auth.signOut();
  return true;
}

export async function getProfile(userId) {
  const client = getClient();
  if (!client) return null;
  const { data } = await client
    .from('users')
    .select('first_name,last_name,phone')
    .eq('id', userId)
    .maybeSingle();
  return data || null;
}
