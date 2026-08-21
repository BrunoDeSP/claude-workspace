import { lerTabela } from '../parse.js';
import { CAMPOS_ACAO, CAMPOS_FII } from '../campos.js';
import { parseBR } from '../util.js';
import * as cheerio from 'cheerio';

const BASE = 'https://www.fundamentus.com.br';

// User-Agent honesto: identifica o que é e para quê, sem fingir ser um navegador.
const UA = 'b3-screener/0.1 (uso pessoal, 1 coleta/dia; +https://github.com/BrunoDeSP/claude-workspace)';

async function buscar(caminho) {
  const url = `${BASE}${caminho}`;
  const resposta = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9' },
    signal: AbortSignal.timeout(45_000),
  });
  if (!resposta.ok) {
    throw new Error(`${url} respondeu ${resposta.status} ${resposta.statusText}`);
  }
  return resposta.text();
}

/**
 * As duas páginas de listagem. Uma requisição cada, universo inteiro.
 * Ações e FIIs são páginas separadas porque as colunas são diferentes —
 * FII tem vacância e cap rate; ação tem ROE e margem.
 */
export const LISTAGENS = {
  acao: { caminho: '/resultado.php', campos: CAMPOS_ACAO },
  fii: { caminho: '/fii_resultado.php', campos: CAMPOS_FII },
};

export async function buscarListagem(tipo) {
  const { caminho, campos } = LISTAGENS[tipo];
  const html = await buscar(caminho);
  const { linhas, relatorio } = lerTabela(html, campos);
  return { linhas: linhas.map((l) => ({ ...l, tipo })), relatorio };
}

/**
 * Ficha completa de UM ativo — as ~40 informações que não cabem na listagem
 * (setor, subsetor, valor de mercado, LPA, VPA, últimos balanços, oscilações).
 *
 * Buscada sob demanda, quando você clica num ticker. Nunca em lote: o custo é
 * de uma requisição por ativo, e você só se interessa por alguns por dia.
 *
 * A página de detalhe é uma sequência de pares rótulo/valor, então em vez de
 * mapear campo a campo — o que quebraria a cada mudança — devolvemos todos os
 * pares que existirem. Assim a ficha nunca fica desatualizada em relação à fonte.
 */
export async function buscarDetalhe(ticker) {
  const papel = String(ticker).trim().toUpperCase();
  if (!/^[A-Z]{4}\d{1,2}[A-Z]?$/.test(papel)) {
    throw new Error(`Ticker inválido: ${ticker}`);
  }

  const html = await buscar(`/detalhes.php?papel=${encodeURIComponent(papel)}`);
  const $ = cheerio.load(html);
  const campos = {};

  $('td.label').each((_, td) => {
    const rotulo = $(td).text().replace(/\s+/g, ' ').replace(/^\?\s*/, '').trim();
    if (!rotulo) return;
    const alvo = $(td).nextAll('td.data').first();
    if (!alvo.length) return;
    const texto = alvo.text().replace(/\s+/g, ' ').trim();
    if (!texto || texto === '-') return;
    // guarda o texto como veio e, quando fizer sentido, também o número
    const numero = parseBR(texto);
    campos[rotulo] = numero !== null ? { texto, numero } : { texto };
  });

  if (Object.keys(campos).length === 0) {
    throw new Error(`Nenhum campo lido na ficha de ${papel} — layout da fonte pode ter mudado.`);
  }
  return { ticker: papel, campos, buscadoEm: new Date().toISOString() };
}
