/**
 * Interface da triagem.
 *
 * Três regras que o código segue de propósito:
 *   - não esconde: toda coluna do universo está disponível;
 *   - não pontua: nenhum ranking, nota ou "recomendado" — só o número da fonte;
 *   - não decide: só some da tela o que VOCÊ filtrou.
 */

const $ = (s) => document.querySelector(s);
const criar = (tag, cls, texto) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (texto != null) el.textContent = texto;
  return el;
};

const estado = {
  dados: null,
  campos: null,
  universo: 'acao',
  filtros: [],
  ordem: { chave: 'dy', dir: 'desc' },
  ocultas: new Set(),
};

/* ---------------------------------------------------------------- formatação */

const NUM = (casas) => new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: casas, maximumFractionDigits: casas,
});

function formatar(valor, tipo) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (tipo === 'texto') return String(valor);
  if (typeof valor !== 'number') return String(valor);

  if (tipo === 'pct') return `${NUM(2).format(valor)}%`;
  if (tipo === 'dinheiro') {
    const abs = Math.abs(valor);
    if (abs >= 1e9) return `${NUM(2).format(valor / 1e9)} bi`;
    if (abs >= 1e6) return `${NUM(1).format(valor / 1e6)} mi`;
    return NUM(2).format(valor);
  }
  return NUM(2).format(valor);
}

/* ------------------------------------------------------------------- colunas */

function colunas() {
  const { acao, fii, comuns } = estado.campos;
  if (estado.universo === 'acao') return acao;
  if (estado.universo === 'fii') return fii;
  // "ambos": só o que existe nos dois universos, mais o tipo do ativo
  const porChave = new Map([...acao, ...fii].map((c) => [c.chave, c]));
  return [
    ...comuns.map((k) => porChave.get(k)).filter(Boolean),
    { chave: 'tipo', rotulo: 'Tipo', tipo: 'texto' },
  ];
}

const colunasVisiveis = () => colunas().filter((c) => !estado.ocultas.has(c.chave));

/* ------------------------------------------------------------------- filtros */

const OPERADORES = {
  '>=': { rotulo: '≥', num: true, testa: (v, a) => v >= a },
  '<=': { rotulo: '≤', num: true, testa: (v, a) => v <= a },
  '>':  { rotulo: '>', num: true, testa: (v, a) => v > a },
  '<':  { rotulo: '<', num: true, testa: (v, a) => v < a },
  '==': { rotulo: '=', num: true, testa: (v, a) => v === a },
  'contem':     { rotulo: 'contém', num: false, testa: (v, a) => String(v).toLowerCase().includes(a.toLowerCase()) },
  'preenchido': { rotulo: 'tem valor', num: false, semValor: true, testa: (v) => v !== null && v !== undefined && v !== '' },
};

function aplicarFiltros(ativos) {
  const ativos_ = estado.universo === 'ambos'
    ? ativos
    : ativos.filter((a) => a.tipo === estado.universo);

  return ativos_.filter((ativo) =>
    estado.filtros.every((f) => {
      if (!f.chave) return true;
      const op = OPERADORES[f.op];
      if (!op) return true;
      const valor = ativo[f.chave];

      if (op.semValor) return op.testa(valor);
      if (f.valor === '' || f.valor === null) return true; // filtro sem valor não filtra

      if (op.num) {
        // ausência não passa em comparação numérica: null não é ≥ 10
        if (typeof valor !== 'number') return false;
        const alvo = Number(String(f.valor).replace(',', '.'));
        return Number.isFinite(alvo) ? op.testa(valor, alvo) : true;
      }
      if (valor === null || valor === undefined) return false;
      return op.testa(valor, f.valor);
    }),
  );
}

