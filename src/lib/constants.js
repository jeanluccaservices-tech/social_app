// Gender identity options offered at signup, profile editing, and match
// preferences. 'Casal' (couple) is a separate profile type, not a gender,
// so it's added where relevant rather than being part of this list.
export const GENDERS = [
  'Masculino',
  'Feminino',
  'Mulher Trans',
  'Homem Trans',
  'Travesti',
  'Crossdressing (CD)'
];

// LoveVibe only accepts adults: every age field in the app is a plain
// number input, but sanitized/clamped to this range so under-18 (or
// unreasonably high) values can't be typed in.
export const MIN_AGE = 18;
export const MAX_AGE = 100;

// Strips anything non-numeric as the user types (defends against pasting
// "18abc" or similar) without clamping mid-typing, which would make it
// impossible to type e.g. "8" on the way to "18".
export const sanitizeAgeInput = (raw) => raw.replace(/\D/g, '').slice(0, 3);

// Clamps to [MIN_AGE, MAX_AGE] once the field loses focus; empty is left
// empty so the "required" check on submit still catches it.
export const clampAge = (raw) => {
  if (raw === '') return raw;
  const n = Number(raw);
  if (Number.isNaN(n)) return '';
  return String(Math.min(MAX_AGE, Math.max(MIN_AGE, n)));
};

// Same idea as the age fields above, for the "how far" preference/filter.
export const MIN_RADIUS_KM = 1;
export const MAX_RADIUS_KM = 9999;

export const sanitizeRadiusInput = (raw) => raw.replace(/\D/g, '').slice(0, 4);

export const clampRadius = (raw) => {
  if (raw === '') return raw;
  const n = Number(raw);
  if (Number.isNaN(n)) return '';
  return String(Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, n)));
};

const isoDate = (d) => d.toISOString().slice(0, 10);
const today = new Date();

// Bounds for the birth date picker — the app computes age from this date
// instead of asking for (and trusting) a typed-in number.
export const MAX_BIRTH_DATE = isoDate(new Date(today.getFullYear() - MIN_AGE, today.getMonth(), today.getDate()));
export const MIN_BIRTH_DATE = isoDate(new Date(today.getFullYear() - MAX_AGE, today.getMonth(), today.getDate()));

// Age in whole years as of today; null for a missing/invalid date.
export const calculateAge = (birthDateStr) => {
  if (!birthDateStr) return null;
  const birth = new Date(birthDateStr);
  if (Number.isNaN(birth.getTime())) return null;
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

export const REPORT_REASONS = ['Spam', 'Conteúdo impróprio', 'Assédio ou bullying', 'Informação falsa', 'Outro'];

// Optional "About" info, fillable any time after the profile is created.
export const SEXUAL_ORIENTATIONS = ['Heterossexual', 'Homossexual', 'Bissexual', 'Pansexual', 'Assexual', 'Outro'];
export const MARITAL_STATUSES = ['Solteiro(a)', 'Namorando', 'União Estável', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)'];
export const SMOKE_DRINK_OPTIONS = ['Não', 'Às vezes', 'Sim'];
