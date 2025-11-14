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

export async function listChecklists(userId) {
  const client = getClient();
  if (!client) return [];
  if (!userId) return [];
  const { data } = await client
    .from('checklists')
    .select('id,nome,created_at,updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function getChecklist(id, userId) {
  const client = getClient();
  if (!client) return null;
  if (!userId) return null;
  const { data } = await client
    .from('checklists')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  return data || null;
}

export async function saveChecklist(data, userId) {
  const client = getClient();
  if (!client) throw new Error('Supabase não configurado');
  const nowISO = new Date().toISOString();
  const payload = {
    user_id: userId || null,
    created_at: nowISO,
    updated_at: nowISO,
    nome: data.nome || '',
    ruaNumero: data.ruaNumero || '',
    locClienteLink: data.locClienteLink || '',
    locCtoLink: data.locCtoLink || '',
    fotocto: data.fotoCto || null,
    fotoctodatauri: data.fotoCtoDataUri || null,
    corfibra: data.corFibra || '',
    possuisplitter: toIntBool(data.possuiSplitter),
    portaCliente: data.portaCliente || '',
    locCasaLink: data.locCasaLink || '',
    fotofrentecasa: data.fotoFrenteCasa || null,
    fotofrentecasadatauri: data.fotoFrenteCasaDataUri || null,
    fotoinstalacao: data.fotoInstalacao || null,
    fotoinstalacaodatauri: data.fotoInstalacaoDataUri || null,
    fotomacequip: data.fotoMacEquip || null,
    fotomacequipdatauri: data.fotoMacEquipDataUri || null,
    nomewifi: data.nomeWifi || '',
    senhawifi: data.senhaWifi || '',
    testenavegacaook: toIntBool(data.testeNavegacaoOk),
    clientesatisfeito: toIntBool(data.clienteSatisfeito),
  };
  const { data: inserted, error } = await client
    .from('checklists')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw error;
  return inserted?.id;
}

export async function updateChecklist(id, data, userId) {
  const client = getClient();
  if (!client) throw new Error('Supabase não configurado');
  if (!userId) throw new Error('Usuário inválido');
  const nowISO = new Date().toISOString();
  const payload = {
    updated_at: nowISO,
    nome: data.nome || '',
    ruaNumero: data.ruaNumero || '',
    locClienteLink: data.locClienteLink || '',
    locCtoLink: data.locCtoLink || '',
    fotocto: data.fotoCto || null,
    fotoctodatauri: data.fotoCtoDataUri || null,
    corfibra: data.corFibra || '',
    possuisplitter: toIntBool(data.possuiSplitter),
    portaCliente: data.portaCliente || '',
    locCasaLink: data.locCasaLink || '',
    fotofrentecasa: data.fotoFrenteCasa || null,
    fotofrentecasadatauri: data.fotoFrenteCasaDataUri || null,
    fotoinstalacao: data.fotoInstalacao || null,
    fotoinstalacaodatauri: data.fotoInstalacaoDataUri || null,
    fotomacequip: data.fotoMacEquip || null,
    fotomacequipdatauri: data.fotoMacEquipDataUri || null,
    nomewifi: data.nomeWifi || '',
    senhawifi: data.senhaWifi || '',
    testenavegacaook: toIntBool(data.testeNavegacaoOk),
    clientesatisfeito: toIntBool(data.clienteSatisfeito),
  };
  const { error } = await client
    .from('checklists')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
  return true;
}

export async function deleteChecklist(id, userId) {
  const client = getClient();
  if (!client) throw new Error('Supabase não configurado');
  if (!userId) throw new Error('Usuário inválido');
  await client
    .from('checklists')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
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

export async function updateProfile(userId, { firstName, lastName, phone }) {
  const client = getClient();
  if (!client) throw new Error('Supabase não configurado');
  await client
    .from('users')
    .upsert({
      id: userId,
      first_name: firstName ?? '',
      last_name: lastName ?? '',
      phone: phone ?? '',
    });
  return true;
}

export async function updateAuth({ email, password, firstName, lastName, phone }) {
  const client = getClient();
  if (!client) throw new Error('Supabase não configurado');
  const data = {
    ...(email ? { email } : {}),
    ...(password ? { password } : {}),
    data: {
      ...(firstName ? { first_name: firstName } : {}),
      ...(lastName ? { last_name: lastName } : {}),
      ...(phone ? { phone } : {}),
      display_name: `${(firstName || '').trim()} ${(lastName || '').trim()}`.trim() || null,
    },
  };
  await client.auth.updateUser(data);
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