function desenharFiltros() {
  const caixa = $('#filtros');
  caixa.replaceChildren();

  estado.filtros.forEach((filtro, i) => {
    const linha = criar('div', 'filtro');

    const selCampo = criar('select');
    selCampo.append(new Option('— campo —', ''));
    for (const c of colunas()) {
      const op = new Option(c.rotulo, c.chave);
      op.selected = c.chave === filtro.chave;
      selCampo.append(op);
    }
    selCampo.onchange = () => { filtro.chave = selCampo.value; render(); };

    const selOp = criar('select', 'op');
    for (const [chave, def] of Object.entries(OPERADORES)) {
      const op = new Option(def.rotulo, chave);
      op.selected = chave === filtro.op;
      selOp.append(op);
    }
    selOp.onchange = () => { filtro.op = selOp.value; render(); };

    const entrada = criar('input');
    entrada.type = 'text';
    entrada.value = filtro.valor ?? '';
    entrada.placeholder = 'valor';
    entrada.disabled = OPERADORES[filtro.op]?.semValor === true;
    entrada.oninput = () => { filtro.valor = entrada.value; render(); };

    const remover = criar('button', 'remover', '×');
    remover.title = 'remover filtro';
    remover.onclick = () => { estado.filtros.splice(i, 1); render(); };

    linha.append(selCampo, selOp, entrada, remover);
    caixa.append(linha);
  });
}

/* ------------------------------------------------------------------- tabela */

function ordenar(lista) {
  const { chave, dir } = estado.ordem;
  const def = colunas().find((c) => c.chave === chave);
  if (!def) return lista;
  const sinal = dir === 'asc' ? 1 : -1;

  return [...lista].sort((a, b) => {
    const va = a[chave], vb = b[chave];
    // ausência vai sempre para o fim, nos dois sentidos: um P/L vazio não pode
    // ganhar a ordenação de "menor P/L"
    const na = va === null || va === undefined;
    const nb = vb === null || vb === undefined;
    if (na && nb) return 0;
    if (na) return 1;
    if (nb) return -1;
    if (def.tipo === 'texto') return sinal * String(va).localeCompare(String(vb), 'pt-BR');
    return sinal * (va - vb);
  });
}

function desenharTabela(lista) {
  const cols = colunasVisiveis();
  const cabecalho = $('#tabela thead');
  const corpo = $('#tabela tbody');
  cabecalho.replaceChildren();
  corpo.replaceChildren();

  const tr = criar('tr');
  for (const c of cols) {
    const th = criar('th', c.tipo === 'texto' ? 'txt' : '');
    th.append(c.rotulo);
    if (estado.ordem.chave === c.chave) {
      th.append(criar('span', 'seta', estado.ordem.dir === 'asc' ? '▲' : '▼'));
    }
    th.onclick = () => {
      estado.ordem = estado.ordem.chave === c.chave
        ? { chave: c.chave, dir: estado.ordem.dir === 'asc' ? 'desc' : 'asc' }
        : { chave: c.chave, dir: c.tipo === 'texto' ? 'asc' : 'desc' };
      render();
    };
    tr.append(th);
  }
  cabecalho.append(tr);

  const frag = document.createDocumentFragment();
  for (const ativo of lista) {
    const linha = criar('tr');
    for (const c of cols) {
      const td = criar('td', c.tipo === 'texto' ? 'txt' : '');
      if (c.chave === 'ticker') {
        const alvo = criar('span', 'ticker', ativo.ticker);
        alvo.onclick = () => abrirFicha(ativo.ticker);
        td.append(alvo);
        if (estado.universo === 'ambos') td.append(criar('span', 'marca', ativo.tipo));
      } else {
        const texto = formatar(ativo[c.chave], c.tipo);
        if (texto === null) td.append(criar('span', 'nulo', '—'));
        else td.append(texto);
      }
      linha.append(td);
    }
    frag.append(linha);
  }
  corpo.append(frag);

  $('#vazio').classList.toggle('oculto', lista.length > 0);
}

function desenharPainelColunas() {
  const painel = $('#painel-colunas');
  painel.replaceChildren();
  for (const c of colunas()) {
    const label = criar('label');
    const cx = criar('input');
    cx.type = 'checkbox';
    cx.checked = !estado.ocultas.has(c.chave);
    cx.onchange = () => {
      if (cx.checked) estado.ocultas.delete(c.chave);
      else estado.ocultas.add(c.chave);
      render();
    };
    label.append(cx, c.rotulo);
    painel.append(label);
  }
}

/* --------------------------------------------------------------------- ficha */

