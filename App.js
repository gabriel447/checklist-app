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
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import { shareAsync } from 'expo-sharing';
import {
  initDB,
  getOrCreateUserId,
  listChecklists,
  getChecklist,
  saveChecklist,
  updateChecklist,
  deleteChecklist,
} from './db';

const makeInitialForm = () => ({
  nome: '',
  ruaNumero: '',
  locClienteLink: '',
  locCtoLink: '',
  fotoCto: null,
  corFibra: '',
  possuiSplitter: null,
  portaCliente: '',
  locCasaLink: '',
  fotoFrenteCasa: null,
  fotoInstalacao: null,
  fotoMacEquip: null,
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
  const [userId, setUserId] = useState(null);
  const [currentId, setCurrentId] = useState(null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [saveModalMessage, setSaveModalMessage] = useState('');

  useEffect(() => {
    (async () => {
      try {
        await initDB();
        const uid = await getOrCreateUserId();
        setUserId(uid);
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.6,
      });
    } catch (e) {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.6,
      });
    }
    if (!result.canceled && result.assets?.[0]?.uri) {
      setField(fieldKey, result.assets[0].uri);
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
      const toBase64 = async (uri) => {
        if (!uri) return null;
        try {
          const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
          return `data:image/jpeg;base64,${b64}`;
        } catch {
          return null;
        }
      };

      const imgCto = await toBase64(form.fotoCto);
      const imgCasa = await toBase64(form.fotoFrenteCasa);
      const imgInst = await toBase64(form.fotoInstalacao);
      const imgMac = await toBase64(form.fotoMacEquip);

      const yesNo = (v) => (v === true ? 'Sim' : v === false ? 'Não' : '—');

      const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: -apple-system, Roboto, Arial; padding: 16px; }
            h1 { font-size: 20px; }
            h2 { font-size: 16px; margin-top: 12px; }
            .row { margin: 6px 0; }
            .label { font-weight: 600; }
            .img { width: 100%; height: auto; margin: 6px 0; }
          </style>
        </head>
        <body>
          <h1>Checklist de Instalação / Reparo</h1>
          <div class="row"><span class="label">Usuário:</span> ${userId || ''}</div>
          <div class="row"><span class="label">Criado em:</span> ${new Date().toLocaleString()}</div>

          <h2>1) Dados do cliente</h2>
          <div class="row"><span class="label">Nome:</span> ${form.nome || ''}</div>
          <div class="row"><span class="label">Rua e número:</span> ${form.ruaNumero || ''}</div>
          <div class="row"><span class="label">Localização cliente:</span> ${form.locClienteLink || ''}</div>

          <h2>2) CTO / Rede externa</h2>
          <div class="row"><span class="label">Localização CTO:</span> ${form.locCtoLink || ''}</div>
          ${imgCto ? `<img class="img" src="${imgCto}" />` : ''}
          <div class="row"><span class="label">Cor da fibra:</span> ${form.corFibra || ''}</div>
          <div class="row"><span class="label">Possui splitter:</span> ${yesNo(form.possuiSplitter)}</div>
          <div class="row"><span class="label">Porta cliente:</span> ${form.portaCliente || ''}</div>

          <h2>3) Casa do cliente</h2>
          <div class="row"><span class="label">Localização casa:</span> ${form.locCasaLink || ''}</div>
          ${imgCasa ? `<img class="img" src="${imgCasa}" />` : ''}

          <h2>4) Instalação interna</h2>
          ${imgInst ? `<img class="img" src="${imgInst}" />` : ''}
          ${imgMac ? `<img class="img" src="${imgMac}" />` : ''}
          <div class="row"><span class="label">Nome do Wi-Fi:</span> ${form.nomeWifi || ''}</div>
          <div class="row"><span class="label">Senha do Wi-Fi:</span> ${form.senhaWifi || ''}</div>

          <h2>5) Finalização</h2>
          <div class="row"><span class="label">Teste de navegação:</span> ${yesNo(form.testeNavegacaoOk)}</div>
          <div class="row"><span class="label">Cliente satisfeito:</span> ${yesNo(form.clienteSatisfeito)}</div>
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
        corFibra: row.corFibra || '',
        possuiSplitter: row.possuiSplitter === 1 ? true : row.possuiSplitter === 0 ? false : null,
        portaCliente: row.portaCliente || '',
        locCasaLink: row.locCasaLink || '',
        fotoFrenteCasa: row.fotoFrenteCasa || null,
        fotoInstalacao: row.fotoInstalacao || null,
        fotoMacEquip: row.fotoMacEquip || null,
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
      <Text style={styles.headerTitle}>📋 Checklist</Text>
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
    <View style={styles.container}>
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
          <Text style={styles.title}>Usuário: {userId || '—'}</Text>

          {/* 1) Dados do cliente */}
          <Section
            title="🧍‍♂️ 1️⃣ Dados do cliente"
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
                style={[styles.input, { flex: 1 }]}
                placeholder="https://www.google.com/maps?..."
                value={form.locClienteLink}
                onChangeText={(t) => setField('locClienteLink', t)}
              />
              <Pressable style={styles.btn} onPress={() => useCurrentLocation('locClienteLink')}>
                <Text style={styles.btnText}>Puxar localização</Text>
              </Pressable>
            </View>
          </Section>

          {/* 2) CTO / Rede externa */}
          <Section
            title="🧵 2️⃣ CTO / rede externa"
            expanded={expanded.cto}
            onToggle={() => setExpanded((e) => ({ ...e, cto: !e.cto }))}
          >
            <Text style={styles.label}>📍 Localização da CTO (link do Maps)</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="https://www.google.com/maps?..."
                value={form.locCtoLink}
                onChangeText={(t) => setField('locCtoLink', t)}
              />
              <Pressable style={styles.btn} onPress={() => useCurrentLocation('locCtoLink')}>
                <Text style={styles.btnText}>Puxar localização</Text>
              </Pressable>
            </View>

            <Text style={styles.label}>📸 Foto da CTO</Text>
            {form.fotoCto ? (
              <Image source={{ uri: form.fotoCto }} style={styles.image} />
            ) : null}
            <Pressable style={styles.btn} onPress={() => askCameraAndPick('fotoCto')}>
              <Text style={styles.btnText}>Capturar/Selecionar Foto</Text>
            </Pressable>

            <Text style={styles.label}>🎨 Cor da fibra</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex.: amarela, azul..."
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
            title="🏡 3️⃣ Casa do cliente"
            expanded={expanded.casa}
            onToggle={() => setExpanded((e) => ({ ...e, casa: !e.casa }))}
          >
            <Text style={styles.label}>📍 Localização da casa (link do Maps)</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="https://www.google.com/maps?..."
                value={form.locCasaLink}
                onChangeText={(t) => setField('locCasaLink', t)}
              />
              <Pressable style={styles.btn} onPress={() => useCurrentLocation('locCasaLink')}>
                <Text style={styles.btnText}>Puxar localização</Text>
              </Pressable>
            </View>

            <Text style={styles.label}>🏘 Foto da frente da casa</Text>
            {form.fotoFrenteCasa ? (
              <Image source={{ uri: form.fotoFrenteCasa }} style={styles.image} />
            ) : null}
            <Pressable style={styles.btn} onPress={() => askCameraAndPick('fotoFrenteCasa')}>
              <Text style={styles.btnText}>Capturar/Selecionar Foto</Text>
            </Pressable>
          </Section>

          {/* 4) Instalação interna */}
          <Section
            title="📶 4️⃣ Instalação interna"
            expanded={expanded.interna}
            onToggle={() => setExpanded((e) => ({ ...e, interna: !e.interna }))}
          >
            <Text style={styles.label}>🧰 Foto da instalação do equipamento (ONT/Router)</Text>
            {form.fotoInstalacao ? (
              <Image source={{ uri: form.fotoInstalacao }} style={styles.image} />
            ) : null}
            <Pressable style={styles.btn} onPress={() => askCameraAndPick('fotoInstalacao')}>
              <Text style={styles.btnText}>Capturar/Selecionar Foto</Text>
            </Pressable>

            <Text style={styles.label}>🏷 Foto do MAC do equipamento</Text>
            {form.fotoMacEquip ? (
              <Image source={{ uri: form.fotoMacEquip }} style={styles.image} />
            ) : null}
            <Pressable style={styles.btn} onPress={() => askCameraAndPick('fotoMacEquip')}>
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
            <TextInput
              style={styles.input}
              placeholder="Senha"
              secureTextEntry
              value={form.senhaWifi}
              onChangeText={(t) => setField('senhaWifi', t)}
            />
          </Section>

          {/* 5) Finalização */}
          <Section
            title="✅ 5️⃣ Finalização"
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
    </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  btn: {
    backgroundColor: '#2f6fed',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
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
