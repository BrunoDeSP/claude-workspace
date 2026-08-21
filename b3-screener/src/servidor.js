#!/usr/bin/env node
/**
 * Servidor local. Existe por dois motivos:
 *
 *  1. O navegador bloqueia fetch() a partir de file://, então a página precisa
 *     ser servida por http para conseguir ler dados/atual.json.
 *  2. O Fundamentus não manda cabeçalho de CORS, então a página não pode buscar
 *     a ficha de um ativo direto. Este servidor faz essa busca por ela.
 *
 * Sem dependências: só node:http e node:fs.
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';
import { buscarDetalhe } from './fontes/fundamentus.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR_WEB = join(RAIZ, 'web');
const DIR_DADOS = join(RAIZ, 'dados');
const DIR_CACHE = join(DIR_DADOS, 'cache');
const PORTA = Number(process.env.PORTA ?? 3000);
const CACHE_MS = 24 * 60 * 60 * 1000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const responder = (res, status, corpo, tipo = 'application/json; charset=utf-8') => {
  res.writeHead(status, { 'Content-Type': tipo });
  res.end(corpo);
};

/**
 * Ficha de um ativo, com cache em disco de 24h.
 * Clicar dez vezes no mesmo ticker no mesmo dia custa uma requisição, não dez.
 */
async function detalhe(ticker) {
  const papel = ticker.toUpperCase();
  if (!/^[A-Z]{4}\d{1,2}[A-Z]?$/.test(papel)) throw Object.assign(new Error('Ticker inválido.'), { status: 400 });

  const arquivo = join(DIR_CACHE, `${papel}.json`);
  try {
    const guardado = JSON.parse(await readFile(arquivo, 'utf8'));
    if (Date.now() - new Date(guardado.buscadoEm).getTime() < CACHE_MS) {
      return { ...guardado, doCache: true };
    }
  } catch { /* sem cache válido: busca na fonte */ }

  const ficha = await buscarDetalhe(papel);
  await mkdir(DIR_CACHE, { recursive: true });
  await writeFile(arquivo, JSON.stringify(ficha));
  return { ...ficha, doCache: false };
}

async function servirEstatico(res, url) {
  // normalize + prefixo impedem que "../" saia do diretório web/
  const caminho = join(DIR_WEB, normalize(url === '/' ? '/index.html' : url));
  if (!caminho.startsWith(DIR_WEB)) return responder(res, 403, 'proibido', 'text/plain');
  try {
    const conteudo = await readFile(caminho);
    responder(res, 200, conteudo, MIME[extname(caminho)] ?? 'application/octet-stream');
  } catch {
    responder(res, 404, 'não encontrado', 'text/plain');
  }
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const rota = decodeURIComponent(url.pathname);

  try {
    if (rota === '/api/dados') {
      try {
        return responder(res, 200, await readFile(join(DIR_DADOS, 'atual.json')));
      } catch {
        return responder(res, 404, JSON.stringify({
          erro: 'Nenhum snapshot encontrado. Rode `npm run coletar` (ou `npm run demo` para dados de exemplo).',
        }));
      }
    }

    if (rota === '/api/campos') {
      // a interface monta colunas e filtros a partir daqui, para que as
      // definições de campo existam num lugar só (src/campos.js)
      const { CAMPOS_ACAO, CAMPOS_FII, CAMPOS_COMUNS } = await import('./campos.js');
      return responder(res, 200, JSON.stringify({ acao: CAMPOS_ACAO, fii: CAMPOS_FII, comuns: CAMPOS_COMUNS }));
    }

    const ficha = rota.match(/^\/api\/detalhe\/([^/]+)$/);
    if (ficha) return responder(res, 200, JSON.stringify(await detalhe(ficha[1])));

    return servirEstatico(res, rota);
  } catch (erro) {
    responder(res, erro.status ?? 502, JSON.stringify({ erro: erro.message }));
  }
});

servidor.listen(PORTA, () => {
  console.log(`b3-screener em http://localhost:${PORTA}`);
});
