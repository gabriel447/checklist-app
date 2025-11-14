import * as SQLite from 'expo-sqlite';

let db;

export async function initDB() {
  try {
    db = await SQLite.openDatabaseAsync('checklist.db');
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT);
      CREATE TABLE IF NOT EXISTS checklists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT,
        created_at INTEGER,
        updated_at INTEGER,
        nome TEXT,
        ruaNumero TEXT,
        locClienteLink TEXT,
        locCtoLink TEXT,
        fotoCto TEXT,
        fotoCtoDataUri TEXT,
        corFibra TEXT,
        possuiSplitter INTEGER,
        portaCliente TEXT,
        locCasaLink TEXT,
        fotoFrenteCasa TEXT,
        fotoFrenteCasaDataUri TEXT,
        fotoInstalacao TEXT,
        fotoInstalacaoDataUri TEXT,
        fotoMacEquip TEXT,
        fotoMacEquipDataUri TEXT,
        nomeWifi TEXT,
        senhaWifi TEXT,
        testeNavegacaoOk INTEGER,
        clienteSatisfeito INTEGER
      );
    `);

    // Garantir colunas novas em bancos já existentes
    const cols = await db.getAllAsync('PRAGMA table_info(checklists)');
    const names = cols.map((c) => c.name);
    const addColumnIfMissing = async (name) => {
      if (!names.includes(name)) {
        await db.runAsync(`ALTER TABLE checklists ADD COLUMN ${name} TEXT`);
      }
    };
    await addColumnIfMissing('fotoCtoDataUri');
    await addColumnIfMissing('fotoFrenteCasaDataUri');
    await addColumnIfMissing('fotoInstalacaoDataUri');
    await addColumnIfMissing('fotoMacEquipDataUri');
  } catch (e) {
    throw e;
  }
}

export async function getOrCreateUserId() {
  const row = await db.getFirstAsync('SELECT value FROM meta WHERE key = ? LIMIT 1', [
    'userId',
  ]);
  if (row && row.value) return row.value;
  const random = 'user' + Math.floor(1000 + Math.random() * 9000);
  await db.runAsync('INSERT INTO meta (key, value) VALUES (?, ?)', ['userId', random]);
  return random;
}

export async function setUserId(value) {
  const res = await db.runAsync('UPDATE meta SET value = ? WHERE key = ?', [value, 'userId']);
  if (res.changes === 0) {
    await db.runAsync('INSERT INTO meta (key, value) VALUES (?, ?)', ['userId', value]);
  }
  return true;
}

export async function listChecklists(userId) {
  if (!userId) return [];
  return await db.getAllAsync(
    'SELECT id, nome, created_at, updated_at FROM checklists WHERE userId = ? ORDER BY created_at DESC',
    [userId]
  );
}

export async function getChecklist(id, userId) {
  if (!userId) return null;
  const row = await db.getFirstAsync('SELECT * FROM checklists WHERE id = ? AND userId = ?', [
    id,
    userId,
  ]);
  return row ?? null;
}

export async function saveChecklist(data, userId) {
  const now = Date.now();
  const result = await db.runAsync(
    `INSERT INTO checklists (
      userId, created_at, updated_at,
      nome, ruaNumero, locClienteLink,
      locCtoLink, fotoCto, fotoCtoDataUri, corFibra, possuiSplitter, portaCliente,
      locCasaLink, fotoFrenteCasa, fotoFrenteCasaDataUri,
      fotoInstalacao, fotoInstalacaoDataUri, fotoMacEquip, fotoMacEquipDataUri, nomeWifi, senhaWifi,
      testeNavegacaoOk, clienteSatisfeito
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      now,
      now,
      data.nome || '',
      data.ruaNumero || '',
      data.locClienteLink || '',
      data.locCtoLink || '',
      data.fotoCto || null,
      data.fotoCtoDataUri || null,
      data.corFibra || '',
      data.possuiSplitter === true ? 1 : data.possuiSplitter === false ? 0 : null,
      data.portaCliente || '',
      data.locCasaLink || '',
      data.fotoFrenteCasa || null,
      data.fotoFrenteCasaDataUri || null,
      data.fotoInstalacao || null,
      data.fotoInstalacaoDataUri || null,
      data.fotoMacEquip || null,
      data.fotoMacEquipDataUri || null,
      data.nomeWifi || '',
      data.senhaWifi || '',
      data.testeNavegacaoOk === true ? 1 : data.testeNavegacaoOk === false ? 0 : null,
      data.clienteSatisfeito === true ? 1 : data.clienteSatisfeito === false ? 0 : null,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateChecklist(id, data, userId) {
  const now = Date.now();
  await db.runAsync(
    `UPDATE checklists SET
      updated_at = ?,
      nome = ?, ruaNumero = ?, locClienteLink = ?,
      locCtoLink = ?, fotoCto = ?, fotoCtoDataUri = ?, corFibra = ?, possuiSplitter = ?, portaCliente = ?,
      locCasaLink = ?, fotoFrenteCasa = ?, fotoFrenteCasaDataUri = ?,
      fotoInstalacao = ?, fotoInstalacaoDataUri = ?, fotoMacEquip = ?, fotoMacEquipDataUri = ?, nomeWifi = ?, senhaWifi = ?,
      testeNavegacaoOk = ?, clienteSatisfeito = ?
    WHERE id = ? AND userId = ?`,
    [
      now,
      data.nome || '',
      data.ruaNumero || '',
      data.locClienteLink || '',
      data.locCtoLink || '',
      data.fotoCto || null,
      data.fotoCtoDataUri || null,
      data.corFibra || '',
      data.possuiSplitter === true ? 1 : data.possuiSplitter === false ? 0 : null,
      data.portaCliente || '',
      data.locCasaLink || '',
      data.fotoFrenteCasa || null,
      data.fotoFrenteCasaDataUri || null,
      data.fotoInstalacao || null,
      data.fotoInstalacaoDataUri || null,
      data.fotoMacEquip || null,
      data.fotoMacEquipDataUri || null,
      data.nomeWifi || '',
      data.senhaWifi || '',
      data.testeNavegacaoOk === true ? 1 : data.testeNavegacaoOk === false ? 0 : null,
      data.clienteSatisfeito === true ? 1 : data.clienteSatisfeito === false ? 0 : null,
      id,
      userId,
    ]
  );
  return true;
}

export async function deleteChecklist(id, userId) {
  if (!userId) return true;
  await db.runAsync('DELETE FROM checklists WHERE id = ? AND userId = ?', [id, userId]);
  return true;
}

export async function getCurrentUser() {
  return null;
}

export async function signIn() {
  return null;
}

export async function signUp() {
  return null;
}

export async function signOut() {
  return true;
}

export async function updateProfile(userId, { firstName, lastName, phone }) {
  return true;
}

export async function updateAuth() {
  return true;
}
