import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { onlyDigits, formatPhoneBR } from './utils';

let supabase;
const normalizeUrl = (raw) => {
  const t = String(raw || '').trim();
  return /^https?:\/\//i.test(t) ? t : '';
};
const getClient = () => {
  const url = normalizeUrl(process.env.EXPO_PUBLIC_SUPABASE_URL);
  const key = String(process.env.EXPO_PUBLIC_SUPABASE_KEY || '').trim();
  if (!url || !key) return null;
  if (!supabase)
    supabase = createClient(url, key, {
      auth: {
        storage: Platform.OS === 'web' ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  return supabase;
};

export const isSupabaseReady = () => {
  const url = normalizeUrl(process.env.EXPO_PUBLIC_SUPABASE_URL);
  const key = String(process.env.EXPO_PUBLIC_SUPABASE_KEY || '').trim();
  return !!(url && key);
};

export async function initDB() {
  return Promise.resolve();
}

export async function getOrCreateUserId() {
  const client = getClient();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data?.user?.id || null;
}

export function onAuthStateChange(callback) {
  const client = getClient();
  if (!client || typeof callback !== 'function') return () => {};
  const { data: subscription } = client.auth.onAuthStateChange((event, session) => {
    try { callback(event, session); } catch {}
  });
  return () => {
    try { subscription?.unsubscribe?.(); } catch {}
  };
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

export async function getChecklistMeta(id, userId) {
  const client = getClient();
  if (!client) return null;
  if (!userId) return null;
  const { data } = await client
    .from('checklists')
    .select(
      'id,nome,ruanumero,locclientelink,locctolink,corfibra,possuisplitter,portacliente,loccasalink,nomewifi,senhawifi,testenavegacaook,clientesatisfeito,created_at,updated_at'
    )
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  return data || null;
}

export async function getChecklistImages(id, userId) {
  const client = getClient();
  if (!client) return null;
  if (!userId) return null;
  const { data } = await client
    .from('checklists')
    .select('fotoctodatauri,fotofrentecasadatauri,fotoinstalacaodatauri,fotomacequipdatauri')
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
    corfibra: data.corFibra || '',
    possuisplitter: toIntBool(data.possuiSplitter),
    portaCliente: data.portaCliente || '',
    locCasaLink: data.locCasaLink || '',
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
  const newId = inserted?.id;
  if (!newId) return null;
  const setColumn = async (col, value) => {
    if (!value) return;
    await client
      .from('checklists')
      .update({ [col]: value })
      .eq('id', newId)
      .eq('user_id', userId);
  };
  try {
    await setColumn('fotoctodatauri', data.fotoCtoDataUri || null);
    await setColumn('fotofrentecasadatauri', data.fotoFrenteCasaDataUri || null);
    await setColumn('fotoinstalacaodatauri', data.fotoInstalacaoDataUri || null);
    await setColumn('fotomacequipdatauri', data.fotoMacEquipDataUri || null);
  } catch {}
  return newId;
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
    corfibra: data.corFibra || '',
    possuisplitter: toIntBool(data.possuiSplitter),
    portaCliente: data.portaCliente || '',
    locCasaLink: data.locCasaLink || '',
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
  const setColumn = async (col, value) => {
    if (value == null) return;
    await client
      .from('checklists')
      .update({ [col]: value })
      .eq('id', id)
      .eq('user_id', userId);
  };
  try {
    await setColumn('fotoctodatauri', data.fotoCtoDataUri ?? null);
    await setColumn('fotofrentecasadatauri', data.fotoFrenteCasaDataUri ?? null);
    await setColumn('fotoinstalacaodatauri', data.fotoInstalacaoDataUri ?? null);
    await setColumn('fotomacequipdatauri', data.fotoMacEquipDataUri ?? null);
  } catch {}
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
  if (!client) return { user: null, error: 'Supabase não configurado' };
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    try { console.log('auth:signIn error', error?.message || String(error)); } catch {}
    return { user: null, error: error.message };
  }
  const user = data.user || null;
  if (user) {
    try {
      const { data: existing } = await client
        .from('users')
        .select('id,first_name,last_name,phone,cpf')
        .eq('id', user.id)
        .maybeSingle();
      const md = user.user_metadata || {};
      const payload = {
        id: user.id,
        first_name: (md.first_name ?? existing?.first_name ?? '') || '',
        last_name: (md.last_name ?? existing?.last_name ?? '') || '',
        phone: formatPhoneBR(md.phone ?? existing?.phone ?? ''),
        cpf: onlyDigits(md.cpf ?? existing?.cpf ?? '') || null,
      };
      await client.from('users').upsert(payload);
    } catch {}
  }
  return { user };
}

export async function signUp({ email, password, firstName, lastName, phone, cpf }) {
  const client = getClient();
  if (!client) return { user: null, session: null, error: 'Supabase não configurado' };
  const cpfDigits = onlyDigits(cpf);
  const phoneFmt = formatPhoneBR(phone);
  const redirectTo = Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined;
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        first_name: firstName || null,
        last_name: lastName || null,
        phone: phoneFmt || null,
        cpf: cpfDigits || null,
        display_name: `${(firstName || '').trim()} ${(lastName || '').trim()}`.trim() || null,
      },
    },
  });
  if (error) return { user: null, session: null, error: error?.message || 'Falha ao cadastrar' };
  if (!data?.session && email && password) {
    try {
      const r = await client.auth.signInWithPassword({ email, password });
      if (r?.error) {
        return { user: data?.user || null, session: null, error: r.error.message };
      }
    } catch (e) {
      return { user: data?.user || null, session: null, error: 'Confirmação de e‑mail necessária' };
    }
  }
  const curr = await client.auth.getUser();
  const sessionRes = await client.auth.getSession();
  const session = sessionRes?.data?.session || null;
  const userId = curr?.data?.user?.id || data?.user?.id;
  if (userId && session) {
    try {
      const { error: upErr } = await client
        .from('users')
        .upsert({
          id: userId,
          first_name: firstName || '',
          last_name: lastName || '',
          phone: phoneFmt || '',
          cpf: cpfDigits || null,
        });
      if (upErr) return { user: data?.user || null, session, error: upErr.message };
    } catch (e) {
      return { user: data?.user || null, session, error: 'Falha ao salvar perfil' };
    }
  }
  const out = await client.auth.getUser();
  return { user: out?.data?.user || data?.user || null, session, error: null };
}

