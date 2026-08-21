import * as cheerio from 'cheerio';
import { normalizar, parseBR } from './util.js';

/**
 * Escolhe a tabela de dados da página: a que tiver mais linhas.
 * Mais robusto do que fixar um id/classe, que pode mudar num redesign.
 */
function acharTabela($) {
  let melhor = null;
  let maior = 0;
  $('table').each((_, t) => {
    const n = $(t).find('tr').length;
    if (n > maior) { maior = n; melhor = t; }
  });
  return melhor;
}

/** Converte o valor cru da célula conforme o tipo declarado do campo. */
function converter(bruto, tipo) {
  const txt = bruto.trim();
  if (tipo === 'texto') return txt === '' || txt === '-' ? null : txt;
  return parseBR(txt);
}

/**
 * Adivinha o tipo de uma coluna desconhecida olhando o conteúdo:
 * se a maioria das células parece número, trata como número; senão, texto.
 */
function adivinharTipo(amostras) {
  const uteis = amostras.filter((s) => s && s !== '-');
  if (uteis.length === 0) return 'texto';
  const numericas = uteis.filter((s) => parseBR(s) !== null).length;
  return numericas / uteis.length >= 0.7 ? 'num' : 'texto';
}

/**
 * Lê a tabela HTML do Fundamentus e devolve linhas + um relatório de casamento
 * de colunas.
 *
 * Duas garantias importantes:
 *  - colunas são casadas por NOME, então reordenação na fonte não afeta nada;
 *  - coluna que não bate com nenhum campo conhecido NÃO é descartada: vai para
 *    `extra`, e aparece no relatório. Nada some sem você ficar sabendo.
 */
export function lerTabela(html, campos) {
  const $ = cheerio.load(html);
  const tabela = acharTabela($);
  if (!tabela) throw new Error('Nenhuma tabela encontrada no HTML da fonte.');

  const trs = $(tabela).find('tr').toArray();
  if (trs.length < 2) throw new Error('Tabela encontrada, mas sem linhas de dados.');

  // --- cabeçalho ---------------------------------------------------------
  const trCabecalho = trs.find((tr) => $(tr).find('th').length > 0) ?? trs[0];
  const cabecalhos = $(trCabecalho)
    .find('th, td')
    .toArray()
    .map((c) => $(c).text().replace(/\s+/g, ' ').trim());

  // nome normalizado -> chave do campo
  const porNome = new Map();
  for (const c of campos) {
    for (const nome of c.nomes) porNome.set(normalizar(nome), c);
  }

  const colunas = cabecalhos.map((titulo, i) => {
    const def = porNome.get(normalizar(titulo));
    return def
      ? { i, chave: def.chave, tipo: def.tipo, titulo, conhecida: true }
      : { i, chave: `extra_${normalizar(titulo) || i}`, tipo: null, titulo, conhecida: false };
  });

  // --- linhas ------------------------------------------------------------
  const inicio = trs.indexOf(trCabecalho) + 1;
  const brutas = [];
  for (const tr of trs.slice(inicio)) {
    const tds = $(tr).find('td').toArray();
    if (tds.length < 2) continue; // linha de separação/rodapé
    brutas.push(tds.map((td) => $(td).text().replace(/\s+/g, ' ').trim()));
  }

  // tipo das colunas desconhecidas, inferido do conteúdo
  for (const col of colunas) {
    if (!col.conhecida) {
      col.tipo = adivinharTipo(brutas.slice(0, 60).map((r) => r[col.i]));
    }
  }

  const linhas = brutas
    .map((celulas) => {
      const obj = {};
      const extra = {};
      for (const col of colunas) {
        const valor = converter(celulas[col.i] ?? '', col.tipo);
        if (col.conhecida) obj[col.chave] = valor;
        else extra[col.chave] = valor;
      }
      if (Object.keys(extra).length) obj.extra = extra;
      return obj;
    })
    .filter((l) => l.ticker); // descarta linhas sem papel

  // --- relatório ---------------------------------------------------------
  const casadas = colunas.filter((c) => c.conhecida).map((c) => c.chave);
  const relatorio = {
    cabecalhosLidos: cabecalhos,
    casadas,
    naoCasadas: colunas.filter((c) => !c.conhecida).map((c) => c.titulo),
    ausentes: campos.map((c) => c.chave).filter((k) => !casadas.includes(k)),
  };

  return { linhas, relatorio };
}
