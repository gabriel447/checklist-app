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
  import * as FileSystem from 'expo-file-system';
  import { shareAsync } from 'expo-sharing';
  import { Feather } from '@expo/vector-icons';
  import {
    initDB,
    getOrCreateUserId,
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
} from './db';

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
const isStrongPassword = (s) => {
  if (!s || s.length < 12) return false;
  if (!/[A-Za-z]/.test(s)) return false;
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


const Section = ({ title, children, expanded, onToggle }) => (
  <View style={styles.section}>
    <Pressable onPress={onToggle} style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionToggle}>{expanded ? '▲' : '▼'}</Text>
    </Pressable>
    {expanded && <View style={styles.sectionBody}>{children}</View>}
  </View>
);

export default function App() {
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
    ? ((initialUserIdWeb && typeof window !== 'undefined' && window.location && window.location.pathname && window.location.pathname !== '/login' && window.location.pathname !== '/cadastrar') ? 'editor' : 'auth')
    : 'editor';
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
  const [authFirstName, setAuthFirstName] = useState('');
  const [authLastName, setAuthLastName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [userId, setUserIdState] = useState(initialUserIdWeb);
  const [userName, setUserName] = useState(null);
  const [currentId, setCurrentId] = useState(null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [route, setRoute] = useState(
    Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.pathname || '/home' : '/home'
  );

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [saveModalMessage, setSaveModalMessage] = useState('');
  const [bannerType, setBannerType] = useState('success');
  const [editUserModalVisible, setEditUserModalVisible] = useState(false);
  const [editUserName, setEditUserName] = useState('');
  const [showWifiPassword, setShowWifiPassword] = useState(false);
  const senhaWifiRef = useRef(null);
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const bannerTimerRef = useRef(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locatingKey, setLocatingKey] = useState(null);
  const [isNavigatingList, setIsNavigatingList] = useState(false);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const locClienteRef = useRef(null);
  const locCtoRef = useRef(null);
  const locCasaRef = useRef(null);

  const clearAuthFields = () => {
    setAuthEmail('');
    setAuthPassword('');
    setAuthFirstName('');
    setAuthLastName('');
    setAuthPhone('');
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
          const uid = await getOrCreateUserId();
          setUserIdState(uid);
          await refreshList();
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
        } else if (p === '/checklists') {
          setMode('list');
        } else {
          setMode('editor');
        }
      };
      window.addEventListener('popstate', sync);
      return () => window.removeEventListener('popstate', sync);
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
    const rows = await listChecklists();
    setList(rows);
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
      setForm((prev) => ({
        ...prev,
        [fieldKey]: uri,
        ...(dataKey && b64 ? { [dataKey]: `data:${mime};base64,${b64}` } : {}),
      }));
    }
  };

  const useCurrentLocation = async (fieldKey) => {
    setIsLocating(true);
    setLocatingKey(fieldKey);
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
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
        if (status !== 'granted') { return; }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
        const { latitude, longitude } = pos.coords;
        setField(fieldKey, `https://www.google.com/maps?q=${latitude},${longitude}`);
      }
    } catch {}
    finally {
      setIsLocating(false);
      setLocatingKey(null);
    }
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
      const prevShow = showWifiPassword;
      setShowWifiPassword(true);
      senhaWifiRef.current?.blur();
      await new Promise((r) => setTimeout(r, 50));
      if (!userId) return;
      if (!currentId) {
        const id = await saveChecklist(form, userId);
        setCurrentId(id);
        setOriginalForm(form);
        setSaveModalMessage('Checklist criado com sucesso.');
        setSaveModalVisible(true);
        resetUIForNew();
      } else {
        await updateChecklist(currentId, form);
        setOriginalForm(form);
        setSaveModalMessage('Checklist atualizado com sucesso.');
        setSaveModalVisible(true);
      }
      await refreshList();
      setShowWifiPassword(prevShow);
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível salvar.');
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
      form.clienteSatisfeito !== null
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
            <div class="title">Checklist de Instalação / Reparo</div>
            <div class="meta">${new Date().toLocaleString()}</div>
          </div>
          <div class="card">
            <div class="row"><span class="label">Usuário:</span> ${userId || ''}</div>
          </div>

          <div class="card">
            <div class="cardHeader"><div><span class="badge">1</span><span class="cardTitle">Dados do cliente</span></div></div>
            <div class="row"><span class="label">Nome completo:</span> ${capitalizeWords(form.nome) || ''}</div>
            <div class="row"><span class="label">Rua e número:</span> ${form.ruaNumero || ''}</div>
            <div class="row"><span class="label">Localização (link do Maps):</span> <span class="link">${form.locClienteLink ? `<a href="${form.locClienteLink}">${form.locClienteLink}</a>` : ''}</span></div>
          </div>

          <div class="card">
            <div class="cardHeader"><div><span class="badge">2</span><span class="cardTitle">CTO / rede externa</span></div></div>
            <div class="row"><span class="label">Localização da CTO (link do Maps):</span> <span class="link">${form.locCtoLink ? `<a href="${form.locCtoLink}">${form.locCtoLink}</a>` : ''}</span></div>
            ${imgCto ? `<div class="row"><span class="label">Foto da CTO</span></div><div class="figure"><img class="img" src="${imgCto}" alt="Foto da CTO" /></div>` : ''}
            <div class="row"><span class="label">Cor da fibra:</span> ${form.corFibra || ''}</div>
            <div class="row"><span class="label">Possui splitter?</span> ${yesNo(form.possuiSplitter)}</div>
            <div class="row"><span class="label">Número da porta utilizada pelo cliente:</span> ${form.portaCliente || ''}</div>
          </div>

          <div class="card">
            <div class="cardHeader"><div><span class="badge">3</span><span class="cardTitle">Casa do cliente</span></div></div>
            <div class="row"><span class="label">Localização da casa (link do Maps):</span> <span class="link">${form.locCasaLink ? `<a href="${form.locCasaLink}">${form.locCasaLink}</a>` : ''}</span></div>
            ${imgCasa ? `<div class="row"><span class="label">Foto da frente da casa</span></div><div class="figure"><img class="img" src="${imgCasa}" alt="Foto da frente da casa" /></div>` : ''}
          </div>

          <div class="card card4">
            <div class="cardHeader"><div><span class="badge">4</span><span class="cardTitle">Instalação interna</span></div></div>
            ${imgInst ? `<div class="row"><span class="label">Foto da instalação do equipamento (ONT/Router)</span></div><div class="figure"><img class="img" src="${imgInst}" alt="Foto da instalação do equipamento (ONT/Router)" /></div>` : ''}
            ${imgMac ? `<div class="row"><span class="label">Foto do MAC do equipamento</span></div><div class="figure"><img class="img" src="${imgMac}" alt="Foto do MAC do equipamento" /></div>` : ''}
            <div class="row"><span class="label">Nome do Wi‑Fi:</span> ${form.nomeWifi || ''}</div>
            <div class="row"><span class="label">Senha do Wi‑Fi:</span> ${form.senhaWifi || ''}</div>
          </div>

          <div class="card">
            <div class="cardHeader"><div><span class="badge">5</span><span class="cardTitle">Finalização</span></div></div>
            <div class="row"><span class="label">Teste de navegação realizado com sucesso?</span> ${yesNo(form.testeNavegacaoOk)}</div>
            <div class="row"><span class="label">Cliente ciente e satisfeito com o serviço?</span> ${yesNo(form.clienteSatisfeito)}</div>
          </div>
        </body>
      </html>`;

      const { uri } = await Print.printToFileAsync({ html });
      await shareAsync(uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Falha ao gerar/compartilhar PDF.');
    }
  };

  const onExportPdfItem = async (id) => {
    try {
      const row = await getChecklist(id);
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
        return await toBase64(uri);
      };

      const f = row;
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
            <div class="title">Checklist de Instalação / Reparo</div>
            <div class="meta">${new Date().toLocaleString()}</div>
          </div>
          <div class="card">
            <div class="row"><span class="label">Usuário:</span> ${userId || ''}</div>
          </div>

          <div class="card">
            <div class="cardHeader"><div><span class="badge">1</span><span class="cardTitle">Dados do cliente</span></div></div>
            <div class="row"><span class="label">Nome completo:</span> ${capitalizeWords(f.nome) || ''}</div>
            <div class="row"><span class="label">Rua e número:</span> ${f.ruaNumero || ''}</div>
            <div class="row"><span class="label">Localização (link do Maps):</span> <span class="link">${f.locClienteLink ? `<a href="${f.locClienteLink}">${f.locClienteLink}</a>` : ''}</span></div>
          </div>

          <div class="card">
            <div class="cardHeader"><div><span class="badge">2</span><span class="cardTitle">CTO / rede externa</span></div></div>
            <div class="row"><span class="label">Localização da CTO (link do Maps):</span> <span class="link">${f.locCtoLink ? `<a href="${f.locCtoLink}">${f.locCtoLink}</a>` : ''}</span></div>
            ${imgCto ? `<div class="row"><span class="label">Foto da CTO</span></div><div class="figure"><img class="img" src="${imgCto}" alt="Foto da CTO" /></div>` : ''}
            <div class="row"><span class="label">Cor da fibra:</span> ${f.corFibra || ''}</div>
            <div class="row"><span class="label">Possui splitter?</span> ${yesNo(f.possuiSplitter)}</div>
            <div class="row"><span class="label">Número da porta utilizada pelo cliente:</span> ${f.portaCliente || ''}</div>
          </div>

          <div class="card">
            <div class="cardHeader"><div><span class="badge">3</span><span class="cardTitle">Casa do cliente</span></div></div>
            <div class="row"><span class="label">Localização da casa (link do Maps):</span> <span class="link">${f.locCasaLink ? `<a href="${f.locCasaLink}">${f.locCasaLink}</a>` : ''}</span></div>
            ${imgCasa ? `<div class="row"><span class="label">Foto da frente da casa</span></div><div class="figure"><img class="img" src="${imgCasa}" alt="Foto da frente da casa" /></div>` : ''}
          </div>

          <div class="card card4">
            <div class="cardHeader"><div><span class="badge">4</span><span class="cardTitle">Instalação interna</span></div></div>
            ${imgInst ? `<div class="row"><span class="label">Foto da instalação do equipamento (ONT/Router)</span></div><div class="figure"><img class="img" src="${imgInst}" alt="Foto da instalação do equipamento (ONT/Router)" /></div>` : ''}
            ${imgMac ? `<div class="row"><span class="label">Foto do MAC do equipamento</span></div><div class="figure"><img class="img" src="${imgMac}" alt="Foto do MAC do equipamento" /></div>` : ''}
            <div class="row"><span class="label">Nome do Wi‑Fi:</span> ${f.nomeWifi || ''}</div>
            <div class="row"><span class="label">Senha do Wi‑Fi:</span> ${f.senhaWifi || ''}</div>
          </div>

          <div class="card">
            <div class="cardHeader"><div><span class="badge">5</span><span class="cardTitle">Finalização</span></div></div>
            <div class="row"><span class="label">Teste de navegação realizado com sucesso?</span> ${yesNo(f.testeNavegacaoOk)}</div>
            <div class="row"><span class="label">Cliente ciente e satisfeito com o serviço?</span> ${yesNo(f.clienteSatisfeito)}</div>
          </div>
        </body>
      </html>`;

      const { uri } = await Print.printToFileAsync({ html });
      await shareAsync(uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Falha ao gerar/compartilhar PDF do item.');
    }
  };

  const loadChecklist = async (id) => {
    try {
      const row = await getChecklist(id);
      if (!row) return;
      const loaded = {
        nome: row.nome || '',
        ruaNumero: row.ruaNumero || '',
        locClienteLink: row.locClienteLink || '',
        locCtoLink: row.locCtoLink || '',
        fotoCto: row.fotoCto || null,
        fotoCtoDataUri: row.fotoCtoDataUri || null,
        corFibra: row.corFibra || '',
        possuiSplitter: row.possuiSplitter === 1 ? true : row.possuiSplitter === 0 ? false : null,
        portaCliente: row.portaCliente || '',
        locCasaLink: row.locCasaLink || '',
        fotoFrenteCasa: row.fotoFrenteCasa || null,
        fotoFrenteCasaDataUri: row.fotoFrenteCasaDataUri || null,
        fotoInstalacao: row.fotoInstalacao || null,
        fotoInstalacaoDataUri: row.fotoInstalacaoDataUri || null,
        fotoMacEquip: row.fotoMacEquip || null,
        fotoMacEquipDataUri: row.fotoMacEquipDataUri || null,
        nomeWifi: row.nomeWifi || '',
        senhaWifi: row.senhaWifi || '',
        testeNavegacaoOk: row.testeNavegacaoOk === 1 ? true : row.testeNavegacaoOk === 0 ? false : null,
        clienteSatisfeito: row.clienteSatisfeito === 1 ? true : row.clienteSatisfeito === 0 ? false : null,
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
        await deleteChecklist(confirmDeleteId);
        await refreshList();
        if (confirmDeleteId === currentId) {
          resetForm();
        }
        setSaveModalMessage('Checklist deletado com sucesso.');
        setSaveModalVisible(true);
      }
    } finally {
      setDeleteModalVisible(false);
      setConfirmDeleteId(null);
    }
  };

  const groupedList = useMemo(() => {
    const groups = {};
    for (const item of list) {
      const dateStr = new Date(item.created_at).toLocaleDateString();
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(item);
    }
    return groups;
  }, [list]);

  const actionLabel = currentId ? 'Salvar alterações' : 'Criar checklist';
  const wantsAuthRoute = Platform.OS === 'web' && (route === '/login' || route === '/cadastrar');
  const effectiveMode = Platform.OS === 'web' && (!userId || wantsAuthRoute) ? 'auth' : mode;

  const Header = () => (
    <View style={styles.header}>
      <View style={styles.headerInner}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <Text style={[styles.headerTitle, styles.headerLabel]}>Usuário:</Text>
          <Pressable style={{ flexShrink: 1, minWidth: 0 }} onPress={() => { if (mode !== 'auth') { setEditUserName(userId || ''); setEditUserModalVisible(true); } }}>
            <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">{userName || userId || '—'}</Text>
          </Pressable>
        </View>
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
              {Platform.OS === 'web' ? (
                <Pressable
                  style={[styles.headerBtn, styles.headerBtnLogout]}
                  onPress={onLogout}
                >
                  <Text style={styles.headerBtnText}>Sair</Text>
                </Pressable>
              ) : null}
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
            <View style={styles.row}>
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
            <Text style={styles.modalTitle}>Editar usuário</Text>
            <TextInput
              style={styles.input}
              placeholder="Nome do usuário"
              placeholderTextColor="#9aa0b5"
              value={editUserName}
              onChangeText={setEditUserName}
              maxLength={60}
            />
            <View style={styles.row}>
              <Pressable
                style={[styles.btnSecondary, { flex: 1 }]}
                onPress={() => setEditUserModalVisible(false)}
              >
                <Text style={styles.btnSecondaryText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, { flex: 1 }]}
                onPress={async () => {
                  const trimmed = (editUserName || '').trim();
                  if (!trimmed) {
                    Alert.alert('Validação', 'Informe um nome válido.');
                    return;
                  }
                  try {
                    await setUserId(trimmed);
                    setUserIdState(trimmed);
                    setEditUserModalVisible(false);
                    setSaveModalMessage('Usuário atualizado com sucesso.');
                    setSaveModalVisible(true);
                  } catch (e) {
                    Alert.alert('Erro', 'Falha ao salvar nome do usuário.');
                  }
                }}
              >
                <Text style={styles.btnText}>Salvar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {effectiveMode === 'auth' && saveModalVisible ? (
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
            
            <Text style={styles.title}>{authMode === 'login' ? 'Login' : 'Cadastrar'}</Text>
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
                  <Feather name={showAuthPassword ? 'eye' : 'eye-off'} size={18} color="#666" />
                </Pressable>
              </View>
            ) : (
              <TextInput
                style={styles.input}
                value={authPassword}
                onChangeText={setAuthPassword}
                secureTextEntry
                placeholder="Senha"
                placeholderTextColor="#9aa0b5"
                autoComplete="off"
                textContentType="none"
              />
            )}
            
            {(() => {
              const email = (authEmail || '').trim();
              const phoneDigits = (authPhone || '').replace(/\D+/g, '');
              const loginReady = isValidEmail(email) && (authPassword || '').length >= 12;
              const registerReady = isValidEmail(email) && (authPassword || '').length >= 12 && phoneDigits.length === 11 && !!authFirstName && !!authLastName;
              return (
            <View style={styles.row}>
              {authMode === 'login' ? (
                <Pressable style={[styles.btn, (!loginReady || isAuthSubmitting) && styles.btnDisabled, { flex: 1 }]} disabled={!loginReady || isAuthSubmitting} onPress={async () => {
                  setIsAuthSubmitting(true);
                  try {
                    const email = authEmail.trim();
                    if (!isValidEmail(email)) { return; }
                    try { await signOut(); } catch {}
                    const u = await signIn({ email: email, password: authPassword });
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
                      setBannerType('error');
                      setSaveModalMessage('Não foi possível fazer login.');
                      setSaveModalVisible(true);
                    }
                  } catch (e) {
                    setBannerType('error');
                    setSaveModalMessage('Não foi possível fazer login.');
                    setSaveModalVisible(true);
                  } finally { setIsAuthSubmitting(false); }
                }}>
                  {isAuthSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.btnText}>Entrar</Text>
                  )}
                </Pressable>
              ) : (
                <Pressable style={[styles.btn, (!registerReady || isAuthSubmitting) && styles.btnDisabled, { flex: 1 }]} disabled={!registerReady || isAuthSubmitting} onPress={async () => {
                  setIsAuthSubmitting(true);
                  try {
                    const digits = (authPhone || '').replace(/\D+/g, '');
                    if (!authFirstName || !authLastName || !authEmail || !authPassword || digits.length !== 11) { return; }
                    const email = authEmail.trim();
                    if (!isValidEmail(email)) { return; }
                    if (!isStrongPassword(authPassword)) {
                      setBannerType('warn');
                      setSaveModalMessage('A senha precisa ter 12+ caracteres, letra maiúscula, número e caractere especial.');
                      setSaveModalVisible(true);
                      return;
                    }
                    const res = await signUp({ email: email, password: authPassword, firstName: authFirstName.trim(), lastName: authLastName.trim(), phone: authPhone.trim() });
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
                      if (Platform.OS === 'web') { window.history.pushState({}, '', '/login'); setRoute('/login'); setAuthMode('login'); setMode('auth'); }
                      await refreshList();
                    } else if (u && u.id && Platform.OS === 'web') {
                      setErrorMessage('Conta criada. Verifique seu e‑mail para confirmar e depois faça login.');
                      window.history.pushState({}, '', '/login');
                      setRoute('/login');
                      setAuthMode('login');
                      setMode('auth');
                    } else {
                      setBannerType('error');
                      setSaveModalMessage('Não foi possível cadastrar.');
                      setSaveModalVisible(true);
                    }
                  } catch (e) {
                    setBannerType('error');
                    setSaveModalMessage('Não foi possível cadastrar.');
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
              );
            })()}
            <Pressable
              style={[styles.btnSecondary, { marginTop: 8 }]}
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
              <Text style={styles.btnSecondaryText}>{authMode === 'login' ? 'Criar conta' : 'Já tenho conta'}</Text>
            </Pressable>
            </View>
          </View>
        </ScrollView>
      ) : effectiveMode === 'list' ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <Text style={styles.title}>Checklists</Text>
            {Object.keys(groupedList).length === 0 && (
              <Text style={{ color: '#666' }}>Nenhum checklist salvo ainda.</Text>
            )}
            {Object.entries(groupedList).map(([dateStr, items]) => (
              <View key={dateStr} style={styles.section}>
                <Text style={styles.sectionTitle}>{dateStr}</Text>
                <View style={{ marginTop: 8 }}>
                  {items.map((it) => (
                    <View key={it.id} style={styles.listItem}>
                      <Pressable style={{ flex: 1 }} onPress={() => loadChecklist(it.id)}>
                        <Text style={styles.listItemTitle} numberOfLines={2} ellipsizeMode="tail">{it.nome || 'Sem nome'}</Text>
                        <Text style={styles.listItemSub}>{new Date(it.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</Text>
                      </Pressable>
                      <Pressable style={styles.btnSecondary} onPress={() => onExportPdfItem(it.id)}>
                        <Text style={styles.btnSecondaryText}>Exportar</Text>
                      </Pressable>
                      <Pressable style={styles.delBtn} onPress={() => onDeleteRequest(it.id)}>
                        <Text style={styles.delBtnText}>Deletar</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
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
            <View style={styles.row}>
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
                  editable={false}
                  caretHidden
                  ref={locClienteRef}
                  onFocus={() => {
                    try { locClienteRef.current?.blur(); } catch {}
                    if (Platform.OS === 'web' && form.locClienteLink) {
                      const ok = window.confirm('Abrir o link no Google Maps?');
                      if (ok) { window.open(form.locClienteLink, '_blank', 'noopener,noreferrer'); }
                    }
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                />
              </View>
              <Pressable style={[styles.btn, styles.btnInline]} onPress={() => useCurrentLocation('locClienteLink')} disabled={isLocating}>
                <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                  {isLocating && locatingKey === 'locClienteLink' ? (
                    <ActivityIndicator color="#fff" style={{ position: 'absolute' }} />
                  ) : null}
                  <Text style={[styles.btnText, isLocating && locatingKey === 'locClienteLink' ? { opacity: 0 } : null]}>Puxar Localização</Text>
                </View>
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
            <View style={styles.row}>
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
                  editable={false}
                  caretHidden
                  ref={locCtoRef}
                  onFocus={() => {
                    try { locCtoRef.current?.blur(); } catch {}
                    if (Platform.OS === 'web' && form.locCtoLink) {
                      const ok = window.confirm('Abrir o link no Google Maps?');
                      if (ok) { window.open(form.locCtoLink, '_blank', 'noopener,noreferrer'); }
                    }
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                />
              </View>
              <Pressable style={[styles.btn, styles.btnInline]} onPress={() => useCurrentLocation('locCtoLink')} disabled={isLocating}>
                <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                  {isLocating && locatingKey === 'locCtoLink' ? (
                    <ActivityIndicator color="#fff" style={{ position: 'absolute' }} />
                  ) : null}
                  <Text style={[styles.btnText, isLocating && locatingKey === 'locCtoLink' ? { opacity: 0 } : null]}>Puxar Localização</Text>
                </View>
              </Pressable>
            </View>

            <Text style={styles.label}>📸 Foto da CTO</Text>
            {form.fotoCto ? (
              <View style={styles.imageWrapper}>
                <Image source={{ uri: form.fotoCto }} style={styles.image} />
                <Pressable style={styles.closeBadge} onPress={() => setForm({ ...form, fotoCto: null, fotoCtoDataUri: null })}>
                  <Text style={styles.closeBadgeText}>×</Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable style={[styles.btn, { marginBottom: 12 }]} onPress={() => askCameraAndPick('fotoCto')}>
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
            <View style={styles.row}>
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
                  editable={false}
                  caretHidden
                  ref={locCasaRef}
                  onFocus={() => {
                    try { locCasaRef.current?.blur(); } catch {}
                    if (Platform.OS === 'web' && form.locCasaLink) {
                      const ok = window.confirm('Abrir o link no Google Maps?');
                      if (ok) { window.open(form.locCasaLink, '_blank', 'noopener,noreferrer'); }
                    }
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                />
              </View>
              <Pressable style={[styles.btn, styles.btnInline]} onPress={() => useCurrentLocation('locCasaLink')} disabled={isLocating}>
                <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                  {isLocating && locatingKey === 'locCasaLink' ? (
                    <ActivityIndicator color="#fff" style={{ position: 'absolute' }} />
                  ) : null}
                  <Text style={[styles.btnText, isLocating && locatingKey === 'locCasaLink' ? { opacity: 0 } : null]}>Puxar Localização</Text>
                </View>
              </Pressable>
            </View>

            <Text style={styles.label}>🏘 Foto da frente da casa</Text>
            {form.fotoFrenteCasa ? (
              <View style={styles.imageWrapper}>
                <Image source={{ uri: form.fotoFrenteCasa }} style={styles.image} />
                <Pressable style={styles.closeBadge} onPress={() => setForm({ ...form, fotoFrenteCasa: null, fotoFrenteCasaDataUri: null })}>
                  <Text style={styles.closeBadgeText}>×</Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable style={[styles.btn, { marginBottom: 12 }]} onPress={() => askCameraAndPick('fotoFrenteCasa')}>
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
            {form.fotoInstalacao ? (
              <View style={styles.imageWrapper}>
                <Image source={{ uri: form.fotoInstalacao }} style={styles.image} />
                <Pressable style={styles.closeBadge} onPress={() => setForm({ ...form, fotoInstalacao: null, fotoInstalacaoDataUri: null })}>
                  <Text style={styles.closeBadgeText}>×</Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable style={[styles.btn, { marginBottom: 12 }]} onPress={() => askCameraAndPick('fotoInstalacao')}>
              <Text style={styles.btnText}>Capturar/Selecionar Foto</Text>
            </Pressable>

            <Text style={styles.label}>🏷 Foto do MAC do equipamento</Text>
            {form.fotoMacEquip ? (
              <View style={styles.imageWrapper}>
                <Image source={{ uri: form.fotoMacEquip }} style={styles.image} />
                <Pressable style={styles.closeBadge} onPress={() => setForm({ ...form, fotoMacEquip: null, fotoMacEquipDataUri: null })}>
                  <Text style={styles.closeBadgeText}>×</Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable style={[styles.btn, { marginBottom: 12 }]} onPress={() => askCameraAndPick('fotoMacEquip')}>
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
                <Feather name={showWifiPassword ? 'eye' : 'eye-off'} size={18} color="#666" />
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

          <View style={{ height: 8 }} />
          <View style={styles.row}>
            <Pressable
              style={[
                styles.btn,
                { flex: 1 },
                (currentId ? !hasChanges : !createReady) && styles.btnDisabled,
              ]}
              onPress={onSave}
              disabled={currentId ? !hasChanges : !createReady}
            >
              <Text style={styles.btnText}>{actionLabel}</Text>
            </Pressable>
          </View>

          {currentId ? (
            <Pressable style={[styles.btn, { marginTop: 8 }]} onPress={onExportPdf}>
              <Text style={styles.btnText}>Exportar PDF</Text>
            </Pressable>
          ) : null}

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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  headerBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  headerBtnLogout: {
    backgroundColor: Platform.OS === 'web' ? '#e53e3e' : undefined,
    borderColor: Platform.OS === 'web' ? '#e53e3e' : undefined,
  },
  scrollContent: {
    paddingHorizontal: Platform.OS === 'web' ? 16 : 24,
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
  label: {
    fontSize: 13,
    color: '#444',
    marginBottom: 6,
    marginTop: 2,
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
    marginBottom: 10,
  },
  inputInline: {
    marginBottom: 0,
    height: Platform.OS === 'web' ? 40 : 38,
    paddingVertical: Platform.OS === 'web' ? 8 : 8,
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
  inputWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  inputIconBtn: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -16 }],
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    minWidth: 36,
  },
  inputIconText: {
    fontSize: 16,
  },
  btn: {
    backgroundColor: '#2f6fed',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnInline: {
    height: 40,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    minWidth: 110,
    flexShrink: 0,
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnSecondary: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d7defa',
  },
  btnSecondaryText: {
    color: '#2f6fed',
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
  },
  btnDanger: {
    backgroundColor: '#e53e3e',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  image: {
    width: '100%',
    height: 180,
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
    marginBottom: 10,
  },
  toggleBtn: {
    flex: 1,
    backgroundColor: '#eef2ff',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
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
  },
  toggleTextActive: {
    color: '#fff',
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
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
  },
  delBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  bannerWrap: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 12 : 24,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 3,
    pointerEvents: 'none',
    alignItems: 'center',
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
});