async function abrirFicha(ticker) {
  $('#ficha-titulo').textContent = ticker;
  const corpo = $('#ficha-corpo');
  corpo.replaceChildren(criar('p', 'carregando', 'Buscando a ficha completa no Fundamentus…'));
  $('#ficha').classList.remove('oculto');
  $('#fundo').classList.remove('oculto');

  const doSnapshot = estado.dados.ativos.find((a) => a.ticker === ticker);

  try {
    const resposta = await fetch(`/api/detalhe/${encodeURIComponent(ticker)}`);
    const ficha = await resposta.json();
    if (!resposta.ok) throw new Error(ficha.erro ?? `erro ${resposta.status}`);

    corpo.replaceChildren();
    corpo.append(criar('h3', null,
      ficha.doCache ? 'Ficha completa (do cache local, < 24h)' : 'Ficha completa (buscada agora)'));

    const tabela = criar('table');
    for (const [rotulo, valor] of Object.entries(ficha.campos)) {
      const tr = criar('tr');
      tr.append(criar('td', null, rotulo), criar('td', null, valor.texto));
      tabela.append(tr);
    }
    corpo.append(tabela);
  } catch (erro) {
    corpo.replaceChildren(criar('p', 'erro', `Não deu para buscar a ficha: ${erro.message}`));
  }

  if (doSnapshot) {
    const cols = (estado.campos[doSnapshot.tipo] ?? []);
    corpo.append(criar('h3', null, `Do snapshot de ${estado.dados.data}`));
    const tabela = criar('table');
    for (const c of cols) {
      if (c.chave === 'ticker') continue;
      const tr = criar('tr');
      tr.append(criar('td', null, c.rotulo), criar('td', null, formatar(doSnapshot[c.chave], c.tipo) ?? '—'));
      tabela.append(tr);
    }
    corpo.append(tabela);
  }
}

function fecharFicha() {
  $('#ficha').classList.add('oculto');
  $('#fundo').classList.add('oculto');
}

/* ---------------------------------------------------------------- comparação */

function comparar() {
  const pedidos = $('#tickers').value.toUpperCase().split(/[\s,;]+/).filter(Boolean);
  const alvo = $('#comparacao');
  alvo.replaceChildren();
  if (!pedidos.length) return;

  const achados = pedidos
    .map((t) => estado.dados.ativos.find((a) => a.ticker === t))
    .filter(Boolean);
  const faltando = pedidos.filter((t) => !estado.dados.ativos.some((a) => a.ticker === t));

  if (!achados.length) {
    alvo.append(criar('p', 'vazio', `Nenhum desses tickers está no snapshot: ${pedidos.join(', ')}`));
    return;
  }

  // união dos campos dos tipos envolvidos, preservando a ordem de cada universo
  const tipos = [...new Set(achados.map((a) => a.tipo))];
  const campos = [];
  const vistos = new Set();
  for (const tipo of tipos) {
    for (const c of estado.campos[tipo]) {
      if (c.chave !== 'ticker' && !vistos.has(c.chave)) { vistos.add(c.chave); campos.push(c); }
    }
  }

  const tabela = criar('table');
  const thead = criar('thead');
  const trTopo = criar('tr');
  trTopo.append(criar('th', 'txt', ''));
  for (const a of achados) {
    const th = criar('th');
    const alvoTicker = criar('span', 'ticker', a.ticker);
    alvoTicker.onclick = () => abrirFicha(a.ticker);
    th.append(alvoTicker);
    trTopo.append(th);
  }
  thead.append(trTopo);

  const tbody = criar('tbody');
  for (const c of campos) {
    const tr = criar('tr');
    tr.append(criar('td', 'txt', c.rotulo));
    for (const a of achados) {
      const texto = formatar(a[c.chave], c.tipo);
      const td = criar('td');
      if (texto === null) td.append(criar('span', 'nulo', '—'));
      else td.append(texto);
      tr.append(td);
    }
    tbody.append(tr);
  }
  tabela.append(thead, tbody);
  alvo.append(tabela);

  if (faltando.length) {
    alvo.append(criar('p', 'nota', `Não encontrados no snapshot: ${faltando.join(', ')}`));
  }
}

/* ----------------------------------------------------------------------- csv */

