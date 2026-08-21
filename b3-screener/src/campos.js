/**
 * Dicionário de campos.
 *
 * Cada campo lista os `nomes` que o cabeçalho da fonte pode ter. O casamento é
 * feito por nome normalizado, nunca por posição — se o Fundamentus reordenar as
 * colunas, nada quebra. Se ele RENOMEAR uma coluna, o campo fica sem casar e o
 * coletor avisa em vez de ler a coluna errada em silêncio.
 *
 * tipo:  num (número puro) | pct (percentual) | dinheiro (R$) | texto
 */

const campo = (chave, rotulo, tipo, ...nomes) => ({ chave, rotulo, tipo, nomes });

export const CAMPOS_ACAO = [
  campo('ticker',        'Papel',          'texto',    'Papel'),
  campo('cotacao',       'Cotação',        'dinheiro', 'Cotação'),
  campo('pl',            'P/L',            'num',      'P/L'),
  campo('pvp',           'P/VP',           'num',      'P/VP'),
  campo('psr',           'PSR',            'num',      'PSR'),
  campo('dy',            'Div.Yield',      'pct',      'Div.Yield', 'Dividend Yield', 'DY'),
  campo('pAtivo',        'P/Ativo',        'num',      'P/Ativo'),
  campo('pCapGiro',      'P/Cap.Giro',     'num',      'P/Cap.Giro'),
  campo('pEbit',         'P/EBIT',         'num',      'P/EBIT'),
  campo('pAtivCircLiq',  'P/Ativ Circ.Liq','num',      'P/Ativ Circ.Liq'),
  campo('evEbit',        'EV/EBIT',        'num',      'EV/EBIT'),
  campo('evEbitda',      'EV/EBITDA',      'num',      'EV/EBITDA'),
  campo('mrgEbit',       'Mrg Ebit',       'pct',      'Mrg Ebit', 'Mrg. Ebit'),
  campo('mrgLiq',        'Mrg. Líq.',      'pct',      'Mrg. Líq.', 'Mrg Liq'),
  campo('liqCorr',       'Liq. Corr.',     'num',      'Liq. Corr.', 'Liquidez Corrente'),
  campo('roic',          'ROIC',           'pct',      'ROIC'),
  campo('roe',           'ROE',            'pct',      'ROE'),
  campo('liquidez',      'Liq. 2 meses',   'dinheiro', 'Liq.2meses', 'Liquidez 2 meses'),
  campo('patrimLiq',     'Patrim. Líq',    'dinheiro', 'Patrim. Líq', 'Patrimônio Líquido'),
  campo('divBrutPatrim', 'Dív.Brut/Patrim','num',      'Dív.Brut/ Patrim.', 'Dív. Bruta/Patrim.'),
  campo('crescRec5a',    'Cresc. Rec.5a',  'pct',      'Cresc. Rec.5a', 'Crescimento Receita 5 anos'),
];

export const CAMPOS_FII = [
  campo('ticker',       'Papel',           'texto',    'Papel'),
  campo('segmento',     'Segmento',        'texto',    'Segmento'),
  campo('cotacao',      'Cotação',         'dinheiro', 'Cotação'),
  campo('ffoYield',     'FFO Yield',       'pct',      'FFO Yield'),
  campo('dy',           'Dividend Yield',  'pct',      'Dividend Yield', 'Div.Yield', 'DY'),
  campo('pvp',          'P/VP',            'num',      'P/VP'),
  campo('valorMercado', 'Valor de Mercado','dinheiro', 'Valor de Mercado'),
  campo('liquidez',     'Liquidez',        'dinheiro', 'Liquidez'),
  campo('qtdImoveis',   'Qtd Imóveis',     'num',      'Qtd de imóveis', 'Quantidade de imóveis'),
  campo('precoM2',      'Preço do m²',     'dinheiro', 'Preço do m2', 'Preço do m²'),
  campo('aluguelM2',    'Aluguel por m²',  'dinheiro', 'Aluguel por m2', 'Aluguel por m²'),
  campo('capRate',      'Cap Rate',        'pct',      'Cap Rate'),
  campo('vacancia',     'Vacância Média',  'pct',      'Vacância Média'),
];

/** Campos que existem nos dois universos — a única base honesta de comparação. */
export const CAMPOS_COMUNS = ['ticker', 'cotacao', 'dy', 'pvp', 'liquidez'];

export const CAMPOS_POR_TIPO = { acao: CAMPOS_ACAO, fii: CAMPOS_FII };

/** Mapa chave -> definição, juntando os dois universos (para a UI). */
export const TODOS_CAMPOS = new Map(
  [...CAMPOS_ACAO, ...CAMPOS_FII].map((c) => [c.chave, c]),
);
