#!/usr/bin/env node
/**
 * Gera dados/atual.json a partir das fixtures de teste, para você abrir a
 * interface e mexer nos filtros sem depender da coleta. São 5 ativos de
 * mentira, marcados como demo — serve para ver a página funcionando.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { lerTabela } from './parse.js';
import { CAMPOS_ACAO, CAMPOS_FII } from './campos.js';
import { hojeSP } from './util.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = (n) => readFile(join(RAIZ, 'testes/fixtures', n), 'utf8');

const acoes = lerTabela(await fixture('acoes.html'), CAMPOS_ACAO).linhas.map((l) => ({ ...l, tipo: 'acao' }));
const fiis = lerTabela(await fixture('fiis.html'), CAMPOS_FII).linhas.map((l) => ({ ...l, tipo: 'fii' }));

await mkdir(join(RAIZ, 'dados'), { recursive: true });
await writeFile(join(RAIZ, 'dados/atual.json'), JSON.stringify({
  data: hojeSP(),
  geradoEm: new Date().toISOString(),
  fonte: 'DEMO — dados de exemplo, não são reais',
  demo: true,
  contagem: { acao: acoes.length, fii: fiis.length, total: acoes.length + fiis.length },
  colunasNovas: { acao: [], fii: [] },
  ativos: [...acoes, ...fiis],
}));

console.log(`demo: ${acoes.length} ações + ${fiis.length} FIIs em dados/atual.json`);
