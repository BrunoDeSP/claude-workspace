/**
 * Normaliza um texto para comparação: minúsculas, sem acento, só letras e dígitos.
 * "Dív.Brut/ Patrim." -> "divbrutpatrim"
 * É assim que os cabeçalhos do Fundamentus são casados com os campos conhecidos —
 * nunca por posição, porque a ordem das colunas pode mudar sem aviso.
 */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Converte número no formato brasileiro para Number.
 *   "1.234,56"  -> 1234.56
 *   "14,20%"    -> 14.2
 *   "-"  ""     -> null
 * Retorna null para qualquer coisa que não vire número, para que campo ausente
 * seja distinguível de zero.
 */
export function parseBR(texto) {
  if (texto == null) return null;
  const limpo = String(texto)
    .replace(/[\s\u00a0]/g, '')
    .replace(/%/g, '')
    .replace(/R\$/gi, '')
    .replace(/\./g, '')
    .replace(/,/g, '.');
  if (limpo === '' || limpo === '-') return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

/** Data de hoje em YYYY-MM-DD, no fuso de São Paulo (o pregão é daqui). */
export function hojeSP() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

/** Pausa entre requisições, para não martelar o servidor da fonte. */
export function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
