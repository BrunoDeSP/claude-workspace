#!/usr/bin/env node
/**
 * Coletor — roda 1× por dia. Duas requisições no total.
 *
 *   buscar (2 req) -> validar -> gravar dados/atual.json + cópia datada
 *
 * Se a validação reprovar, NADA é gravado: o dado de ontem, que estava certo,
 * continua no lugar. Dado velho é melhor que dado errado.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buscarListagem, LISTAGENS } from './fontes/fundamentus.js';
import { validar } from './validar.js';
import { hojeSP, esperar } from './util.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR_DADOS = join(RAIZ, 'dados');

const log = (...a) => console.log(...a);

async function coletarTipo(tipo) {
  log(`\n[${tipo}] buscando ${LISTAGENS[tipo].caminho} ...`);
  const { linhas, relatorio } = await buscarListagem(tipo);

  log(`[${tipo}] ${linhas.length} linhas, ${relatorio.casadas.length}/${LISTAGENS[tipo].campos.length} colunas conhecidas casadas`);
  if (relatorio.naoCasadas.length) {
    log(`[${tipo}] colunas novas na fonte (guardadas em "extra"): ${relatorio.naoCasadas.join(', ')}`);
  }
  if (relatorio.ausentes.length) {
    log(`[${tipo}] ATENÇÃO — campos esperados que não vieram: ${relatorio.ausentes.join(', ')}`);
    log(`[${tipo}] cabeçalho lido da fonte: ${relatorio.cabecalhosLidos.join(' | ')}`);
  }

  const problemas = validar(tipo, linhas, relatorio);
  if (problemas.length) {
    throw new Error(`Coleta de ${tipo} reprovada:\n  - ${problemas.join('\n  - ')}`);
  }

  log(`[${tipo}] validado`);
  return { linhas, relatorio };
}

async function main() {
  const data = hojeSP();
  log(`Coleta ${data} — fonte: Fundamentus`);

  const resultados = {};
  for (const tipo of Object.keys(LISTAGENS)) {
    resultados[tipo] = await coletarTipo(tipo);
    await esperar(2000); // intervalo educado entre as duas requisições
  }

  const ativos = [...resultados.acao.linhas, ...resultados.fii.linhas];
  const saida = {
    data,
    geradoEm: new Date().toISOString(),
    fonte: 'Fundamentus (fundamentus.com.br)',
    contagem: {
      acao: resultados.acao.linhas.length,
      fii: resultados.fii.linhas.length,
      total: ativos.length,
    },
    colunasNovas: {
      acao: resultados.acao.relatorio.naoCasadas,
      fii: resultados.fii.relatorio.naoCasadas,
    },
    ativos,
  };

  await mkdir(join(DIR_DADOS, 'hist'), { recursive: true });
  const json = JSON.stringify(saida);
  await writeFile(join(DIR_DADOS, 'atual.json'), json);
  await writeFile(join(DIR_DADOS, 'hist', `${data}.json`), json);

  const kb = Math.round(json.length / 1024);
  log(`\nOK — ${saida.contagem.acao} ações + ${saida.contagem.fii} FIIs (${kb} KB)`);
  log(`     dados/atual.json`);
  log(`     dados/hist/${data}.json`);
}

main().catch(async (erro) => {
  console.error(`\nFALHOU: ${erro.message}`);
  const atual = join(DIR_DADOS, 'atual.json');
  if (existsSync(atual)) {
    const anterior = JSON.parse(await readFile(atual, 'utf8'));
    console.error(`Nada foi sobrescrito. O snapshot de ${anterior.data} continua valendo.`);
  } else {
    console.error('Nenhum snapshot anterior existe — a aplicação ainda não tem dados.');
  }
  process.exitCode = 1;
});