export async function signOut() {
  const client = getClient();
  if (!client) return true;
  await client.auth.signOut();
  return true;
}

export async function updateProfile(userId, { firstName, lastName, phone, cpf }) {
  const client = getClient();
  if (!client) throw new Error('Supabase não configurado');
  const { error } = await client
    .from('users')
    .upsert({
      id: userId,
      first_name: firstName ?? '',
      last_name: lastName ?? '',
      phone: formatPhoneBR(phone ?? ''),
      cpf: onlyDigits(cpf ?? '') || null,
    });
  if (error) throw new Error(error.message);
  return true;
}

export async function updateAuth({ email, password, firstName, lastName, phone, cpf }) {
  const client = getClient();
  if (!client) throw new Error('Supabase não configurado');
  const cpfDigits = onlyDigits(cpf);
  const phoneFmt = formatPhoneBR(phone);
  const data = {
    ...(email ? { email } : {}),
    ...(password ? { password } : {}),
    data: {
      ...(firstName ? { first_name: firstName } : {}),
      ...(lastName ? { last_name: lastName } : {}),
      ...(phoneFmt ? { phone: phoneFmt } : {}),
      ...(cpfDigits ? { cpf: cpfDigits } : {}),
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
    .select('first_name,last_name,phone,cpf')
    .eq('id', userId)
    .maybeSingle();
  return data || null;
}

export async function findUserByCpf(cpf) {
  const client = getClient();
  if (!client) return null;
  const digits = (cpf || '').replace(/\D+/g, '');
  if (!digits) return null;
  const { data } = await client
    .from('users')
    .select('id')
    .eq('cpf', digits)
    .maybeSingle();
  return data || null;
}