import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lerTabela } from '../src/parse.js';
import { validar } from '../src/validar.js';
import { CAMPOS_ACAO, CAMPOS_FII } from '../src/campos.js';
import { parseBR, normalizar } from '../src/util.js';

const fixture = (n) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');

test('parseBR entende o formato brasileiro', () => {
  assert.equal(parseBR('1.234,56'), 1234.56);
  assert.equal(parseBR('14,20%'), 14.2);
  assert.equal(parseBR('380.500.000.000,00'), 380_500_000_000);
  assert.equal(parseBR('-1,20'), -1.2);
  assert.equal(parseBR('0,00'), 0);
  assert.equal(parseBR('-'), null, 'traço é ausência, não zero');
  assert.equal(parseBR(''), null);
});

test('normalizar ignora acento, caixa e pontuação', () => {
  assert.equal(normalizar('Dív.Brut/ Patrim.'), 'divbrutpatrim');
  assert.equal(normalizar('Vacância Média'), 'vacanciamedia');
});

test('lê a tabela de ações e casa todas as colunas conhecidas', () => {
  const { linhas, relatorio } = lerTabela(fixture('acoes.html'), CAMPOS_ACAO);

  assert.equal(linhas.length, 3);
  assert.deepEqual(relatorio.ausentes, [], 'nenhum campo conhecido pode faltar');

  const petr = linhas[0];
  assert.equal(petr.ticker, 'PETR4');
  assert.equal(petr.cotacao, 38.42);
  assert.equal(petr.dy, 14.2);
  assert.equal(petr.roe, 22.1);
  assert.equal(petr.liquidez, 1_850_400_000);
  assert.equal(petr.divBrutPatrim, 0.85);
});

test('escolhe a tabela maior, ignorando tabelas de layout', () => {
  const { linhas } = lerTabela(fixture('acoes.html'), CAMPOS_ACAO);
  assert.ok(linhas.every((l) => l.ticker), 'nenhuma linha do rodapé vazou');
});

test('coluna desconhecida vai para `extra`, nunca é descartada', () => {
  const { linhas, relatorio } = lerTabela(fixture('acoes.html'), CAMPOS_ACAO);
  assert.deepEqual(relatorio.naoCasadas, ['Coluna Nova']);
  assert.equal(linhas[0].extra.extra_colunanova, 'abc');
});

test('valores ausentes viram null, não zero', () => {
  const { linhas } = lerTabela(fixture('acoes.html'), CAMPOS_ACAO);
  const bbas = linhas[1];
  assert.equal(bbas.pCapGiro, null);
  assert.equal(bbas.roic, null);
  assert.equal(bbas.divBrutPatrim, 0, 'zero de verdade continua zero');
});

test('reordenar as colunas na fonte não quebra a leitura', () => {
  const original = fixture('acoes.html');
  // troca Cotação e P/L de lugar, no cabeçalho e nas linhas
  const trocado = original
    .replace('<th>Cotação</th><th>P/L</th>', '<th>P/L</th><th>Cotação</th>')
    .replace('<td>38,42</td><td>7,15</td>', '<td>7,15</td><td>38,42</td>');

  const { linhas } = lerTabela(trocado, CAMPOS_ACAO);
  assert.equal(linhas[0].cotacao, 38.42, 'casamento é por nome, não por posição');
  assert.equal(linhas[0].pl, 7.15);
});

test('lê a tabela de FIIs com os campos próprios do universo', () => {
  const { linhas, relatorio } = lerTabela(fixture('fiis.html'), CAMPOS_FII);
  assert.deepEqual(relatorio.ausentes, []);

  const hglg = linhas[0];
  assert.equal(hglg.ticker, 'HGLG11');
  assert.equal(hglg.segmento, 'Logística');
  assert.equal(hglg.dy, 8.45);
  assert.equal(hglg.vacancia, 3.2);
  assert.equal(hglg.qtdImoveis, 18);

  assert.equal(linhas[1].vacancia, null, 'FII de papel não tem vacância');
});

test('validação reprova tabela truncada', () => {
  const { linhas, relatorio } = lerTabela(fixture('acoes.html'), CAMPOS_ACAO);
  const problemas = validar('acao', linhas, relatorio);
  assert.ok(problemas.some((p) => p.includes('linhas')), '3 linhas deve reprovar');
});

test('validação reprova quando a coluna de DY some', () => {
  const semDy = fixture('acoes.html').replace('<th>Div.Yield</th>', '<th>Outra Coisa</th>');
  const { linhas, relatorio } = lerTabela(semDy, CAMPOS_ACAO);
  const problemas = validar('acao', linhas, relatorio);
  assert.ok(problemas.some((p) => p.includes('dy')), 'DY ausente tem que reprovar');
});

test('validação reprova leitura deslocada (tickers implausíveis)', () => {
  const { linhas, relatorio } = lerTabela(fixture('acoes.html'), CAMPOS_ACAO);
  const deslocado = linhas.map((l) => ({ ...l, ticker: '38,42' }));
  const problemas = validar('acao', deslocado, relatorio);
  assert.ok(problemas.some((p) => p.includes('formato plausível')));
});
