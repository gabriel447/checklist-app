export const onlyDigits = (s) => String(s || '').replace(/\D+/g, '');

export const formatPhoneBR = (s) => {
  const d = onlyDigits(s);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
};

export const formatCpfBR = (s) => {
  const d = onlyDigits(s);
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

export const isStrongPassword = (s) => {
  if (!s || s.length < 12) return false;
  if (!/[a-z]/.test(s)) return false;
  if (!/[A-Z]/.test(s)) return false;
  if (!/[0-9]/.test(s)) return false;
  if (!/[^A-Za-z0-9]/.test(s)) return false;
  return true;
};

export const isValidEmail = (s) => {
  if (!s) return false;
  const e = s.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
};