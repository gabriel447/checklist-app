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
        corFibra TEXT,
        possuiSplitter INTEGER,
        portaCliente TEXT,
        locCasaLink TEXT,
        fotoFrenteCasa TEXT,
        fotoInstalacao TEXT,
        fotoMacEquip TEXT,
        nomeWifi TEXT,
        senhaWifi TEXT,
        testeNavegacaoOk INTEGER,
        clienteSatisfeito INTEGER
      );
    `);
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

export async function listChecklists() {
  return await db.getAllAsync(
    'SELECT id, nome, created_at, updated_at FROM checklists ORDER BY created_at DESC'
  );
}

export async function getChecklist(id) {
  const row = await db.getFirstAsync('SELECT * FROM checklists WHERE id = ?', [id]);
  return row ?? null;
}

export async function saveChecklist(data, userId) {
  const now = Date.now();
  const result = await db.runAsync(
    `INSERT INTO checklists (
      userId, created_at, updated_at,
      nome, ruaNumero, locClienteLink,
      locCtoLink, fotoCto, corFibra, possuiSplitter, portaCliente,
      locCasaLink, fotoFrenteCasa,
      fotoInstalacao, fotoMacEquip, nomeWifi, senhaWifi,
      testeNavegacaoOk, clienteSatisfeito
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      now,
      now,
      data.nome || '',
      data.ruaNumero || '',
      data.locClienteLink || '',
      data.locCtoLink || '',
      data.fotoCto || null,
      data.corFibra || '',
      data.possuiSplitter === true ? 1 : data.possuiSplitter === false ? 0 : null,
      data.portaCliente || '',
      data.locCasaLink || '',
      data.fotoFrenteCasa || null,
      data.fotoInstalacao || null,
      data.fotoMacEquip || null,
      data.nomeWifi || '',
      data.senhaWifi || '',
      data.testeNavegacaoOk === true ? 1 : data.testeNavegacaoOk === false ? 0 : null,
      data.clienteSatisfeito === true ? 1 : data.clienteSatisfeito === false ? 0 : null,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateChecklist(id, data) {
  const now = Date.now();
  await db.runAsync(
    `UPDATE checklists SET
      updated_at = ?,
      nome = ?, ruaNumero = ?, locClienteLink = ?,
      locCtoLink = ?, fotoCto = ?, corFibra = ?, possuiSplitter = ?, portaCliente = ?,
      locCasaLink = ?, fotoFrenteCasa = ?,
      fotoInstalacao = ?, fotoMacEquip = ?, nomeWifi = ?, senhaWifi = ?,
      testeNavegacaoOk = ?, clienteSatisfeito = ?
    WHERE id = ?`,
    [
      now,
      data.nome || '',
      data.ruaNumero || '',
      data.locClienteLink || '',
      data.locCtoLink || '',
      data.fotoCto || null,
      data.corFibra || '',
      data.possuiSplitter === true ? 1 : data.possuiSplitter === false ? 0 : null,
      data.portaCliente || '',
      data.locCasaLink || '',
      data.fotoFrenteCasa || null,
      data.fotoInstalacao || null,
      data.fotoMacEquip || null,
      data.nomeWifi || '',
      data.senhaWifi || '',
      data.testeNavegacaoOk === true ? 1 : data.testeNavegacaoOk === false ? 0 : null,
      data.clienteSatisfeito === true ? 1 : data.clienteSatisfeito === false ? 0 : null,
      id,
    ]
  );
  return true;
}

export async function deleteChecklist(id) {
  await db.runAsync('DELETE FROM checklists WHERE id = ?', [id]);
  return true;
}
