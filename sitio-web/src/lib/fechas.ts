const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha local en formato AAAA-MM-DD (para inputs type=date). */
export const aISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Interpreta AAAA-MM-DD como fecha local (evita corrimientos por zona horaria). */
export function deISO(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export const sumarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export const fechaLarga = (d: Date) =>
  new Intl.DateTimeFormat('es-PY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);

export const fechaCorta = (iso: string) => {
  const d = deISO(iso);
  return d ? new Intl.DateTimeFormat('es-PY', { day: 'numeric', month: 'long', year: 'numeric' }).format(d) : iso;
};

export const NOMBRES_DIAS = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