function baixarCsv(lista) {
  const cols = colunasVisiveis();
  const escapar = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const celula = (ativo, c) => {
    const v = ativo[c.chave];
    if (v === null || v === undefined) return '';
    // vírgula decimal e ponto e vírgula como separador: abre direto no Excel BR
    return typeof v === 'number' ? escapar(String(v).replace('.', ',')) : escapar(v);
  };

  const linhas = [
    cols.map((c) => escapar(c.rotulo)).join(';'),
    ...lista.map((a) => cols.map((c) => celula(a, c)).join(';')),
  ];

  const blob = new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = criar('a');
  link.href = url;
  link.download = `b3-${estado.universo}-${estado.dados.data}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/* -------------------------------------------------------------------- render */

let ultimaLista = [];

function render() {
  desenharFiltros();
  desenharPainelColunas();

  const filtrados = aplicarFiltros(estado.dados.ativos);
  ultimaLista = ordenar(filtrados);
  desenharTabela(ultimaLista);

  const universo = estado.universo === 'ambos'
    ? estado.dados.contagem.total
    : estado.dados.contagem[estado.universo];
  $('#contagem').replaceChildren();
  $('#contagem').append(criar('b', null, String(ultimaLista.length)), ` de ${universo} ativos`);

  $('#nota-ambos').classList.toggle('oculto', estado.universo !== 'ambos');
}

/* --------------------------------------------------------------------- setup */

const PRESETS = {
  dy10: [{ chave: 'dy', op: '>=', valor: '10' }],
  liquidez: [{ chave: 'liquidez', op: '>=', valor: '1000000' }],
  limpar: [],
};

async function iniciar() {
  const [resDados, resCampos] = await Promise.all([fetch('/api/dados'), fetch('/api/campos')]);

  if (!resDados.ok) {
    const { erro } = await resDados.json().catch(() => ({ erro: 'falha ao ler os dados' }));
    document.body.replaceChildren(criar('p', 'erro', erro));
    return;
  }

  estado.dados = await resDados.json();
  estado.campos = await resCampos.json();

  $('#meta').replaceChildren();
  $('#meta').append(
    criar('div', null, `snapshot de ${estado.dados.data}`),
    criar('div', null, `${estado.dados.contagem.acao} ações · ${estado.dados.contagem.fii} FIIs`),
  );
  $('#aviso-demo').classList.toggle('oculto', !estado.dados.demo);

  // colunas novas que apareceram na fonte e ainda não têm campo definido
  const novas = [...(estado.dados.colunasNovas?.acao ?? []), ...(estado.dados.colunasNovas?.fii ?? [])];
  if (novas.length) {
    $('#meta').append(criar('div', null, `colunas novas na fonte: ${novas.join(', ')}`));
  }

  $('#universo').onclick = (e) => {
    const botao = e.target.closest('button');
    if (!botao) return;
    [...$('#universo').children].forEach((b) => b.classList.toggle('ativa', b === botao));
    estado.universo = botao.dataset.uni;
    estado.ocultas.clear();
    // filtro de campo que não existe no novo universo perde a referência
    const validas = new Set(colunas().map((c) => c.chave));
    estado.filtros = estado.filtros.filter((f) => validas.has(f.chave));
    if (!validas.has(estado.ordem.chave)) estado.ordem = { chave: 'dy', dir: 'desc' };
    render();
  };

  $('#add-filtro').onclick = () => {
    estado.filtros.push({ chave: '', op: '>=', valor: '' });
    render();
  };

  document.querySelectorAll('[data-preset]').forEach((botao) => {
    botao.onclick = () => {
      estado.filtros = structuredClone(PRESETS[botao.dataset.preset]);
      render();
    };
  });

  $('#colunas-btn').onclick = () => $('#painel-colunas').classList.toggle('oculto');
  $('#csv').onclick = () => baixarCsv(ultimaLista);
  $('#comparar').onclick = comparar;
  $('#tickers').onkeydown = (e) => { if (e.key === 'Enter') comparar(); };
  $('#fechar-ficha').onclick = fecharFicha;
  $('#fundo').onclick = fecharFicha;
  document.onkeydown = (e) => { if (e.key === 'Escape') fecharFicha(); };

  document.querySelectorAll('.aba').forEach((aba) => {
    aba.onclick = () => {
      document.querySelectorAll('.aba').forEach((a) => a.classList.toggle('ativa', a === aba));
      $('#modo-garimpo').classList.toggle('oculto', aba.dataset.modo !== 'garimpo');
      $('#modo-consulta').classList.toggle('oculto', aba.dataset.modo !== 'consulta');
    };
  });

  estado.filtros = structuredClone(PRESETS.dy10);
  render();
}

iniciar();
