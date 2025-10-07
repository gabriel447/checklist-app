import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabase('checklist.db');

export function initDB() {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(
          'CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT);'
        );
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS checklists (
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
          );`
        );
      },
      (err) => reject(err),
      () => resolve()
    );
  });
}

export function getOrCreateUserId() {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(
          'SELECT value FROM meta WHERE key = ? LIMIT 1',
          ['userId'],
          (_, { rows }) => {
            if (rows.length > 0) {
              resolve(rows.item(0).value);
            } else {
              const random = 'user' + Math.floor(1000 + Math.random() * 9000);
              tx.executeSql(
                'INSERT INTO meta (key, value) VALUES (?, ?)',
                ['userId', random],
                () => resolve(random)
              );
            }
          }
        );
      },
      (err) => reject(err)
    );
  });
}

export function listChecklists() {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(
          'SELECT id, nome, created_at, updated_at FROM checklists ORDER BY created_at DESC',
          [],
          (_, { rows }) => {
            const out = [];
            for (let i = 0; i < rows.length; i++) out.push(rows.item(i));
            resolve(out);
          }
        );
      },
      (err) => reject(err)
    );
  });
}

export function getChecklist(id) {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(
          'SELECT * FROM checklists WHERE id = ?',
          [id],
          (_, { rows }) => {
            resolve(rows.length ? rows.item(0) : null);
          }
        );
      },
      (err) => reject(err)
    );
  });
}

export function saveChecklist(data, userId) {
  const now = Date.now();
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(
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
          ],
          (_, res) => resolve(res.insertId)
        );
      },
      (err) => reject(err)
    );
  });
}

export function updateChecklist(id, data) {
  const now = Date.now();
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(
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
          ],
          () => resolve(true)
        );
      },
      (err) => reject(err)
    );
  });
}

export function deleteChecklist(id) {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql('DELETE FROM checklists WHERE id = ?', [id], () => resolve(true));
      },
      (err) => reject(err)
    );
  });
}
