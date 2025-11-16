import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Image,
  Pressable,
  Alert,
  Modal,
  Platform,
  Animated,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Print from 'expo-print';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import { shareAsync } from 'expo-sharing';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
  import {
    initDB,
    listChecklists,
    getChecklist,
    saveChecklist,
    updateChecklist,
    deleteChecklist,
    setUserId,
    getCurrentUser,
    signIn,
    signUp,
    signOut,
    getProfile,
    isSupabaseReady,
    updateProfile,
    updateAuth,
    findUserByCpf,
    onAuthStateChange,
  } from './db.mobile';

const makeInitialForm = () => ({
  nome: '',
  ruaNumero: '',
  locClienteLink: '',
  locCtoLink: '',
  fotoCto: null,
  fotoCtoDataUri: null,
  corFibra: '',
  possuiSplitter: null,
  portaCliente: '',
  locCasaLink: '',
  fotoFrenteCasa: null,
  fotoFrenteCasaDataUri: null,
  fotoInstalacao: null,
  fotoInstalacaoDataUri: null,
  fotoMacEquip: null,
  fotoMacEquipDataUri: null,
  nomeWifi: '',
  senhaWifi: '',
  testeNavegacaoOk: null,
  clienteSatisfeito: null,
});

const toTitleCase = (s) => {
  if (!s) return '';
  return s
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ');
};
const formatPhoneBR = (s) => {
  const d = (s || '').replace(/\D+/g, '');
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7,11)}`;
};

const parseMapsLink = (s) => {
  const t = String(s || '').trim();
  if (!t) return null;
  let m = t.match(/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (m) return { lat: Number(m[1]), lng: Number(m[2]) };
  m = t.match(/[?&]q=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
  if (m) return { lat: Number(m[1]), lng: Number(m[2]) };
  const nums = t.match(/-?\d+\.\d+/g) || [];
  const cand = nums.map(Number).filter((n) => !Number.isNaN(n));
  for (let i = 0; i < cand.length - 1; i++) {
    const a = cand[i], b = cand[i + 1];
    if (a >= -90 && a <= 90 && b >= -180 && b <= 180) return { lat: a, lng: b };
  }
  return null;
};

const isMapsUrl = (s) => {
  const t = String(s || '').trim();
  if (!t) return false;
  if (!/^https?:\/\//i.test(t)) return false;
  return /^(https?:\/\/)(maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.com|www\.google\.com\/maps)/i.test(t);
};

const buildMapsLink = (lat, lng) => `https://www.google.com/maps?q=${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;

const extractUrlFromText = (s) => {
  let t = String(s || '').trim();
  t = t.replace(/^['"`\s]+|['"`\s]+$/g, '');
  if (!/^https?:\/\//i.test(t)) {
    const m = t.match(/https?:\/\/\S+/i);
    if (m) {
      t = m[0];
    }
  }
  t = t.replace(/[)\]\}>]+$/g, '');
  return t.trim();
};

