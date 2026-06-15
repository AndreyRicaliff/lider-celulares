import { MONTH_REGEX, VALID_JSON_ESCAPES } from './constants.ts';

export const safeParseNumber = (val: any): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    // Tratar "R$ 1.234,56" ou "1234,56"
    const cleaned = val.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

export const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Erro desconhecido na sincronização';
};

// Regra de negócio: a coleta de vendas até as 04:00 da manhã é referente ao dia anterior.
// A API pode registrar vendas feitas perto das 22:00-23:59 com timestamp do dia seguinte
// (após corte interno), então qualquer atendimento entre 00:00 e 03:59 é deslocado -1 dia.
export const parseDate = (dateStr: string): { isoDate: string; month: string } | null => {
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!match) return null;
  const [, dayStr, monthStr, yearStr, hourStr, minStr] = match;

  // Criar um objeto de data considerando o fuso horário local (Brazil/East)
  // O Tenfront envia a data no formato dd/mm/yyyy hh:mm que é o horário da venda na loja
  const year = parseInt(yearStr);
  const month = parseInt(monthStr) - 1; // 0-indexed
  const day = parseInt(dayStr);
  const hour = hourStr ? parseInt(hourStr) : 12;
  const min = minStr ? parseInt(minStr) : 0;

  // Regra: vendas entre 00:00 e 03:59 pertencem ao dia anterior (corte de operação às 04:00).
  // Construímos via UTC para evitar qualquer shift de timezone do runtime.
  let dt = new Date(Date.UTC(year, month, day, hour, min));
  if (hour < 4) {
    dt = new Date(dt.getTime() - 24 * 60 * 60 * 1000);
  }
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  const isoDate = `${y}-${m}-${d}`;
  const monthKey = `${y}-${m}`;

  return { isoDate, month: monthKey };
};

export const getRequestedMonth = (req: Request, body: Record<string, unknown>): string => {
  const queryMonth = new URL(req.url).searchParams.get('mes');
  const bodyMonth = typeof body.mes === 'string' ? body.mes : null;
  const candidate = (bodyMonth || queryMonth || '').slice(0, 7);
  if (MONTH_REGEX.test(candidate)) return candidate;
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
};

export const escapeInvalidBackslashes = (raw: string): string => {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== '\\') { out += raw[i]; continue; }
    if (VALID_JSON_ESCAPES.has(raw[i + 1])) { out += raw[i] + raw[i + 1]; i++; continue; }
    out += '\\\\';
  }
  return out;
};

export const parseTenfrontJson = <T>(raw: string): T => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return JSON.parse(escapeInvalidBackslashes(raw)) as T;
  }
};
