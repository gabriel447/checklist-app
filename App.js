import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
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
  const [expanded, setExpanded] = useState({
    cliente: true,
    cto: false,
    casa: false,
    interna: false,
    finalizacao: false,
  });

  const [form, setForm] = useState(makeInitialForm());
  const [originalForm, setOriginalForm] = useState(makeInitialForm());

  const [mode, setMode] = useState('editor'); // 'editor' | 'list'
  const [userId, setUserIdState] = useState(null);
  const [currentId, setCurrentId] = useState(null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [saveModalMessage, setSaveModalMessage] = useState('');
  const [editUserModalVisible, setEditUserModalVisible] = useState(false);
  const [editUserName, setEditUserName] = useState('');
  const [showWifiPassword, setShowWifiPassword] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await initDB();
        const uid = await getOrCreateUserId();
        setUserIdState(uid);
        await refreshList();
      } catch (e) {
        console.error(e);
        Alert.alert('Erro', 'Falha ao inicializar banco de dados.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
    // Se câmera não abriu ou usuário cancelou, tenta galeria
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
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão', 'Permissão de localização negada.');
      return;
    }
    const pos = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = pos.coords;
    const link = `https://www.google.com/maps?q=${latitude},${longitude}`;
    setField(fieldKey, link);
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

  const hasChanges = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(originalForm),
    [form, originalForm]
  );

  const onSave = async () => {
    try {
      if (!userId) return;
      if (!currentId) {
        const id = await saveChecklist(form, userId);
        setCurrentId(id);
        setOriginalForm(form);
        setSaveModalMessage('Checklist criado com sucesso.');
        setSaveModalVisible(true);
      } else {
        await updateChecklist(currentId, form);
        setOriginalForm(form);
        setSaveModalMessage('Checklist atualizado com sucesso.');
        setSaveModalVisible(true);
      }
      await refreshList();
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível salvar.');
    }
  };

  const onExportPdf = async () => {
    try {
      const getMimeFromUri = (uri) => {
        if (!uri) return 'image/jpeg';
        const lower = uri.toLowerCase();
        if (lower.endsWith('.png')) return 'image/png';
        if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
        // Fallback for unknown extensions (HEIC/others): try jpeg
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
            body { font-family: -apple-system, Roboto, Arial; background:#f6f7fb; padding: 16px; }
            .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
            .title { font-size:20px; font-weight:700; color:#222; }
            .meta { font-size:12px; color:#666; }
            .card { background:#fff; border-radius:8px; padding:12px; box-shadow:0 2px 6px rgba(0,0,0,0.06); margin-bottom:12px; }
            .cardHeader { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
            .badge { display:inline-block; background:#e1e8ff; color:#2f6fed; font-weight:700; font-size:12px; border-radius:6px; padding:4px 8px; margin-right:8px; }
            .cardTitle { font-size:16px; font-weight:600; color:#333; }
            .row { margin:6px 0; font-size:13px; color:#444; }
            .label { font-weight:600; }
            .figure { display:flex; flex-direction:column; align-items:flex-start; margin:8px 0; }
            .img { width:280px; height:180px; object-fit:cover; border-radius:8px; }
            .caption { font-size:12px; color:#666; margin-top:4px; text-align:left; }
            a { color:#2f6fed; text-decoration:none; }
            .link { word-break: break-all; }
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

          <div class="card">
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

  const Header = () => (
    <View style={styles.header}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={[styles.headerTitle, styles.headerLabel]}>Usuário:</Text>
        <Pressable onPress={() => { setEditUserName(userId || ''); setEditUserModalVisible(true); }}>
          <Text style={styles.headerTitle}>{userId || '—'}</Text>
        </Pressable>
      </View>
      {mode === 'editor' ? (
        <Pressable style={styles.headerBtn} onPress={() => setMode('list')}>
          <Text style={styles.headerBtnText}>Ver checklists</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.headerBtn} onPress={() => setMode('editor')}>
          <Text style={styles.headerBtnText}>Voltar</Text>
        </Pressable>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}> 
        <Text>Carregando...</Text>
      </View>
    );
  }

  const actionLabel = currentId ? 'Salvar alterações' : 'Criar checklist';

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.container}>
      <Header />

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
              value={editUserName}
              onChangeText={setEditUserName}
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

      {/* Modal de sucesso ao salvar */}
      <Modal
        transparent
        visible={saveModalVisible}
        animationType="fade"
        onRequestClose={() => setSaveModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Sucesso</Text>
            <Text style={styles.modalText}>{saveModalMessage}</Text>
            <Pressable style={styles.btn} onPress={() => setSaveModalVisible(false)}>
              <Text style={styles.btnText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {mode === 'list' ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Checklists de {userId}</Text>
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
                      <Text style={styles.listItemTitle}>{it.nome || 'Sem nome'}</Text>
                      <Text style={styles.listItemSub}>{new Date(it.created_at).toLocaleString()}</Text>
                    </Pressable>
                    <Pressable style={styles.delBtn} onPress={() => onDeleteRequest(it.id)}>
                      <Text style={styles.delBtnText}>Deletar</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
      <ScrollView contentContainerStyle={styles.scrollContent}>
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
              value={form.nome}
              onChangeText={(t) => setField('nome', t)}
            />

            <Text style={styles.label}>🏠 Rua e número</Text>
            <TextInput
              style={styles.input}
              placeholder="Rua e número"
              value={form.ruaNumero}
              onChangeText={(t) => setField('ruaNumero', t)}
            />

            <Text style={styles.label}>📍 Localização (link do Maps)</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.inputInline, { flex: 1 }]}
                placeholder="https://www.google.com/maps?..."
                value={form.locClienteLink}
                onChangeText={(t) => setField('locClienteLink', t)}
              />
              <Pressable style={[styles.btn, styles.btnInline]} onPress={() => useCurrentLocation('locClienteLink')}>
                <Text style={styles.btnText}>Puxar localização</Text>
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
              <TextInput
                style={[styles.input, styles.inputInline, { flex: 1 }]}
                placeholder="https://www.google.com/maps?..."
                value={form.locCtoLink}
                onChangeText={(t) => setField('locCtoLink', t)}
              />
              <Pressable style={[styles.btn, styles.btnInline]} onPress={() => useCurrentLocation('locCtoLink')}>
                <Text style={styles.btnText}>Puxar localização</Text>
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
              value={form.corFibra}
              onChangeText={(t) => setField('corFibra', t)}
            />

            <Text style={styles.label}>🔀 Possui splitter?</Text>
            <ToggleYesNo value={form.possuiSplitter} onChange={(v) => setField('possuiSplitter', v)} />

            <Text style={styles.label}>🔌 Número da porta utilizada pelo cliente</Text>
            <TextInput
              style={styles.input}
              placeholder="Porta"
              value={form.portaCliente}
              onChangeText={(t) => setField('portaCliente', t)}
              keyboardType="number-pad"
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
              <TextInput
                style={[styles.input, styles.inputInline, { flex: 1 }]}
                placeholder="https://www.google.com/maps?..."
                value={form.locCasaLink}
                onChangeText={(t) => setField('locCasaLink', t)}
              />
              <Pressable style={[styles.btn, styles.btnInline]} onPress={() => useCurrentLocation('locCasaLink')}>
                <Text style={styles.btnText}>Puxar localização</Text>
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
              value={form.nomeWifi}
              onChangeText={(t) => setField('nomeWifi', t)}
            />

            <Text style={styles.label}>🔑 Senha do Wi-Fi</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, styles.inputWithIcon]}
                placeholder="Senha"
                secureTextEntry={!showWifiPassword}
                value={form.senhaWifi}
                onChangeText={(t) => setField('senhaWifi', t)}
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
              style={[styles.btn, { flex: 1 }, !hasChanges && styles.btnDisabled]}
              onPress={onSave}
              disabled={!hasChanges}
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
    backgroundColor: '#f6f7fb',
  },
  header: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
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
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
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
  input: {
    backgroundColor: '#f2f3f7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#222',
    marginBottom: 10,
  },
  inputInline: {
    marginBottom: 0,
    height: 38,
    paddingVertical: 8,
  },
  inputWithIcon: {
    paddingRight: 48,
  },
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
    transform: [{ translateY: -14 }],
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
    height: 38,
    paddingVertical: 0,
    justifyContent: 'center',
    alignItems: 'center',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBox: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    color: '#444',
    marginBottom: 12,
  },
});
