// Fallback de persistência para Web usando localStorage.
const LS_KEY = 'checklists';
const LS_USER = 'userId';

export function initDB() {
  return Promise.resolve();
}

export async function getOrCreateUserId() {
  let uid = localStorage.getItem(LS_USER);
  if (!uid) {
    uid = 'user' + Math.floor(1000 + Math.random() * 9000);
    localStorage.setItem(LS_USER, uid);
  }
  return uid;
}

export async function setUserId(value) {
  localStorage.setItem(LS_USER, value);
  return true;
}

function readAll() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function writeAll(arr) {
  localStorage.setItem(LS_KEY, JSON.stringify(arr));
}

export async function listChecklists() {
  return readAll().sort((a, b) => b.created_at - a.created_at);
}

export async function getChecklist(id) {
  const arr = readAll();
  return arr.find((x) => x.id === id) || null;
}

export async function saveChecklist(data, userId) {
  const arr = readAll();
  const now = Date.now();
  const id = arr.length ? Math.max(...arr.map((x) => x.id)) + 1 : 1;
  arr.push({
    id,
    userId,
    created_at: now,
    updated_at: now,
    ...data,
    possuiSplitter:
      data.possuiSplitter === true ? 1 : data.possuiSplitter === false ? 0 : null,
    testeNavegacaoOk:
      data.testeNavegacaoOk === true ? 1 : data.testeNavegacaoOk === false ? 0 : null,
    clienteSatisfeito:
      data.clienteSatisfeito === true ? 1 : data.clienteSatisfeito === false ? 0 : null,
  });
  writeAll(arr);
  return id;
}

export async function updateChecklist(id, data) {
  const arr = readAll();
  const idx = arr.findIndex((x) => x.id === id);
  if (idx >= 0) {
    arr[idx] = {
      ...arr[idx],
      ...data,
      updated_at: Date.now(),
      possuiSplitter:
        data.possuiSplitter === true ? 1 : data.possuiSplitter === false ? 0 : null,
      testeNavegacaoOk:
        data.testeNavegacaoOk === true ? 1 : data.testeNavegacaoOk === false ? 0 : null,
      clienteSatisfeito:
        data.clienteSatisfeito === true ? 1 : data.clienteSatisfeito === false ? 0 : null,
    };
    writeAll(arr);
  }
  return true;
}

export async function deleteChecklist(id) {
  const arr = readAll().filter((x) => x.id !== id);
  writeAll(arr);
  return true;
}