const normalizeTextToUrl = (s) => {
  const direct = extractUrlFromText(s);
  if (direct) return direct;
  const t = String(s || '').trim();
  const m = t.match(/(maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.com|www\.google\.com\/maps)[^\s'"`]+/i);
  if (m) {
    const tail = m[0];
    return `https://${tail}`;
  }
  return '';
};

const extractOrAcceptMapsLink = (s) => {
  const raw = normalizeTextToUrl(s);
  const p = parseMapsLink(s);
  if (p && Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
    return buildMapsLink(p.lat, p.lng);
  }
  if (isMapsUrl(raw)) {
    return raw;
  }
  if (isValidUrl(raw)) {
    return raw;
  }
  return null;
};
const isStrongPassword = (s) => {
  if (!s || s.length < 12) return false;
  if (!/[a-z]/.test(s)) return false;
  if (!/[A-Z]/.test(s)) return false;
  if (!/[0-9]/.test(s)) return false;
  if (!/[^A-Za-z0-9]/.test(s)) return false;
  return true;
};
const isValidEmail = (s) => {
  if (!s) return false;
  const e = s.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
};
const isValidUrl = (s) => {
  try {
    const u = new URL((s || '').trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};
const isUuid = (s) => {
  const v = (s || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
};
const PasswordChecklist = ({ value }) => {
  const v = String(value || '');
  const okLen = v.length >= 12;
  const okLower = /[a-z]/.test(v);
  const okUpper = /[A-Z]/.test(v);
  const okNum = /[0-9]/.test(v);
  const okSpecial = /[^A-Za-z0-9]/.test(v);
  const Item = ({ ok, text }) => (
    <View style={[styles.row, { marginBottom: 6 }]}> 
      <Feather name={ok ? 'check-circle' : 'x-circle'} size={16} color={ok ? '#16a34a' : '#b91c1c'} />
      <Text style={{ fontSize: 12, color: ok ? '#16a34a' : '#b91c1c' }}>{text}</Text>
    </View>
  );
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={[styles.label, styles.labelMuted]}>Requisitos da senha:</Text>
      <Item ok={okLen} text="Pelo menos 12 caracteres" />
      <Item ok={okLower} text="Pelo menos 1 letra minúscula" />
      <Item ok={okUpper} text="Pelo menos 1 letra maiúscula" />
      <Item ok={okNum} text="Pelo menos 1 número" />
      <Item ok={okSpecial} text="Pelo menos 1 caractere especial" />
    </View>
  );
};
const formatCpfBR = (s) => {
  const d = (s || '').replace(/\D+/g, '');
  const p1 = d.slice(0, 3);
  const p2 = d.slice(3, 6);
  const p3 = d.slice(6, 9);
  const p4 = d.slice(9, 11);
  let out = p1;
  if (p2) out += '.' + p2;
  if (p3) out += '.' + p3;
  if (p4) out += '-' + p4;
  return out;
};
const isValidCpf = (s) => {
  const d = (s || '').replace(/\D+/g, '');
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  const calc = (base, factor) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += Number(base[i]) * (factor - i);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const d1 = calc(d.slice(0, 9), 10);
  if (d1 !== Number(d[9])) return false;
  const d2 = calc(d.slice(0, 10), 11);
  return d2 === Number(d[10]);
};
const Section = ({ title, children, expanded, onToggle, style }) => (
  <View style={[styles.section, style]}>
    <Pressable onPress={onToggle} style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionToggle}>{expanded ? '▲' : '▼'}</Text>
    </Pressable>
    {expanded && <View style={styles.sectionBody}>{children}</View>}
  </View>
);

export default function App() {
  const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const envKey = process.env.EXPO_PUBLIC_SUPABASE_KEY || '';
  const envReady = !!(envUrl && envKey);
  if (!envReady) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#121212', padding: 20, justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 20, marginBottom: 12 }}>Configuração do Supabase ausente</Text>
          <Text style={{ color: '#ccc', marginBottom: 6 }}>EXPO_PUBLIC_SUPABASE_URL: {envUrl || 'vazio'}</Text>
          <Text style={{ color: '#ccc', marginBottom: 6 }}>EXPO_PUBLIC_SUPABASE_KEY: {envKey ? 'presente' : 'vazia'}</Text>
          <Text style={{ color: '#f5c518' }}>Atualize variáveis no EAS e gere novo build</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }
  
  const initialUserIdWeb = Platform.OS === 'web' && typeof window !== 'undefined' ? (() => {
    try {
      const id = window.localStorage.getItem('sessionUserId');
      const started = Number(window.localStorage.getItem('sessionStartedAt') || '0');
      const now = Date.now();
      const eightHours = 8 * 60 * 60 * 1000;
      if (id && started && now - started <= eightHours) return id;
    } catch {}
    return null;
  })() : null;
  const initialModeWeb = Platform.OS === 'web'
    ? ((initialUserIdWeb && typeof window !== 'undefined' && window.location && window.location.pathname && window.location.pathname !== '/login' && window.location.pathname !== '/cadastrar' && window.location.pathname !== '/reset') ? 'editor' : 'auth')
    : 'auth';
  const [expanded, setExpanded] = useState({
    cliente: true,
    cto: false,
    casa: false,
    interna: false,
    finalizacao: false,
  });

  const [form, setForm] = useState(makeInitialForm());
  const [originalForm, setOriginalForm] = useState(makeInitialForm());
  const [mode, setMode] = useState(initialModeWeb);
  const [authMode, setAuthMode] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState('');
  const [authFirstName, setAuthFirstName] = useState('');
  const [authLastName, setAuthLastName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authCpf, setAuthCpf] = useState('');
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [userId, setUserIdState] = useState(initialUserIdWeb);
  const [userName, setUserName] = useState(null);
  const [currentId, setCurrentId] = useState(null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [route, setRoute] = useState(
    Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.pathname || '/home' : '/login'
  );

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [saveModalMessage, setSaveModalMessage] = useState('');
  const [bannerType, setBannerType] = useState('success');
  const [editUserModalVisible, setEditUserModalVisible] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editNewPassword, setEditNewPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showWifiPassword, setShowWifiPassword] = useState(false);
  const senhaWifiRef = useRef(null);
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const bannerTimerRef = useRef(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locatingKey, setLocatingKey] = useState(null);
  const [isNavigatingList, setIsNavigatingList] = useState(false);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingId, setExportingId] = useState(null);
  const locClienteRef = useRef(null);
  const locCtoRef = useRef(null);
  const locCasaRef = useRef(null);

  const clearAuthFields = () => {
    setAuthEmail('');
    setAuthPassword('');
    setAuthFirstName('');
    setAuthLastName('');
    setAuthPhone('');
    setAuthCpf('');
    setErrorMessage(null);
  };

  const onLogout = async () => {
    try {
      await signOut();
    } catch {}
    setUserIdState(null);
    setUserName(null);
    setList([]);
    resetUIForNew();
    setAuthEmail('');
    setAuthPassword('');
    setAuthFirstName('');
    setAuthLastName('');
    setAuthPhone('');
    setAuthMode('login');
    setMode('auth');
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try { window.localStorage.removeItem('sessionStartedAt'); } catch {}
        try { window.localStorage.removeItem('sessionUserId'); } catch {}
      }
    } catch {}
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.revoke) {
        try { await navigator.permissions.revoke({ name: 'geolocation' }); } catch {}
      } else {
        try { await Linking.openSettings(); } catch {}
      }
    } catch {}
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.history.pushState({}, '', '/login');
      setRoute('/login');
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await initDB();
        if (Platform.OS === 'web') {
          const ready = typeof isSupabaseReady === 'function' ? isSupabaseReady() : true;
          const u = await getCurrentUser();
          if (u && u.id) {
            let sessionOk = true;
            try {
              const startedRaw = typeof window !== 'undefined' ? window.localStorage.getItem('sessionStartedAt') : null;
              const started = Number(startedRaw || '0');
              const now = Date.now();
              const eightHours = 8 * 60 * 60 * 1000;
              if (!started || now - started > eightHours) {
                sessionOk = false;
                try { await signOut(); } catch {}
              }
            } catch {}
            if (sessionOk) {
              setUserIdState(u.id);
              await setUserId(u.id);
              try {
                const p = await getProfile(u.id);
                const nm = [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim();
                setUserName(nm || p?.first_name || null);
              } catch {}
              await refreshList();
            } else {
              try { window.localStorage.removeItem('sessionStartedAt'); } catch {}
              window.history.replaceState({}, '', '/login');
              setRoute('/login');
              setAuthMode('login');
              setMode('auth');
            }
          } else {
            let lsUserId = null;
            let lsStarted = 0;
            try {
              lsUserId = window.localStorage.getItem('sessionUserId');
              lsStarted = Number(window.localStorage.getItem('sessionStartedAt') || '0');
            } catch {}
            const now2 = Date.now();
            const eightHours2 = 8 * 60 * 60 * 1000;
            if (lsUserId && lsStarted && now2 - lsStarted <= eightHours2) {
              setUserIdState(lsUserId);
              await setUserId(lsUserId);
              if (ready) {
                try {
                  const p = await getProfile(lsUserId);
                  const nm = [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim();
                  setUserName(nm || p?.first_name || null);
                } catch {}
              }
              if (typeof window !== 'undefined') {
                window.history.replaceState({}, '', '/home');
                setRoute('/home');
              }
              setMode('editor');
              await refreshList();
            } else {
              if (typeof window !== 'undefined') {
                window.history.replaceState({}, '', '/login');
                setRoute('/login');
              }
              setAuthMode('login');
              setMode('auth');
            }
          }
        } else {
          const u = await getCurrentUser();
          if (u && u.id) {
            setUserIdState(u.id);
            try {
              const p = await getProfile(u.id);
              const nm = [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim();
              setUserName(nm || p?.first_name || null);
            } catch {}
            await refreshList();
          } else {
            setAuthMode('login');
            setMode('auth');
          }
        }
      } catch (e) {
        console.error(e);
        setErrorMessage('Falha ao inicializar. Verifique configuração do Supabase (URL/KEY).');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (errorMessage) {
      setBannerType('error');
      setSaveModalMessage(errorMessage);
      setSaveModalVisible(true);
    }
    return () => {};
  }, [errorMessage]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const sync = () => {
        let p = window.location.pathname || '/home';
        if (p === '/') {
          window.history.replaceState({}, '', '/home');
          p = '/home';
        }
        setRoute(p);
        if (p === '/login') {
          setAuthMode('login');
          setMode('auth');
        } else if (p === '/cadastrar') {
          setAuthMode('register');
          setMode('auth');
        } else if (p === '/reset') {
          setAuthMode('reset');
          setMode('auth');
        } else if (p === '/alterar-senha') {
          setAuthMode('update_password');
          setMode('auth');
        } else if (p === '/checklists') {
          setMode('list');
        } else {
          setMode('editor');
        }
      };
      window.addEventListener('popstate', sync);
      const unsubscribe = typeof onAuthStateChange === 'function' ? onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          try {
            window.history.pushState({}, '', '/alterar-senha');
            setRoute('/alterar-senha');
            setAuthMode('update_password');
            setMode('auth');
          } catch {}
        }
      }) : () => {};
      return () => { window.removeEventListener('popstate', sync); try { unsubscribe(); } catch {} };
    }
    return () => {};
  }, []);

  useEffect(() => {
    if (saveModalVisible) {
      Animated.timing(bannerOpacity, { toValue: 1, duration: 400, useNativeDriver: Platform.OS !== 'web' }).start();
      if (bannerTimerRef.current) { clearTimeout(bannerTimerRef.current); bannerTimerRef.current = null; }
      bannerTimerRef.current = setTimeout(() => {
        Animated.timing(bannerOpacity, { toValue: 0, duration: 600, useNativeDriver: Platform.OS !== 'web' }).start(() => {
          setSaveModalVisible(false);
        });
      }, 3500);
      return () => {
        if (bannerTimerRef.current) { clearTimeout(bannerTimerRef.current); bannerTimerRef.current = null; }
      };
    }
    return () => {};
  }, [saveModalVisible]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (!loading && !userId && (route === '/home' || route === '/checklists')) {
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', '/login');
          setRoute('/login');
        }
        setAuthMode('login');
        setMode('auth');
      }
    }
  }, [userId, route, loading]);

  const refreshList = async () => {
    const rows = await listChecklists(userId);
    setList(rows);
  };

  const compressDataUri = async (dataUri, maxW = 1024, maxH = 1024, quality = 0.45) => {
    try {
      if (!dataUri) return null;
      if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
        return dataUri;
      }
      const img = new Image();
      const loaded = await new Promise((resolve, reject) => {
        img.onload = () => resolve(true);
        img.onerror = (e) => reject(e);
        img.src = dataUri;
      });
      if (!loaded) return dataUri;
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) return dataUri;
      const ratio = Math.min(maxW / w, maxH / h, 1);
      const tw = Math.round(w * ratio);
      const th = Math.round(h * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, tw, th);
      const out = canvas.toDataURL('image/jpeg', quality);
      return out || dataUri;
    } catch {
      return dataUri;
    }
  };

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const askCameraAndPick = async (fieldKey) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted' && libPerm.status !== 'granted') {
      Alert.alert('Permissão', 'Permissão de câmera/galeria necessária.');
      return;
    }
    let result;
    try {
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        base64: true,
      });
    } catch (e) {
      result = null;
    }
    if (!result || result.canceled) {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        base64: true,
      });
    }
    if (!result.canceled && result.assets?.[0]?.uri) {
      const asset = result.assets[0];
      const uri = asset.uri;
      const lower = (uri || '').toLowerCase();
      const mime = lower.endsWith('.png') ? 'image/png' : 'image/jpeg';
      const b64 = asset.base64;
      const dataUriKeyMap = {
        fotoCto: 'fotoCtoDataUri',
        fotoFrenteCasa: 'fotoFrenteCasaDataUri',
        fotoInstalacao: 'fotoInstalacaoDataUri',
        fotoMacEquip: 'fotoMacEquipDataUri',
      };
      const dataKey = dataUriKeyMap[fieldKey];
      let dataUri = b64 ? `data:${mime};base64,${b64}` : null;
      if (dataKey && dataUri) {
        dataUri = await compressDataUri(dataUri, 1280, 1280, 0.5);
      }
      setForm((prev) => ({
        ...prev,
        [fieldKey]: uri,
        ...(dataKey && dataUri ? { [dataKey]: dataUri } : {}),
      }));
    }
  };

  const useCurrentLocation = async (fieldKey) => {
    setIsLocating(true);
    setLocatingKey(fieldKey);
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
        let best = null;
        let finalPos = null;
        try {
          finalPos = await new Promise((resolve) => {
            const wid = navigator.geolocation.watchPosition(
              (p) => {
                const acc = typeof p?.coords?.accuracy === 'number' ? p.coords.accuracy : null;
                if (!best || (acc != null && acc < (best?.coords?.accuracy ?? Infinity))) best = p;
                if (acc != null && acc <= 30) {
                  try { navigator.geolocation.clearWatch(wid); } catch {}
                  resolve(p);
                }
              },
              () => {
                try { navigator.geolocation.clearWatch(wid); } catch {}
                resolve(null);
              },
              { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
            );
            setTimeout(() => {
              try { navigator.geolocation.clearWatch(wid); } catch {}
              resolve(best);
            }, 8000);
          });
        } catch {}
        if (finalPos && finalPos.coords && finalPos.coords.latitude && finalPos.coords.longitude) {
          const lat = Number(finalPos.coords.latitude).toFixed(6);
          const lng = Number(finalPos.coords.longitude).toFixed(6);
          setField(fieldKey, `https://www.google.com/maps?q=${lat},${lng}`);
          return;
        }
        try {
          const ctrl = new AbortController();
          const to = setTimeout(() => ctrl.abort(), 3000);
          const resp = await fetch('https://ipinfo.io/json', { signal: ctrl.signal });
          clearTimeout(to);
          if (resp && resp.ok) {
            const j = await resp.json();
            if (j && j.loc && typeof j.loc === 'string') {
              const parts = j.loc.split(',');
              if (parts.length === 2) {
                const lat = parts[0];
                const lng = parts[1];
                setField(fieldKey, `https://www.google.com/maps?q=${lat},${lng}`);
                return;
              }
            }
          }
        } catch {}
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permissão negada', 'Ative a permissão de localização nas configurações do sistema para continuar.');
          return;
        }
        try {
          const provider = await Location.getProviderStatusAsync();
          if (!provider?.locationServicesEnabled) {
            Alert.alert('Serviços de localização desligados', 'Ative GPS/Serviços de localização no aparelho para obter sua posição.');
          }
        } catch {}
        let best = null;
        let resolveFn;
        const done = new Promise((resolve) => { resolveFn = resolve; });
        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
          (p) => {
            const acc = typeof p?.coords?.accuracy === 'number' ? p.coords.accuracy : null;
            if (!best || (acc != null && acc < (best?.coords?.accuracy ?? Infinity))) best = p;
            if (acc != null && acc <= 50) resolveFn(p);
          }
        );
        setTimeout(() => resolveFn(best), 12000);
        const finalPos = await done;
        try { sub?.remove(); } catch {}
        if (!(finalPos?.coords?.latitude && finalPos?.coords?.longitude)) {
          try {
            const single = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest, maximumAge: 10000 });
            if (!best || (typeof single?.coords?.accuracy === 'number' && single.coords.accuracy < (best?.coords?.accuracy ?? Infinity))) {
              best = single;
            }
          } catch {}
        }
        if (!(best?.coords?.latitude && best?.coords?.longitude)) {
          try {
            const last = await Location.getLastKnownPositionAsync();
            if (last?.coords?.latitude && last?.coords?.longitude) { best = last; }
          } catch {}
        }
        if (best?.coords?.latitude && best?.coords?.longitude) {
          const lat = Number(best.coords.latitude).toFixed(6);
          const lng = Number(best.coords.longitude).toFixed(6);
          setField(fieldKey, `https://www.google.com/maps?q=${lat},${lng}`);
        } else {
          Alert.alert('Erro', 'Não foi possível obter sua localização no aparelho.');
        }
      }
    } catch {}
    finally {
      setIsLocating(false);
      setLocatingKey(null);
    }
  };

  const pasteFromMaps = async (fieldKey) => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
        const txt = await navigator.clipboard.readText();
        const val = extractOrAcceptMapsLink(txt);
        if (val) {
          setField(fieldKey, val);
          return;
        }
        Alert.alert('Erro', 'Cole um link ou coordenadas válidas do Google Maps.');
        return;
      } else {
        const txt = await Clipboard.getStringAsync();
        const val = extractOrAcceptMapsLink(txt);
        if (val) {
          setField(fieldKey, val);
          return;
        }
      }
    } catch {}
    Alert.alert('Erro', 'Cole um link ou coordenadas válidas do Google Maps.');
  };

  

  

  const ToggleYesNo = ({ value, onChange }) => (
    <View style={styles.toggleRow}>
      <Pressable
        onPress={() => onChange(true)}
        style={[styles.toggleBtn, value === true && styles.toggleActive]}
      >
        <Text style={[styles.toggleText, value === true && styles.toggleTextActive]}>✅ Sim</Text>
      </Pressable>
      <Pressable
        onPress={() => onChange(false)}
        style={[styles.toggleBtn, value === false && styles.toggleActive]}
      >
        <Text style={[styles.toggleText, value === false && styles.toggleTextActive]}>❌ Não</Text>
      </Pressable>
    </View>
  );

  const resetForm = () => {
    const init = makeInitialForm();
    setForm(init);
    setOriginalForm(init);
    setCurrentId(null);
  };

  const resetUIForNew = () => {
    resetForm();
    setExpanded({ cliente: true, cto: false, casa: false, interna: false, finalizacao: false });
  };

  const hasChanges = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(originalForm),
    [form, originalForm]
  );

  const onSave = async () => {
    try {
      setIsSaving(true);
      if (Platform.OS === 'web') {
        const ready = typeof isSupabaseReady === 'function' ? isSupabaseReady() : true;
        if (!ready) {
          setBannerType('error');
          setSaveModalMessage('Supabase não configurado. Defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_KEY.');
          setSaveModalVisible(true);
          return;
        }
      }
      senhaWifiRef.current?.blur();
      await new Promise((r) => setTimeout(r, 50));
      const useUserId = isUuid(userId) ? userId : null;
      if (!currentId) {
        const id = await saveChecklist(form, useUserId);
        if (!id) {
          setBannerType('error');
          setSaveModalMessage('Falha ao criar checklist.');
          setSaveModalVisible(true);
          return;
        }
        setCurrentId(id);
        setOriginalForm(form);
        setBannerType('success');
        setSaveModalMessage('Checklist criado com sucesso.');
        setSaveModalVisible(true);
        resetUIForNew();
      } else {
        await updateChecklist(currentId, form, userId);
        setOriginalForm(form);
        setBannerType('success');
        setSaveModalMessage('Checklist atualizado com sucesso.');
        setSaveModalVisible(true);
      }
      await refreshList();
    } catch (e) {
      console.error(e);
      setBannerType('error');
      const msg = (e && (e.message || e.error_description || e.hint)) ? (e.message || e.error_description || e.hint) : 'Não foi possível salvar. Verifique conexão e configuração do Supabase.';
      setSaveModalMessage(msg);
      setSaveModalVisible(true);
    } finally {
      setIsSaving(false);
    }
  };

  const createReady = useMemo(() => {
    const s = (v) => (v || '').trim();
    return (
      s(form.nome) &&
      s(form.ruaNumero) &&
      s(form.locClienteLink) &&
      s(form.locCtoLink) &&
      s(form.locCasaLink) &&
      s(form.corFibra) &&
      form.possuiSplitter !== null &&
      s(form.portaCliente) &&
      s(form.nomeWifi) &&
      s(form.senhaWifi) &&
      form.testeNavegacaoOk !== null &&
      form.clienteSatisfeito !== null &&
      (form.fotoCtoDataUri || form.fotoCto) &&
      (form.fotoFrenteCasaDataUri || form.fotoFrenteCasa) &&
      (form.fotoInstalacaoDataUri || form.fotoInstalacao) &&
      (form.fotoMacEquipDataUri || form.fotoMacEquip)
    );
  }, [form]);

  const onExportPdf = async () => {
    try {
      const getMimeFromUri = (uri) => {
        if (!uri) return 'image/jpeg';
        const lower = uri.toLowerCase();
        if (lower.endsWith('.png')) return 'image/png';
        if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
        return 'image/jpeg';
      };

      const toBase64 = async (uri) => {
        if (!uri) return null;
        try {
          const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
          const mime = getMimeFromUri(uri);
          return `data:${mime};base64,${b64}`;
        } catch {
          return null;
        }
      };

      const dataOrRead = async (dataUri, uri) => {
        if (dataUri) return dataUri;
        if (uri && /^https?:\/\//.test(uri)) return uri;
        return await toBase64(uri);
      };

      const imgCto = await dataOrRead(form.fotoCtoDataUri, form.fotoCto);
      const imgCasa = await dataOrRead(form.fotoFrenteCasaDataUri, form.fotoFrenteCasa);
      const imgInst = await dataOrRead(form.fotoInstalacaoDataUri, form.fotoInstalacao);
      const imgMac = await dataOrRead(form.fotoMacEquipDataUri, form.fotoMacEquip);

      const yesNo = (v) => (v === true ? 'Sim' : v === false ? 'Não' : '—');
      const capitalizeWords = (s) => {
        if (!s) return '';
        return s
          .split(/\s+/)
          .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
          .join(' ');
      };

      let displayUser = (userName || '').trim();
      let displayEmail = '';
      let displayPhone = '';
      try {
        const u0 = await getCurrentUser();
        displayEmail = u0?.email || '';
        const uid0 = u0?.id || userId;
        if (uid0) {
          const p0 = await getProfile(uid0);
          const nm0 = [p0?.first_name, p0?.last_name].filter(Boolean).join(' ').trim();
          displayUser = displayUser || nm0;
          displayPhone = p0?.phone ? formatPhoneBR(p0.phone) : '';
        }
      } catch {}
      const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            @page { size: A4; margin: 10mm; }
            body { font-family: -apple-system, Roboto, Arial; background:#f6f7fb; padding: 10px; }
            .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
            .title { font-size:20px; font-weight:700; color:#222; }
            .meta { font-size:12px; color:#666; }
            .card { background:#fff; border-radius:8px; padding:10px; box-shadow:0 2px 6px rgba(0,0,0,0.06); margin:12px 0; page-break-inside: avoid; break-inside: avoid; }
            .cardHeader { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
            .badge { display:inline-block; background:#e1e8ff; color:#2f6fed; font-weight:700; font-size:12px; border-radius:6px; padding:4px 8px; margin-right:8px; }
            .cardTitle { font-size:16px; font-weight:600; color:#333; }
            .row { margin:4px 0; font-size:13px; color:#444; line-height:1.35; break-inside: avoid; page-break-inside: avoid; }
            .label { font-weight:600; }
            .figure { display:flex; flex-direction:column; align-items:flex-start; margin:6px 0; break-inside: avoid; page-break-inside: avoid; }
            .img { width:260px; height:160px; object-fit:cover; border-radius:8px; }
            a { color:#2f6fed; text-decoration:none; }
            .link { word-break: break-all; }
            /* Espaçamento extra no topo da seção 4 */
            .card4 { padding-top: 16px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Checklist</div>
            <div class="meta">${new Date().toLocaleString()}</div>
          </div>
          <div class="card">
            <div class="row"><span class="label">Usuário:</span> ${displayUser || ''}</div>
            <div class="row"><span class="label">E‑mail:</span> ${displayEmail || ''}</div>
            <div class="row"><span class="label">Telefone:</span> ${displayPhone || ''}</div>
          </div>

          <div class="card">
            <div class="cardHeader"><div><span class="badge">1</span><span class="cardTitle">Dados do cliente</span></div></div>
            ${form.nome ? `<div class="row"><span class="label">Nome completo:</span> ${capitalizeWords(form.nome)}</div>` : ''}
            ${form.ruaNumero ? `<div class="row"><span class="label">Rua e número:</span> ${form.ruaNumero}</div>` : ''}
            ${form.locClienteLink ? `<div class="row"><span class="label">Localização (link do Maps):</span> <span class="link"><a href="${form.locClienteLink}">${form.locClienteLink}</a></span></div>` : ''}
          </div>

          <div class="card">
            <div class="cardHeader"><div><span class="badge">2</span><span class="cardTitle">CTO / rede externa</span></div></div>
            ${form.locCtoLink ? `<div class="row"><span class="label">Localização da CTO (link do Maps):</span> <span class="link"><a href="${form.locCtoLink}">${form.locCtoLink}</a></span></div>` : ''}
            ${imgCto ? `<div class="row"><span class="label">Foto da CTO</span></div><div class="figure"><img class="img" src="${imgCto}" alt="Foto da CTO" /></div>` : ''}
            ${form.corFibra ? `<div class="row"><span class="label">Cor da fibra:</span> ${form.corFibra}</div>` : ''}
            ${form.possuiSplitter !== null ? `<div class="row"><span class="label">Possui splitter?</span> ${yesNo(form.possuiSplitter)}</div>` : ''}
            ${form.portaCliente ? `<div class="row"><span class="label">Número da porta utilizada pelo cliente:</span> ${form.portaCliente}</div>` : ''}
          </div>

          <div class="card">
            <div class="cardHeader"><div><span class="badge">3</span><span class="cardTitle">Casa do cliente</span></div></div>
            ${form.locCasaLink ? `<div class="row"><span class="label">Localização da casa (link do Maps):</span> <span class="link"><a href="${form.locCasaLink}">${form.locCasaLink}</a></span></div>` : ''}
            ${imgCasa ? `<div class="row"><span class="label">Foto da frente da casa</span></div><div class="figure"><img class="img" src="${imgCasa}" alt="Foto da frente da casa" /></div>` : ''}
          </div>

          <div class="card card4">
            <div class="cardHeader"><div><span class="badge">4</span><span class="cardTitle">Instalação interna</span></div></div>
            ${imgInst ? `<div class="row"><span class="label">Foto da instalação do equipamento (ONT/Router)</span></div><div class="figure"><img class="img" src="${imgInst}" alt="Foto da instalação do equipamento (ONT/Router)" /></div>` : ''}
            ${imgMac ? `<div class="row"><span class="label">Foto do MAC do equipamento</span></div><div class="figure"><img class="img" src="${imgMac}" alt="Foto do MAC do equipamento" /></div>` : ''}
            ${form.nomeWifi ? `<div class="row"><span class="label">Nome do Wi‑Fi:</span> ${form.nomeWifi}</div>` : ''}
            ${form.senhaWifi ? `<div class="row"><span class="label">Senha do Wi‑Fi:</span> ${form.senhaWifi}</div>` : ''}
          </div>

          <div class="card">
            <div class="cardHeader"><div><span class="badge">5</span><span class="cardTitle">Finalização</span></div></div>
            ${form.testeNavegacaoOk !== null ? `<div class="row"><span class="label">Teste de navegação realizado com sucesso?</span> ${yesNo(form.testeNavegacaoOk)}</div>` : ''}
            ${form.clienteSatisfeito !== null ? `<div class="row"><span class="label">Cliente ciente e satisfeito com o serviço?</span> ${yesNo(form.clienteSatisfeito)}</div>` : ''}
          </div>
        </body>
      </html>`;

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          const w = window.open('', '_blank');
          if (w) {
            w.document.open();
            w.document.write(html);
            w.document.close();
            w.focus();
            setTimeout(() => { try { w.print(); } catch {} }, 300);
          }
        } catch {}
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        await shareAsync(uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Falha ao gerar/compartilhar PDF.');
    }
  };

  const onExportPdfItem = async (id) => {
    try {
      setIsExporting(true);
      setExportingId(id);
      const row = await getChecklist(id, userId);
      if (!row) return;

      const getMimeFromUri = (uri) => {
        if (!uri) return 'image/jpeg';
        const lower = uri.toLowerCase();
        if (lower.endsWith('.png')) return 'image/png';
        if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
        return 'image/jpeg';
      };

      const toBase64 = async (uri) => {
        if (!uri) return null;
        try {
          const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
          const mime = getMimeFromUri(uri);
          return `data:${mime};base64,${b64}`;
        } catch {
          return null;
        }
      };

      const dataOrRead = async (dataUri, uri) => {
        if (dataUri) return dataUri;
        if (uri && /^https?:\/\//.test(uri)) return uri;
        return await toBase64(uri);
      };

      let displayUser = (userName || '').trim();
      let displayEmail = '';
      let displayPhone = '';
      try {
        const u0 = await getCurrentUser();
        displayEmail = u0?.email || '';
        const uid0 = u0?.id || userId;
        if (uid0) {
          const p0 = await getProfile(uid0);
          const nm0 = [p0?.first_name, p0?.last_name].filter(Boolean).join(' ').trim();
          displayUser = displayUser || nm0;
          displayPhone = p0?.phone ? formatPhoneBR(p0.phone) : '';
        }
      } catch {}
      const f = {
        nome: row.nome || '',
        ruaNumero: row.ruaNumero || row.ruanumero || '',
        locClienteLink: row.locClienteLink || row.locclientelink || '',
        locCtoLink: row.locCtoLink || row.locctolink || '',
        fotoCto: row.fotoCto || row.fotocto || null,
        fotoCtoDataUri: row.fotoCtoDataUri || row.fotoctodatauri || null,
        corFibra: row.corFibra || row.corfibra || '',
        possuiSplitter:
          row.possuiSplitter === 1 || row.possuisplitter === 1
            ? true
            : row.possuiSplitter === 0 || row.possuisplitter === 0
            ? false
            : null,
        portaCliente: row.portaCliente || row.portacliente || '',
        locCasaLink: row.locCasaLink || row.loccasalink || '',
        fotoFrenteCasa: row.fotoFrenteCasa || row.fotofrentecasa || null,
        fotoFrenteCasaDataUri: row.fotoFrenteCasaDataUri || row.fotofrentecasadatauri || null,
        fotoInstalacao: row.fotoInstalacao || row.fotoinstalacao || null,
        fotoInstalacaoDataUri: row.fotoInstalacaoDataUri || row.fotoinstalacaodatauri || null,
        fotoMacEquip: row.fotoMacEquip || row.fotomacequip || null,
        fotoMacEquipDataUri: row.fotoMacEquipDataUri || row.fotomacequipdatauri || null,
        nomeWifi: row.nomeWifi || row.nomewifi || '',
        senhaWifi: row.senhaWifi || row.senhawifi || '',
        testeNavegacaoOk:
          row.testeNavegacaoOk === 1 || row.testenavegacaook === 1
            ? true
            : row.testeNavegacaoOk === 0 || row.testenavegacaook === 0
            ? false
            : null,
        clienteSatisfeito:
          row.clienteSatisfeito === 1 || row.clientesatisfeito === 1
            ? true
            : row.clienteSatisfeito === 0 || row.clientesatisfeito === 0
            ? false
            : null,
      };
      const imgCto = await dataOrRead(f.fotoCtoDataUri, f.fotoCto);
      const imgCasa = await dataOrRead(f.fotoFrenteCasaDataUri, f.fotoFrenteCasa);
      const imgInst = await dataOrRead(f.fotoInstalacaoDataUri, f.fotoInstalacao);
      const imgMac = await dataOrRead(f.fotoMacEquipDataUri, f.fotoMacEquip);

      const yesNo = (v) => (v === 1 || v === true ? 'Sim' : v === 0 || v === false ? 'Não' : '—');
      const capitalizeWords = (s) => {
        if (!s) return '';
        return String(s)
          .split(/\s+/)
          .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
          .join(' ');
      };

      const html = `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            @page { size: A4; margin: 10mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 10px; background:#f6f7fb; }
            .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
            .title { font-size:20px; font-weight:700; color:#222; }
            .meta { font-size:12px; color:#666; }
            .card { background:#fff; border-radius:8px; padding:10px; box-shadow:0 2px 6px rgba(0,0,0,0.06); margin:12px 0; page-break-inside: avoid; break-inside: avoid; }
            .cardHeader { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
            .badge { display:inline-block; background:#e1e8ff; color:#2f6fed; font-weight:700; font-size:12px; border-radius:6px; padding:4px 8px; margin-right:8px; }
            .cardTitle { font-size:16px; font-weight:600; color:#333; }
            .row { margin:4px 0; font-size:13px; color:#444; line-height:1.35; break-inside: avoid; page-break-inside: avoid; }
            .label { font-weight:600; }
            .figure { display:flex; flex-direction:column; align-items:flex-start; margin:6px 0; break-inside: avoid; page-break-inside: avoid; }
            .img { width:260px; height:160px; object-fit:cover; border-radius:8px; }
            a { color:#2f6fed; text-decoration:none; }
            .link { word-break: break-all; }
            /* Espaçamento extra no topo da seção 4 */
            .card4 { padding-top: 16px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Checklist</div>
            <div class="meta">${new Date().toLocaleString()}</div>
          </div>
          <div class="card">
            <div class="row"><span class="label">Usuário:</span> ${displayUser || ''}</div>
            <div class="row"><span class="label">E‑mail:</span> ${displayEmail || ''}</div>
            <div class="row"><span class="label">Telefone:</span> ${displayPhone || ''}</div>
          </div>

          <div class="card">
            <div class="cardHeader"><div><span class="badge">1</span><span class="cardTitle">Dados do cliente</span></div></div>
            ${f.nome ? `<div class="row"><span class="label">Nome completo:</span> ${capitalizeWords(f.nome)}</div>` : ''}
            ${f.ruaNumero ? `<div class="row"><span class="label">Rua e número:</span> ${f.ruaNumero}</div>` : ''}
            ${f.locClienteLink ? `<div class="row"><span class="label">Localização (link do Maps):</span> <span class="link"><a href="${f.locClienteLink}">${f.locClienteLink}</a></span></div>` : ''}
          </div>

          <div class="card">
            <div class="cardHeader"><div><span class="badge">2</span><span class="cardTitle">CTO / rede externa</span></div></div>
            ${f.locCtoLink ? `<div class="row"><span class="label">Localização da CTO (link do Maps):</span> <span class="link"><a href="${f.locCtoLink}">${f.locCtoLink}</a></span></div>` : ''}
            ${imgCto ? `<div class="row"><span class="label">Foto da CTO</span></div><div class="figure"><img class="img" src="${imgCto}" alt="Foto da CTO" /></div>` : ''}
            ${f.corFibra ? `<div class="row"><span class="label">Cor da fibra:</span> ${f.corFibra}</div>` : ''}
            ${f.possuiSplitter !== null ? `<div class="row"><span class="label">Possui splitter?</span> ${yesNo(f.possuiSplitter)}</div>` : ''}
            ${f.portaCliente ? `<div class="row"><span class="label">Número da porta utilizada pelo cliente:</span> ${f.portaCliente}</div>` : ''}
          </div>

          <div class="card">
            <div class="cardHeader"><div><span class="badge">3</span><span class="cardTitle">Casa do cliente</span></div></div>
            ${f.locCasaLink ? `<div class="row"><span class="label">Localização da casa (link do Maps):</span> <span class="link"><a href="${f.locCasaLink}">${f.locCasaLink}</a></span></div>` : ''}
            ${imgCasa ? `<div class="row"><span class="label">Foto da frente da casa</span></div><div class="figure"><img class="img" src="${imgCasa}" alt="Foto da frente da casa" /></div>` : ''}
          </div>

          <div class="card card4">
            <div class="cardHeader"><div><span class="badge">4</span><span class="cardTitle">Instalação interna</span></div></div>
            ${imgInst ? `<div class="row"><span class="label">Foto da instalação do equipamento (ONT/Router)</span></div><div class="figure"><img class="img" src="${imgInst}" alt="Foto da instalação do equipamento (ONT/Router)" /></div>` : ''}
            ${imgMac ? `<div class="row"><span class="label">Foto do MAC do equipamento</span></div><div class="figure"><img class="img" src="${imgMac}" alt="Foto do MAC do equipamento" /></div>` : ''}
            ${f.nomeWifi ? `<div class="row"><span class="label">Nome do Wi‑Fi:</span> ${f.nomeWifi}</div>` : ''}
            ${f.senhaWifi ? `<div class="row"><span class="label">Senha do Wi‑Fi:</span> ${f.senhaWifi}</div>` : ''}
          </div>

          <div class="card">
            <div class="cardHeader"><div><span class="badge">5</span><span class="cardTitle">Finalização</span></div></div>
            ${f.testeNavegacaoOk !== null ? `<div class="row"><span class="label">Teste de navegação realizado com sucesso?</span> ${yesNo(f.testeNavegacaoOk)}</div>` : ''}
            ${f.clienteSatisfeito !== null ? `<div class="row"><span class="label">Cliente ciente e satisfeito com o serviço?</span> ${yesNo(f.clienteSatisfeito)}</div>` : ''}
          </div>
        </body>
      </html>`;

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          const w = window.open('', '_blank');
          if (w) {
            w.document.open();
            w.document.write(html);
            w.document.close();
            w.focus();
            setTimeout(() => { try { w.print(); } catch {} }, 300);
          }
        } catch {}
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        await shareAsync(uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Falha ao gerar/compartilhar PDF do item.');
    } finally {
      setIsExporting(false);
      setExportingId(null);
    }
  };

  const loadChecklist = async (id) => {
    try {
      const row = await getChecklist(id, userId);
      if (!row) return;
      const loaded = {
        nome: row.nome || '',
        ruaNumero: row.ruaNumero || row.ruanumero || '',
        locClienteLink: row.locClienteLink || row.locclientelink || '',
        locCtoLink: row.locCtoLink || row.locctolink || '',
        fotoCto: row.fotoCto || row.fotocto || null,
        fotoCtoDataUri: row.fotoCtoDataUri || row.fotoctodatauri || null,
        corFibra: row.corFibra || row.corfibra || '',
        possuiSplitter:
          row.possuiSplitter === 1 || row.possuisplitter === 1
            ? true
            : row.possuiSplitter === 0 || row.possuisplitter === 0
            ? false
            : null,
        portaCliente: row.portaCliente || row.portacliente || '',
        locCasaLink: row.locCasaLink || row.loccasalink || '',
        fotoFrenteCasa: row.fotoFrenteCasa || row.fotofrentecasa || null,
        fotoFrenteCasaDataUri: row.fotoFrenteCasaDataUri || row.fotofrentecasadatauri || null,
        fotoInstalacao: row.fotoInstalacao || row.fotoinstalacao || null,
        fotoInstalacaoDataUri: row.fotoInstalacaoDataUri || row.fotoinstalacaodatauri || null,
        fotoMacEquip: row.fotoMacEquip || row.fotomacequip || null,
        fotoMacEquipDataUri: row.fotoMacEquipDataUri || row.fotomacequipdatauri || null,
        nomeWifi: row.nomeWifi || row.nomewifi || '',
        senhaWifi: row.senhaWifi || row.senhawifi || '',
        testeNavegacaoOk:
          row.testeNavegacaoOk === 1 || row.testenavegacaook === 1
            ? true
            : row.testeNavegacaoOk === 0 || row.testenavegacaook === 0
            ? false
            : null,
        clienteSatisfeito:
          row.clienteSatisfeito === 1 || row.clientesatisfeito === 1
            ? true
            : row.clienteSatisfeito === 0 || row.clientesatisfeito === 0
            ? false
            : null,
      };
      setForm(loaded);
      setOriginalForm(loaded);
      setCurrentId(row.id);
      setMode('editor');
    } catch (e) {
      Alert.alert('Erro', 'Falha ao carregar checklist.');
    }
  };

  const onDeleteRequest = (id) => {
    setConfirmDeleteId(id);
    setDeleteModalVisible(true);
  };

  const onConfirmDelete = async () => {
    try {
      if (confirmDeleteId != null) {
        await deleteChecklist(confirmDeleteId, userId);
        await refreshList();
      if (confirmDeleteId === currentId) {
        resetForm();
      }
      setBannerType('error');
      setSaveModalMessage('Checklist deletado com sucesso.');
      setSaveModalVisible(true);
    }
    } finally {
      setDeleteModalVisible(false);
      setConfirmDeleteId(null);
    }
  };

  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const groupedMonths = useMemo(() => {
    const groups = {};
    for (const item of list) {
      const d = new Date(item.created_at);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      if (!groups[key]) groups[key] = { label: `${monthNames[m]} ${y}`, items: [] };
      groups[key].items.push(item);
    }
    // sort keys desc by year-month
    const sorted = Object.fromEntries(
      Object.entries(groups).sort(([a], [b]) => (a > b ? -1 : a < b ? 1 : 0))
    );
    return sorted;
  }, [list]);

  const [expandedMonths, setExpandedMonths] = useState({});

  const actionLabel = currentId ? 'Salvar Alterações' : 'Criar Checklist';
  const wantsAuthRoute = Platform.OS === 'web' && (route === '/login' || route === '/cadastrar' || route === '/reset');
  const effectiveMode = Platform.OS === 'web' && (!userId || wantsAuthRoute) ? 'auth' : mode;
  const canSubmit = currentId ? true : createReady;

  const Header = () => (
    <View style={styles.header}>
      <View style={styles.headerInner}>
        <Pressable
          style={[styles.headerIconBtn, styles.pointerCursor]}
          onPress={async () => {
            if (mode === 'auth') return;
            try {
              let firstN = '', lastN = '', phoneN = '', emailN = '', cpfN = '';
              const u = await getCurrentUser();
              const uid = u?.id || userId;
              emailN = u?.email || '';
              if (uid) {
                const p = await getProfile(uid);
                firstN = p?.first_name || '';
                lastN = p?.last_name || '';
                phoneN = p?.phone || '';
                cpfN = p?.cpf || '';
              }
              setEditFirstName(firstN);
              setEditLastName(lastN);
              setEditPhone(phoneN ? formatPhoneBR(phoneN) : '');
              setEditEmail(emailN || '');
              setEditNewPassword('');
              setShowEditPassword(false);
            } catch {}
            setEditUserModalVisible(true);
          }}
        >
          <MaterialCommunityIcons name="account-edit" size={40} color="#6b7280" />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8, marginLeft: 8 }}>
          {effectiveMode !== 'auth' ? (
            <>
              {effectiveMode === 'editor' ? (
                <Pressable style={styles.headerBtn} onPress={async () => { try { setIsNavigatingList(true); if (Platform.OS === 'web') { window.history.pushState({}, '', '/checklists'); setRoute('/checklists'); setMode('list'); } else { setMode('list'); } await refreshList(); } finally { setIsNavigatingList(false); } }}>
                  {isNavigatingList ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.headerBtnText}>Checklists</Text>
                  )}
                </Pressable>
              ) : (
                <Pressable style={styles.headerBtn} onPress={() => { resetUIForNew(); if (Platform.OS === 'web') { window.history.pushState({}, '', '/home'); setRoute('/home'); setMode('editor'); } else { setMode('editor'); } }}>
                  <Text style={styles.headerBtnText}>Voltar</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.headerBtn, styles.headerBtnLogout]}
                onPress={onLogout}
              >
                <Text style={styles.headerBtnText}>Sair</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}> 
        <Text>Carregando...</Text>
      </View>
    );
  }

  

  

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.container}>
      {effectiveMode === 'auth' ? (
        <LinearGradient
          colors={["#eef2ff", "#f8f9fc", "#eaf0ff"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.bgGradient}
        />
      ) : null}
      {effectiveMode !== 'auth' ? <Header /> : null}

      {/* Modal de confirmação de exclusão */}
      <Modal
        transparent
        visible={deleteModalVisible}
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Confirmar exclusão</Text>
            <Text style={styles.modalText}>Deseja deletar este checklist?</Text>
            <View style={[styles.row, { marginTop: 12 }]}>
              <Pressable style={[styles.btnSecondary, { flex: 1 }]} onPress={() => setDeleteModalVisible(false)}>
                <Text style={styles.btnSecondaryText}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.btnDanger, { flex: 1 }]} onPress={onConfirmDelete}>
                <Text style={styles.btnText}>Deletar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de edição do usuário */}
      <Modal
        transparent
        visible={editUserModalVisible}
        animationType="fade"
        onRequestClose={() => setEditUserModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <>
              <Text style={styles.modalTitle}>Editar perfil</Text>
              <TextInput
                style={styles.input}
                placeholder="Nome"
                placeholderTextColor="#9aa0b5"
                value={editFirstName}
                onChangeText={(t) => setEditFirstName(toTitleCase(t.replace(/[^A-Za-zÀ-ÿ\s'\-]/g, '')))}
                maxLength={50}
                autoCapitalize="words"
                autoCorrect={false}
              />
              <TextInput
                style={styles.input}
                placeholder="Sobrenome"
                placeholderTextColor="#9aa0b5"
                value={editLastName}
                onChangeText={(t) => setEditLastName(toTitleCase(t.replace(/[^A-Za-zÀ-ÿ\s'\-]/g, '')))}
                maxLength={50}
                autoCapitalize="words"
                autoCorrect={false}
              />
              <TextInput
                style={styles.input}
                placeholder="Telefone"
                placeholderTextColor="#9aa0b5"
                value={editPhone}
                onChangeText={(t) => setEditPhone(formatPhoneBR(t))}
                keyboardType="phone-pad"
                maxLength={20}
              />
              <TextInput
                style={styles.input}
                placeholder="E-mail"
                placeholderTextColor="#9aa0b5"
                value={editEmail}
                onChangeText={setEditEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, styles.inputWithIcon]}
                  placeholder="Nova senha (opcional)"
                  placeholderTextColor="#9aa0b5"
                  value={editNewPassword}
                  onChangeText={setEditNewPassword}
                  secureTextEntry={!showEditPassword}
                  autoComplete="off"
                  textContentType="none"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showEditPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  style={styles.inputIconBtn}
                  onPress={() => setShowEditPassword((v) => !v)}
                >
                  <Feather name={showEditPassword ? 'eye' : 'eye-off'} size={16} color="#666" />
                </Pressable>
              </View>
              {String(editNewPassword || '').length > 0 ? (
                <PasswordChecklist value={editNewPassword} />
              ) : null}
            </>
          <View style={styles.row}>
              <Pressable
                style={[styles.btnSecondary, { flex: 1 }]}
                onPress={() => setEditUserModalVisible(false)}
              >
                <Text style={styles.btnSecondaryText}>Cancelar</Text>
              </Pressable>
              {(() => {
                const firstName = (editFirstName || '').trim();
                const lastName = (editLastName || '').trim();
                const phoneDigits = (editPhone || '').replace(/\D+/g, '');
                const email = (editEmail || '').trim();
                const passOk = !editNewPassword || isStrongPassword(editNewPassword);
                const ready = !!firstName && !!lastName && phoneDigits.length === 11 && isValidEmail(email) && passOk;
                return (
                  <Pressable
                    style={[styles.btn, (!ready) && styles.btnDisabled, { flex: 1 }]}
                    disabled={!ready}
                    onPress={async () => {
                      try {
                        if (userId) {
                          await updateProfile(userId, { firstName, lastName, phone: phoneDigits });
                          await updateAuth({ email, password: editNewPassword || undefined, firstName, lastName, phone: phoneDigits });
                          setUserName([firstName, lastName].filter(Boolean).join(' '));
                        }
                        setEditUserModalVisible(false);
                        setBannerType('success');
                        setSaveModalMessage('Usuário atualizado com sucesso.');
                        setSaveModalVisible(true);
                      } catch (e) {
                        const msg = (e?.message || '').toLowerCase();
                        const pretty = e?.message || 'Falha ao atualizar usuário.';
                        setBannerType('error');
                        setSaveModalMessage(pretty);
                        setSaveModalVisible(true);
                      }
                    }}
                  >
                    <Text style={styles.btnText}>Salvar</Text>
                  </Pressable>
                );
              })()}
            </View>
          </View>
        </View>
      </Modal>

      

      {saveModalVisible ? (
        <View style={styles.bannerWrap}>
          <Animated.View style={[bannerType === 'error' ? styles.bannerBoxError : bannerType === 'warn' ? styles.bannerBoxWarn : styles.bannerBoxSuccess, { opacity: bannerOpacity }]}>
            <Text style={bannerType === 'error' ? styles.bannerTextError : bannerType === 'warn' ? styles.bannerTextWarn : styles.bannerTextSuccess}>{saveModalMessage}</Text>
          </Animated.View>
        </View>
      ) : null}

      {effectiveMode === 'auth' ? (
        <ScrollView contentContainerStyle={[styles.scrollContent, styles.scrollContentAuth]}>
          <View style={[styles.content, styles.contentAuth]}>
            <View style={styles.authBox}>
            
            <Text style={styles.title}>{authMode === 'login' ? 'Login' : authMode === 'register' ? 'Cadastrar' : authMode === 'reset' ? 'Recuperar senha' : 'Alterar senha'}</Text>
            
            {authMode === 'register' ? (
              <>
                <TextInput
                  style={styles.input}
                  value={authFirstName}
                  onChangeText={(t) => setAuthFirstName(toTitleCase(t.replace(/[^A-Za-zÀ-ÿ\s'\-]/g, '')))}
                  maxLength={50}
                  placeholder="Nome"
                  placeholderTextColor="#9aa0b5"
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                <TextInput
                  style={styles.input}
                  value={authLastName}
                  onChangeText={(t) => setAuthLastName(toTitleCase(t.replace(/[^A-Za-zÀ-ÿ\s'\-]/g, '')))}
                  maxLength={50}
                  placeholder="Sobrenome"
                  placeholderTextColor="#9aa0b5"
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                <TextInput
                  style={styles.input}
                  value={authPhone}
                  onChangeText={(t) => setAuthPhone(formatPhoneBR(t))}
                  keyboardType="phone-pad"
                  maxLength={20}
                  placeholder="Telefone"
                  placeholderTextColor="#9aa0b5"
                />
                <TextInput
                  style={styles.input}
                  value={authCpf}
                  onChangeText={(t) => setAuthCpf(formatCpfBR(t))}
                  keyboardType="number-pad"
                  maxLength={14}
                  placeholder="CPF"
                  placeholderTextColor="#9aa0b5"
                />
              </>
            ) : null}
            <TextInput
              style={styles.input}
              value={authEmail}
              onChangeText={setAuthEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="E-mail"
              placeholderTextColor="#9aa0b5"
              autoComplete="off"
              textContentType="none"
            />
            {authMode === 'register' ? (
              <>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={[styles.input, styles.inputWithIcon]}
                    value={authPassword}
                    onChangeText={setAuthPassword}
                    secureTextEntry={!showAuthPassword}
                    placeholder="Senha"
                    placeholderTextColor="#9aa0b5"
                    autoComplete="off"
                    textContentType="none"
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={showAuthPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    style={styles.inputIconBtn}
                    onPress={() => setShowAuthPassword((v) => !v)}
                  >
                    <Feather name={showAuthPassword ? 'eye' : 'eye-off'} size={16} color="#666" />
                  </Pressable>
                </View>
                <PasswordChecklist value={authPassword} />
              </>
            ) : authMode === 'login' ? (
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, styles.inputWithIcon]}
                  value={authPassword}
                  onChangeText={setAuthPassword}
                  secureTextEntry={!showAuthPassword}
                  placeholder="Senha"
                  placeholderTextColor="#9aa0b5"
                  autoComplete="off"
                  textContentType="none"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showAuthPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  style={styles.inputIconBtn}
                  onPress={() => setShowAuthPassword((v) => !v)}
                >
                  <Feather name={showAuthPassword ? 'eye' : 'eye-off'} size={16} color="#666" />
                </Pressable>
              </View>
            ) : authMode === 'update_password' ? (
              <>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={[styles.input, styles.inputWithIcon]}
                    value={authPassword}
                    onChangeText={setAuthPassword}
                    secureTextEntry={!showAuthPassword}
                    placeholder="Nova senha"
                    placeholderTextColor="#9aa0b5"
                    autoComplete="off"
                    textContentType="none"
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={showAuthPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    style={styles.inputIconBtn}
                    onPress={() => setShowAuthPassword((v) => !v)}
                  >
                    <Feather name={showAuthPassword ? 'eye' : 'eye-off'} size={16} color="#666" />
                  </Pressable>
                </View>
                <PasswordChecklist value={authPassword} />
                <TextInput
                  style={styles.input}
                  value={authPasswordConfirm}
                  onChangeText={setAuthPasswordConfirm}
                  secureTextEntry
                  placeholder="Confirmar nova senha"
                  placeholderTextColor="#9aa0b5"
                  autoComplete="off"
                  textContentType="none"
                />
              </>
            ) : null}
            {authMode === 'login' ? (
              <Pressable
                onPress={() => {
                  if (Platform.OS === 'web') {
                    window.history.pushState({}, '', '/reset');
                    setRoute('/reset');
                    setAuthMode('reset');
                    setMode('auth');
                  } else {
                    setAuthMode('reset');
                    setMode('auth');
                  }
                }}
                style={{ alignSelf: 'flex-start' }}
              >
                <Text style={styles.linkSmall}>Esqueci minha senha</Text>
              </Pressable>
            ) : null}
            
            {(() => {
              const email = (authEmail || '').trim();
              const phoneDigits = (authPhone || '').replace(/\D+/g, '');
              const cpfDigitsInline = (authCpf || '').replace(/\D+/g, '');
              const loginReady = isValidEmail(email) && (authPassword || '').length >= 12;
              const registerReady = isValidEmail(email) && isStrongPassword(authPassword) && phoneDigits.length >= 10 && phoneDigits.length <= 11 && !!authFirstName && !!authLastName && cpfDigitsInline.length === 11;
              const resetReady = isValidEmail(email);
              const updateReady = isStrongPassword(authPassword) && authPasswordConfirm === authPassword;
              return (
            <View style={styles.authActions}>
            <View style={[styles.row, authMode === 'reset' ? styles.rowReset : null]}>
              {authMode === 'login' ? (
                <Pressable style={[styles.btn, (!loginReady || isAuthSubmitting) && styles.btnDisabled, { flex: 1 }]} disabled={!loginReady || isAuthSubmitting} onPress={async () => {
                  setIsAuthSubmitting(true);
                  setErrorMessage(null);
                  try {
                    const email = authEmail.trim();
                    if (!isValidEmail(email)) {
                      setBannerType('warn');
                      setSaveModalMessage('E‑mail inválido.');
                      setSaveModalVisible(true);
                      return;
                    }
                    try { await signOut(); } catch {}
                    const loginRes = await signIn({ email: email, password: authPassword });
                    const u = loginRes?.user;
                    if (u && u.id) {
                      setUserIdState(u.id);
                      await setUserId(u.id);
                      try { if (Platform.OS === 'web' && typeof window !== 'undefined') { window.localStorage.setItem('sessionStartedAt', String(Date.now())); window.localStorage.setItem('sessionUserId', u.id); } } catch {}
                      try {
                        const p = await getProfile(u.id);
                        const nm = [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim();
                        setUserName(nm || p?.first_name || null);
                      } catch {}
                      setErrorMessage(null);
                      if (Platform.OS === 'web') {
                        setTimeout(() => {
                          window.history.pushState({}, '', '/home');
                          setRoute('/home');
                          setMode('editor');
                        }, 80);
                      } else {
                        setMode('editor');
                      }
                      await refreshList();
                    } else {
                      setErrorMessage('Não foi possível fazer login.');
                    }
                  } catch (e) {
                    setErrorMessage('Não foi possível fazer login.');
                  } finally { setIsAuthSubmitting(false); }
                }}>
                  {isAuthSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.btnText}>Entrar</Text>
                  )}
                </Pressable>
              ) : authMode === 'reset' ? (
                <Pressable style={[styles.btn, (!resetReady || isAuthSubmitting) && styles.btnDisabled, { flex: 1 }]} disabled={!resetReady || isAuthSubmitting} onPress={async () => {
                  const em = (authEmail || '').trim();
                  if (!isValidEmail(em)) {
                    setBannerType('warn');
                    setSaveModalMessage('Informe um e‑mail válido.');
                    setSaveModalVisible(true);
                    return;
                  }
                  setIsAuthSubmitting(true);
                  try {
                    setBannerType('success');
                    setSaveModalMessage('Se existir, enviaremos as instruções para redefinição no seu e-mail.');
                    setSaveModalVisible(true);
                    if (Platform.OS === 'web') {
                      window.history.pushState({}, '', '/login');
                      setRoute('/login');
                    }
                    setAuthMode('login');
                    setMode('auth');
                  } catch (e) {
                    setBannerType('error');
                    setSaveModalMessage('Tente novamente mais tarde.');
                    setSaveModalVisible(true);
                  } finally { setIsAuthSubmitting(false); }
                }}>
                  {isAuthSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.btnText}>Enviar</Text>
                  )}
                </Pressable>
              ) : authMode === 'update_password' ? (
                <Pressable style={[styles.btn, (!updateReady || isAuthSubmitting) && styles.btnDisabled, { flex: 1 }]} disabled={!updateReady || isAuthSubmitting} onPress={async () => {
                  setIsAuthSubmitting(true);
                  try {
                    if (!isStrongPassword(authPassword) || authPasswordConfirm !== authPassword) {
                      setBannerType('warn');
                      setSaveModalMessage('Verifique os requisitos e a confirmação da senha.');
                      setSaveModalVisible(true);
                      return;
                    }
                    await updateAuth({ password: authPassword });
                    setBannerType('success');
                    setSaveModalMessage('Senha atualizada com sucesso.');
                    setSaveModalVisible(true);
                    setAuthPassword('');
                    setAuthPasswordConfirm('');
                    if (Platform.OS === 'web') {
                      window.history.pushState({}, '', '/login');
                      setRoute('/login');
                    }
                    setAuthMode('login');
                    setMode('auth');
                  } catch (e) {
                    setBannerType('error');
                    setSaveModalMessage(e?.message || 'Falha ao atualizar senha.');
                    setSaveModalVisible(true);
                  } finally { setIsAuthSubmitting(false); }
                }}>
                  {isAuthSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.btnText}>Salvar nova senha</Text>
                  )}
                </Pressable>
              ) : (
                <Pressable style={[styles.btn, (!registerReady || isAuthSubmitting) && styles.btnDisabled, { flex: 1 }]} disabled={!registerReady || isAuthSubmitting} onPress={async () => {
                  setIsAuthSubmitting(true);
                  try {
                    const digits = (authPhone || '').replace(/\D+/g, '');
                    const cpfDigits = (authCpf || '').replace(/\D+/g, '');
                    if (!authFirstName || !authLastName || !authEmail || !authPassword || digits.length < 10 || digits.length > 11 || cpfDigits.length !== 11) {
                      setBannerType('warn');
                      setSaveModalMessage('Preencha todos os campos, telefone (10 ou 11 dígitos) e CPF completo (11 dígitos).');
                      setSaveModalVisible(true);
                      return;
                    }
                    const email = authEmail.trim();
                    if (!isValidEmail(email)) {
                      setBannerType('warn');
                      setSaveModalMessage('E‑mail inválido.');
                      setSaveModalVisible(true);
                      return;
                    }
                    if (!isStrongPassword(authPassword)) {
                      setBannerType('warn');
                      setSaveModalMessage('A senha precisa ter 12+ caracteres, letra maiúscula, número e caractere especial.');
                      setSaveModalVisible(true);
                      return;
                    }
                    try {
                      const existingCpf = await findUserByCpf(cpfDigits);
                      if (existingCpf) {
                        setBannerType('error');
                        setSaveModalMessage('CPF já cadastrado.');
                        setSaveModalVisible(true);
                        return;
                      }
                    } catch {}
                    const res = await signUp({ email: email, password: authPassword, firstName: authFirstName.trim(), lastName: authLastName.trim(), phone: authPhone.trim(), cpf: cpfDigits });
                    const u = res?.user;
                    const hasSession = !!res?.session;
                    if (hasSession && u && u.id) {
                      setUserIdState(u.id);
                      await setUserId(u.id);
                      setUserName(`${authFirstName.trim()} ${authLastName.trim()}`.trim());
                      setBannerType('success');
                      setSaveModalMessage('Conta criada com sucesso.');
                      setSaveModalVisible(true);
                      setAuthEmail(authEmail.trim());
                      setAuthPassword(authPassword);
                      setShowAuthPassword(false);
                      if (Platform.OS === 'web') {
                        window.history.pushState({}, '', '/login');
                        setRoute('/login');
                        setAuthMode('login');
                        setMode('auth');
                      } else {
                        setTimeout(() => {
                          setAuthMode('login');
                          setMode('auth');
                        }, 80);
                      }
                      await refreshList();
                    } else if (u && u.id && Platform.OS === 'web') {
                      setErrorMessage('Conta criada. Verifique seu e‑mail para confirmar e depois faça login.');
                      setAuthEmail(authEmail.trim());
                      setAuthPassword(authPassword);
                      setShowAuthPassword(false);
                      window.history.pushState({}, '', '/login');
                      setRoute('/login');
                      setAuthMode('login');
                      setMode('auth');
                    } else if (u && u.id && Platform.OS !== 'web') {
                      setErrorMessage('Conta criada. Verifique seu e‑mail para confirmar e depois faça login.');
                      setAuthEmail(authEmail.trim());
                      setAuthPassword(authPassword);
                      setShowAuthPassword(false);
                      setTimeout(() => {
                        setAuthMode('login');
                        setMode('auth');
                      }, 80);
                    } else {
                      const raw = (res?.error || '').toLowerCase();
                      const pretty = raw.includes('already') || raw.includes('exists') || raw.includes('registered') ? 'E‑mail já cadastrado.' : (res?.error || 'Não foi possível cadastrar.');
                      setBannerType('error');
                      setSaveModalMessage(pretty);
                      setSaveModalVisible(true);
                    }
                  } catch (e) {
                    setBannerType('error');
                    const raw = (e?.message || '').toLowerCase();
                    const pretty = raw.includes('already') || raw.includes('exists') || raw.includes('registered') ? 'E‑mail já cadastrado.' : (e?.message || 'Não foi possível cadastrar.');
                    setSaveModalMessage(pretty);
                    setSaveModalVisible(true);
                  } finally { setIsAuthSubmitting(false); }
                }}>
                  {isAuthSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.btnText}>Cadastrar</Text>
                  )}
                </Pressable>
              )}
            </View>
            <Pressable
              style={[styles.btnSecondary]}
              onPress={() => {
                if (Platform.OS === 'web') {
                  const to = authMode === 'login' ? '/cadastrar' : '/login';
                  window.history.pushState({}, '', to);
                  setRoute(to);
                  setAuthMode(authMode === 'login' ? 'register' : 'login');
                  setMode('auth');
                  clearAuthFields();
                } else {
                  setAuthMode(authMode === 'login' ? 'register' : 'login');
                  setMode('auth');
                  clearAuthFields();
                }
              }}
            >
              <Text style={styles.btnSecondaryText}>{(authMode === 'reset' || authMode === 'update_password') ? 'Voltar ao login' : authMode === 'login' ? 'Criar conta' : 'Já tenho conta'}</Text>
            </Pressable>
            </View>
              );
            })()}
            </View>
          </View>
        </ScrollView>
      ) : effectiveMode === 'list' ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <Text style={styles.title}>Checklists</Text>
            {Object.keys(groupedMonths).length === 0 && (
              <Text style={styles.emptyListText}>Nenhum checklist pra exibir ainda.</Text>
            )}
            {Object.entries(groupedMonths).map(([key, group]) => (
              <Section
                key={key}
                title={group.label}
                expanded={!!expandedMonths[key]}
                onToggle={() => setExpandedMonths((prev) => ({ ...prev, [key]: !prev[key] }))}
              >
                <View style={{ marginTop: 4 }}>
                  {group.items.map((it) => (
                    <View key={it.id} style={styles.listItem}>
                      <Pressable style={{ flex: 1 }} onPress={() => loadChecklist(it.id)}>
                        <Text style={styles.listItemTitle} numberOfLines={1} ellipsizeMode="tail">{it.nome || 'Sem nome'}</Text>
                        <Text style={styles.listItemSub}>{new Date(it.created_at).toLocaleDateString('pt-BR')} • {new Date(it.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text>
                      </Pressable>
                      <Pressable style={[styles.btnSecondary, styles.btnInlineSm]} disabled={isExporting && exportingId === it.id} onPress={() => onExportPdfItem(it.id)}>
                        <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                          {isExporting && exportingId === it.id ? (
                            <ActivityIndicator color="#2f6fed" style={{ position: 'absolute' }} />
                          ) : null}
                          <Text style={[styles.btnSecondaryText, isExporting && exportingId === it.id ? { opacity: 0 } : null]}>Exportar</Text>
                        </View>
                      </Pressable>
                      <Pressable style={[styles.delBtn, styles.btnInlineSm]} onPress={() => onDeleteRequest(it.id)}>
                        <Text style={styles.delBtnText}>Deletar</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </Section>
            ))}
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
        {/* Removido o rótulo "Usuário:"; nome agora aparece no topo */}

          {/* 1) Dados do cliente */}
          <Section
            title="1️⃣ Dados do cliente"
            expanded={expanded.cliente}
            onToggle={() => setExpanded((e) => ({ ...e, cliente: !e.cliente }))}
          >
            <Text style={styles.label}>👤 Nome completo</Text>
            <TextInput
              style={styles.input}
              placeholder="Nome completo"
              placeholderTextColor="#9aa0b5"
              value={form.nome}
              onChangeText={(t) => setField('nome', toTitleCase(t.replace(/[^A-Za-zÀ-ÿ\s'\-]/g, '')))}
              maxLength={50}
              keyboardType="default"
              autoCapitalize="words"
              textContentType="name"
              autoCorrect={false}
              spellCheck={false}
            />

            <Text style={styles.label}>🏠 Rua e número</Text>
            <TextInput
              style={styles.input}
              placeholder="Rua e número"
              placeholderTextColor="#9aa0b5"
              value={form.ruaNumero}
              onChangeText={(t) => setField('ruaNumero', toTitleCase(t))}
              maxLength={50}
            />

            <Text style={styles.label}>📍 Localização (link do Maps)</Text>
            <View style={{ flex: 1 }}>
              <TextInput
                style={[
                  styles.input,
                  styles.inputInline,
                  { flex: 1 },
                  form.locClienteLink ? styles.inputLinkReady : null,
                  Platform.OS === 'web' && form.locClienteLink ? styles.pointerCursor : null,
                ]}
                placeholder="https://www.google.com/maps?..."
                placeholderTextColor="#9aa0b5"
                value={form.locClienteLink}
                onChangeText={() => {}}
                editable={Platform.OS === 'web' ? false : true}
                showSoftInputOnFocus={Platform.OS === 'web' ? undefined : false}
                selectTextOnFocus={false}
                caretHidden
                ref={locClienteRef}
                onFocus={() => {
                  try { locClienteRef.current?.blur(); } catch {}
                  if (form.locClienteLink) {
                    if (Platform.OS === 'web') {
                      const ok = window.confirm('Abrir o link no Google Maps?');
                      if (ok) { window.open(form.locClienteLink, '_blank', 'noopener,noreferrer'); }
                    } else {
                      Alert.alert('Abrir no Maps', 'Deseja abrir o link no Google Maps?', [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Abrir', onPress: () => Linking.openURL(form.locClienteLink) },
                      ]);
                    }
                  }
                }}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
              />
            </View>
            <View style={styles.rowSpaceBetween}>
              <Pressable style={[styles.btn, styles.btnInlineFluid]} onPress={() => useCurrentLocation('locClienteLink')} disabled={isLocating}>
                <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                  {isLocating && locatingKey === 'locClienteLink' ? (
                    <ActivityIndicator color="#fff" style={{ position: 'absolute' }} />
                  ) : null}
                  <Text style={[styles.btnText, isLocating && locatingKey === 'locClienteLink' ? { opacity: 0 } : null]}>Puxar Localização</Text>
                </View>
              </Pressable>
              <Pressable style={[styles.btnSecondary, styles.btnInlineFluid]} onPress={() => pasteFromMaps('locClienteLink')}>
                <Text style={styles.btnSecondaryText}>Colar do Maps</Text>
              </Pressable>
            </View>
          </Section>

          {/* 2) CTO / Rede externa */}
          <Section
            title="2️⃣ CTO / rede externa"
            expanded={expanded.cto}
            onToggle={() => setExpanded((e) => ({ ...e, cto: !e.cto }))}
          >
            <Text style={styles.label}>📍 Localização da CTO (link do Maps)</Text>
            <View style={{ flex: 1 }}>
              <TextInput
                style={[
                  styles.input,
                  styles.inputInline,
                  { flex: 1 },
                  form.locCtoLink ? styles.inputLinkReady : null,
                  Platform.OS === 'web' && form.locCtoLink ? styles.pointerCursor : null,
                ]}
                placeholder="https://www.google.com/maps?..."
                placeholderTextColor="#9aa0b5"
                value={form.locCtoLink}
                onChangeText={() => {}}
                editable={Platform.OS === 'web' ? false : true}
                showSoftInputOnFocus={Platform.OS === 'web' ? undefined : false}
                selectTextOnFocus={false}
                caretHidden
                ref={locCtoRef}
                onFocus={() => {
                  try { locCtoRef.current?.blur(); } catch {}
                  if (form.locCtoLink) {
                    if (Platform.OS === 'web') {
                      const ok = window.confirm('Abrir o link no Google Maps?');
                      if (ok) { window.open(form.locCtoLink, '_blank', 'noopener,noreferrer'); }
                    } else {
                      Alert.alert('Abrir no Maps', 'Deseja abrir o link no Google Maps?', [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Abrir', onPress: () => Linking.openURL(form.locCtoLink) },
                      ]);
                    }
                  }
                }}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
              />
            </View>
            <View style={styles.rowSpaceBetween}>
              <Pressable style={[styles.btn, styles.btnInlineFluid]} onPress={() => useCurrentLocation('locCtoLink')} disabled={isLocating}>
                <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                  {isLocating && locatingKey === 'locCtoLink' ? (
                    <ActivityIndicator color="#fff" style={{ position: 'absolute' }} />
                  ) : null}
                  <Text style={[styles.btnText, isLocating && locatingKey === 'locCtoLink' ? { opacity: 0 } : null]}>Puxar Localização</Text>
                </View>
              </Pressable>
              <Pressable style={[styles.btnSecondary, styles.btnInlineFluid]} onPress={() => pasteFromMaps('locCtoLink')}>
                <Text style={styles.btnSecondaryText}>Colar do Maps</Text>
              </Pressable>
            </View>

            <Text style={styles.label}>📸 Foto da CTO</Text>
            {form.fotoCto || form.fotoCtoDataUri ? (
              <View style={styles.imageWrapper}>
                <Image source={{ uri: form.fotoCto || form.fotoCtoDataUri }} style={styles.image} resizeMode="cover" />
                <Pressable style={styles.closeBadge} onPress={() => setForm({ ...form, fotoCto: null, fotoCtoDataUri: null })}>
                  <Text style={styles.closeBadgeText}>×</Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable style={[styles.btn, styles.btnCapture, { marginBottom: 12 }]} onPress={() => askCameraAndPick('fotoCto')}>
              <Text style={styles.btnText}>Capturar/Selecionar Foto</Text>
            </Pressable>

            <Text style={styles.label}>🎨 Cor da fibra</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex.: Amarela, Azul..."
              placeholderTextColor="#9aa0b5"
              value={form.corFibra}
              onChangeText={(t) => setField('corFibra', toTitleCase(t.replace(/[^A-Za-zÀ-ÿ\s'\-]/g, '')))}
              maxLength={20}
              keyboardType="default"
              autoCapitalize="words"
              textContentType="none"
              autoCorrect={false}
              spellCheck={false}
            />

            <Text style={styles.label}>🔀 Possui splitter?</Text>
            <ToggleYesNo value={form.possuiSplitter} onChange={(v) => setField('possuiSplitter', v)} />

            <Text style={styles.label}>🔌 Número da porta utilizada pelo cliente</Text>
            <TextInput
              style={styles.input}
              placeholder="Porta"
              placeholderTextColor="#9aa0b5"
              value={form.portaCliente}
              onChangeText={(t) => setField('portaCliente', t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={8}
            />
          </Section>

          {/* 3) Casa do cliente */}
          <Section
            title="3️⃣ Casa do cliente"
            expanded={expanded.casa}
            onToggle={() => setExpanded((e) => ({ ...e, casa: !e.casa }))}
          >
            <Text style={styles.label}>📍 Localização da casa (link do Maps)</Text>
            <View style={{ flex: 1 }}>
              <TextInput
                style={[
                  styles.input,
                  styles.inputInline,
                  { flex: 1 },
                  form.locCasaLink ? styles.inputLinkReady : null,
                  Platform.OS === 'web' && form.locCasaLink ? styles.pointerCursor : null,
                ]}
                placeholder="https://www.google.com/maps?..."
                placeholderTextColor="#9aa0b5"
                value={form.locCasaLink}
                onChangeText={() => {}}
                editable={Platform.OS === 'web' ? false : true}
                showSoftInputOnFocus={Platform.OS === 'web' ? undefined : false}
                selectTextOnFocus={false}
                caretHidden
                ref={locCasaRef}
                onFocus={() => {
                  try { locCasaRef.current?.blur(); } catch {}
                  if (form.locCasaLink) {
                    if (Platform.OS === 'web') {
                      const ok = window.confirm('Abrir o link no Google Maps?');
                      if (ok) { window.open(form.locCasaLink, '_blank', 'noopener,noreferrer'); }
                    } else {
                      Alert.alert('Abrir no Maps', 'Deseja abrir o link no Google Maps?', [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Abrir', onPress: () => Linking.openURL(form.locCasaLink) },
                      ]);
                    }
                  }
                }}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
              />
            </View>
            <View style={styles.rowSpaceBetween}>
              <Pressable style={[styles.btn, styles.btnInlineFluid]} onPress={() => useCurrentLocation('locCasaLink')} disabled={isLocating}>
                <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                  {isLocating && locatingKey === 'locCasaLink' ? (
                    <ActivityIndicator color="#fff" style={{ position: 'absolute' }} />
                  ) : null}
                  <Text style={[styles.btnText, isLocating && locatingKey === 'locCasaLink' ? { opacity: 0 } : null]}>Puxar Localização</Text>
                </View>
              </Pressable>
              <Pressable style={[styles.btnSecondary, styles.btnInlineFluid]} onPress={() => pasteFromMaps('locCasaLink')}>
                <Text style={styles.btnSecondaryText}>Colar do Maps</Text>
              </Pressable>
            </View>

            <Text style={styles.label}>🏘 Foto da frente da casa</Text>
            {form.fotoFrenteCasa || form.fotoFrenteCasaDataUri ? (
              <View style={styles.imageWrapper}>
                <Image source={{ uri: form.fotoFrenteCasa || form.fotoFrenteCasaDataUri }} style={styles.image} resizeMode="cover" />
                <Pressable style={styles.closeBadge} onPress={() => setForm({ ...form, fotoFrenteCasa: null, fotoFrenteCasaDataUri: null })}>
                  <Text style={styles.closeBadgeText}>×</Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable style={[styles.btn, styles.btnCapture, { marginBottom: 12 }]} onPress={() => askCameraAndPick('fotoFrenteCasa')}>
              <Text style={styles.btnText}>Capturar/Selecionar Foto</Text>
            </Pressable>
          </Section>

          {/* 4) Instalação interna */}
          <Section
            title="4️⃣ Instalação interna"
            expanded={expanded.interna}
            onToggle={() => setExpanded((e) => ({ ...e, interna: !e.interna }))}
          >
            <Text style={styles.label}>🧰 Foto da instalação do equipamento (ONT/Router)</Text>
            {form.fotoInstalacao || form.fotoInstalacaoDataUri ? (
              <View style={styles.imageWrapper}>
                <Image source={{ uri: form.fotoInstalacao || form.fotoInstalacaoDataUri }} style={styles.image} resizeMode="cover" />
                <Pressable style={styles.closeBadge} onPress={() => setForm({ ...form, fotoInstalacao: null, fotoInstalacaoDataUri: null })}>
                  <Text style={styles.closeBadgeText}>×</Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable style={[styles.btn, styles.btnCapture, { marginBottom: 12 }]} onPress={() => askCameraAndPick('fotoInstalacao')}>
              <Text style={styles.btnText}>Capturar/Selecionar Foto</Text>
            </Pressable>

            <Text style={styles.label}>🏷 Foto do MAC do equipamento</Text>
            {form.fotoMacEquip || form.fotoMacEquipDataUri ? (
              <View style={styles.imageWrapper}>
                <Image source={{ uri: form.fotoMacEquip || form.fotoMacEquipDataUri }} style={styles.image} resizeMode="cover" />
                <Pressable style={styles.closeBadge} onPress={() => setForm({ ...form, fotoMacEquip: null, fotoMacEquipDataUri: null })}>
                  <Text style={styles.closeBadgeText}>×</Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable style={[styles.btn, styles.btnCapture, { marginBottom: 12 }]} onPress={() => askCameraAndPick('fotoMacEquip')}>
              <Text style={styles.btnText}>Capturar/Selecionar Foto</Text>
            </Pressable>

            <Text style={styles.label}>💡 Nome do Wi-Fi</Text>
            <TextInput
              style={styles.input}
              placeholder="SSID"
              placeholderTextColor="#9aa0b5"
              value={form.nomeWifi}
              onChangeText={(t) => setField('nomeWifi', t)}
              autoComplete="off"
              textContentType="none"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              maxLength={32}
            />

            <Text style={styles.label}>🔑 Senha do Wi-Fi</Text>
            <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, styles.inputWithIcon]}
              placeholder="Senha"
              placeholderTextColor="#9aa0b5"
              secureTextEntry={!showWifiPassword}
              value={form.senhaWifi}
              onChangeText={(t) => setField('senhaWifi', t)}
              autoComplete="off"
              textContentType="oneTimeCode"
              autoCorrect={false}
              spellCheck={false}
              ref={senhaWifiRef}
              maxLength={32}
            />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showWifiPassword ? 'Ocultar senha' : 'Mostrar senha'}
                style={styles.inputIconBtn}
                onPress={() => setShowWifiPassword((v) => !v)}
              >
                <Feather name={showWifiPassword ? 'eye' : 'eye-off'} size={16} color="#666" />
              </Pressable>
            </View>
          </Section>

          {/* 5) Finalização */}
          <Section
            title="5️⃣ Finalização"
            expanded={expanded.finalizacao}
            onToggle={() => setExpanded((e) => ({ ...e, finalizacao: !e.finalizacao }))}
          >
            <Text style={styles.label}>🌐 Teste de navegação realizado com sucesso?</Text>
            <ToggleYesNo value={form.testeNavegacaoOk} onChange={(v) => setField('testeNavegacaoOk', v)} />

            <Text style={styles.label}>📞 Cliente ciente e satisfeito com o serviço?</Text>
            <ToggleYesNo value={form.clienteSatisfeito} onChange={(v) => setField('clienteSatisfeito', v)} />
          </Section>

          <View />
          <View style={styles.btnGroup}>
            <Pressable
              style={[
                styles.btn,
                { width: '100%' },
                (isSaving || !canSubmit) && styles.btnDisabled,
              ]}
              onPress={onSave}
              disabled={isSaving || !canSubmit}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.btnText}>{actionLabel}</Text>
              )}
            </Pressable>

            {(hasChanges && (!currentId || Platform.OS === 'web')) ? (
              <Pressable
                style={[styles.btnSecondary, { width: '100%' }]}
                onPress={() => {
                  resetUIForNew();
                  setCurrentId(null);
                  if (Platform.OS === 'web') {
                    window.history.pushState({}, '', '/home');
                    setRoute('/home');
                    setMode('editor');
                  } else {
                    setMode('editor');
                  }
                }}
              >
                <Text style={styles.btnSecondaryText}>Limpar Campos</Text>
              </Pressable>
            ) : null}

            {currentId ? (
              <Pressable
                style={[styles.btnSecondary, { width: '100%' }]}
                onPress={() => {
                  resetUIForNew();
                  setCurrentId(null);
                  if (Platform.OS === 'web') {
                    window.history.pushState({}, '', '/home');
                    setRoute('/home');
                    setMode('editor');
                  } else {
                    setMode('editor');
                  }
                }}
              >
                <Text style={styles.btnSecondaryText}>Novo Checklist</Text>
              </Pressable>
            ) : null}

            {currentId ? (
              <Pressable
                style={[styles.btnDanger, { width: '100%' }]}
                onPress={() => onDeleteRequest(currentId)}
              >
                <Text style={styles.btnText}>Deletar Checklist</Text>
              </Pressable>
            ) : null}
          </View>

          {null}

          <View style={{ height: 24 }} />
        </View>
        </ScrollView>
      )}
      
      <StatusBar style="auto" />
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fc',
  },
  bgGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  header: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    //posicao da barra superior
    marginTop: Platform.OS === 'web' ? 0 : 40,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 800,
    alignSelf: Platform.OS === 'web' ? 'center' : 'auto',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
  },
  headerLabel: {
    color: '#555',
    fontWeight: '600',
  },
  headerBtn: {
    backgroundColor: '#2f6fed',
    paddingHorizontal: 10,
    paddingVertical: 0,
    borderRadius: 8,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
    },
  headerBtnLogout: {
    backgroundColor: '#e53e3e',
    borderColor: '#e53e3e',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  scrollContentAuth: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 24,
  },
  content: {
    width: '100%',
    maxWidth: 800,
    alignSelf: Platform.OS === 'web' ? 'center' : 'auto',
  },
  contentAuth: {
    maxWidth: Platform.OS === 'web' ? 420 : 600,
    alignSelf: 'center',
  },
  authBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    boxShadow: Platform.OS === 'web' ? '0 8px 24px rgba(0,0,0,0.08)' : undefined,
    shadowColor: Platform.OS === 'web' ? undefined : '#000',
    shadowOpacity: Platform.OS === 'web' ? undefined : 0.08,
    shadowRadius: Platform.OS === 'web' ? undefined : 12,
    shadowOffset: Platform.OS === 'web' ? undefined : { width: 0, height: 6 },
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#222',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#222',
  },
  modalText: {
    fontSize: 14,
    color: '#444',
    marginBottom: 8,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    shadowColor: Platform.OS === 'web' ? undefined : '#000',
    shadowOpacity: Platform.OS === 'web' ? undefined : 0.06,
    shadowRadius: Platform.OS === 'web' ? undefined : 6,
    shadowOffset: Platform.OS === 'web' ? undefined : { width: 0, height: 2 },
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sectionToggle: {
    fontSize: 16,
    color: '#777',
  },
  sectionBody: {
    marginTop: 12,
  },
  emptyListText: {
    color: '#666',
  },
  label: {
    fontSize: 13,
    color: '#444',
    marginBottom: 6,
    marginTop: 4,
  },
  labelMuted: {
    color: '#9aa0b5',
  },
  input: {
    backgroundColor: '#f7f8fc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 10 : 10,
    fontSize: Platform.OS === 'web' ? 16 : 14,
    color: '#222',
    marginBottom: 8,
  },
  inputInline: {
    marginBottom: 0,
    height: Platform.OS === 'web' ? 36 : 36,
    paddingVertical: Platform.OS === 'web' ? 6 : 6,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  inputEmpty: {
    backgroundColor: '#eef2ff',
  },
  inputWithIcon: {
    paddingRight: 48,
  },
  inputLinkReady: {
    color: '#1e40af',
    fontWeight: '600',
  },
  pointerCursor: Platform.OS === 'web' ? { cursor: 'pointer' } : {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  rowReset: {
    marginTop: 8,
    marginBottom: 8,
  },
  rowSpaceBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  inputWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  inputIconBtn: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -12 }],
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    minWidth: 28,
  },
  inputIconText: {
    fontSize: 16,
  },
  inputHelpError: {
    fontSize: 12,
    color: '#b91c1c',
    marginTop: 4,
    marginBottom: 6,
  },
  inputHelpArea: {
    minHeight: 22,
    marginTop: 4,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: '#2f6fed',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnInline: {
    height: 36,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    minWidth: 100,
    flexShrink: 0,
  },
  btnInlineSm: {
    height: 32,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    minWidth: 88,
    flexShrink: 0,
  },
  btnInlineFluid: {
    height: 36,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    flex: 1,
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
    textAlign: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnSecondary: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d7defa',
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: '#2f6fed',
    fontWeight: '600',
    fontSize: 12,
    textAlign: 'center',
  },
  btnDanger: {
    backgroundColor: '#e53e3e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnCapture: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 0,
  },
  image: {
    width: '100%',
    height: Platform.OS === 'web' ? 220 : 180,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#e9ecf3',
  },
  imageWrapper: {
    position: 'relative',
  },
  closeBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBadgeText: {
    color: '#fff',
    fontWeight: '700',
    lineHeight: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  toggleBtn: {
    flex: 1,
    backgroundColor: '#eef2ff',
    paddingVertical: 6,
    minHeight: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d7defa',
  },
  toggleActive: {
    backgroundColor: '#2f6fed',
    borderColor: '#2f6fed',
  },
  toggleText: {
    color: '#2f6fed',
    fontWeight: '600',
    fontSize: 12,
  },
  toggleTextActive: {
    color: '#fff',
  },
  linkSmall: {
    fontSize: 12,
    color: '#2f6fed',
    textDecorationLine: 'none',
    marginTop: 4,
    marginBottom: 8,
    marginLeft: 0,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  listItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
  },
  listItemSub: {
    fontSize: 12,
    color: '#666',
  },
  delBtn: {
    backgroundColor: '#e53e3e',
    borderRadius: 8,
  },
  delBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  bannerWrap: {
    position: 'absolute',
    //posicao do banner no topo da tela
    top: Platform.OS === 'web' ? 12 : 44,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 3,
    pointerEvents: 'none',
    alignItems: 'center',
  },
  btnGroup: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  authActions: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 8,
  },
  bannerBoxSuccess: {
    backgroundColor: '#e6f6ea',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    boxShadow: Platform.OS === 'web' ? '0 6px 16px rgba(0,0,0,0.08)' : undefined,
    shadowColor: Platform.OS === 'web' ? undefined : '#000',
    shadowOpacity: Platform.OS === 'web' ? undefined : 0.08,
    shadowRadius: Platform.OS === 'web' ? undefined : 10,
    shadowOffset: Platform.OS === 'web' ? undefined : { width: 0, height: 4 },
    borderWidth: Platform.OS === 'web' ? 1 : 0,
    borderColor: '#b7e3c7',
    maxWidth: Platform.OS === 'web' ? 360 : '90%',
  },
  bannerTextSuccess: {
    fontSize: Platform.OS === 'web' ? 14 : 13,
    color: '#166534',
    textAlign: 'center',
    fontWeight: '700',
  },
  bannerBoxWarn: {
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    boxShadow: Platform.OS === 'web' ? '0 6px 16px rgba(0,0,0,0.08)' : undefined,
    shadowColor: Platform.OS === 'web' ? undefined : '#000',
    shadowOpacity: Platform.OS === 'web' ? undefined : 0.08,
    shadowRadius: Platform.OS === 'web' ? undefined : 10,
    shadowOffset: Platform.OS === 'web' ? undefined : { width: 0, height: 4 },
    borderWidth: Platform.OS === 'web' ? 1 : 0,
    borderColor: '#fde68a',
    maxWidth: Platform.OS === 'web' ? 360 : '90%',
  },
  bannerTextWarn: {
    fontSize: Platform.OS === 'web' ? 14 : 13,
    color: '#7c2d12',
    textAlign: 'center',
    fontWeight: '700',
  },
  bannerBoxError: {
    backgroundColor: '#fde8e8',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    boxShadow: Platform.OS === 'web' ? '0 6px 16px rgba(0,0,0,0.08)' : undefined,
    shadowColor: Platform.OS === 'web' ? undefined : '#000',
    shadowOpacity: Platform.OS === 'web' ? undefined : 0.08,
    shadowRadius: Platform.OS === 'web' ? undefined : 10,
    shadowOffset: Platform.OS === 'web' ? undefined : { width: 0, height: 4 },
    borderWidth: Platform.OS === 'web' ? 1 : 0,
    borderColor: '#f4b7b7',
    maxWidth: Platform.OS === 'web' ? 360 : '90%',
  },
  bannerTextError: {
    fontSize: Platform.OS === 'web' ? 14 : 13,
    color: '#7f1d1d',
    textAlign: 'center',
    fontWeight: '700',
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2f6fed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#dbe5ff',
  },
  headerIconBtn: {
    height: 40,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 420 : 600,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    boxShadow: Platform.OS === 'web' ? '0 8px 24px rgba(0,0,0,0.16)' : undefined,
    shadowColor: Platform.OS === 'web' ? undefined : '#000',
    shadowOpacity: Platform.OS === 'web' ? undefined : 0.12,
    shadowRadius: Platform.OS === 'web' ? undefined : 16,
    shadowOffset: Platform.OS === 'web' ? undefined : { width: 0, height: 8 },
  },
});
