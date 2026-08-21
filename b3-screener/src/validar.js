/**
 * Barreira de sanidade entre a fonte e o disco.
 *
 * Scraping quebra em silêncio: um redesign na origem faz o parser ler a coluna
 * errada, e você fica filtrando P/VP achando que é DY. As checagens aqui existem
 * para que uma coleta ruim FALHE em vez de sobrescrever o dado bom.
 */

const REGRAS = {
  acao: { minimo: 250, camposObrigatorios: ['ticker', 'cotacao', 'dy'] },
  fii:  { minimo: 80,  camposObrigatorios: ['ticker', 'cotacao', 'dy'] },
};

const FORMATO_TICKER = /^[A-Z]{4}\d{1,2}[A-Z]?$/;

export function validar(tipo, linhas, relatorio) {
  const regra = REGRAS[tipo];
  const problemas = [];

  if (linhas.length < regra.minimo) {
    problemas.push(
      `só ${linhas.length} linhas (esperado ao menos ${regra.minimo}) — a fonte pode ter mudado ou respondido parcialmente`,
    );
  }

  for (const chave of regra.camposObrigatorios) {
    if (relatorio.ausentes.includes(chave)) {
      problemas.push(`coluna obrigatória "${chave}" não foi encontrada no cabeçalho`);
    }
  }

  const comTickerValido = linhas.filter((l) => FORMATO_TICKER.test(l.ticker ?? '')).length;
  if (linhas.length && comTickerValido / linhas.length < 0.8) {
    problemas.push(
      `só ${comTickerValido}/${linhas.length} tickers têm formato plausível — provável leitura de coluna errada`,
    );
  }

  const comCotacao = linhas.filter((l) => typeof l.cotacao === 'number').length;
  if (linhas.length && comCotacao / linhas.length < 0.5) {
    problemas.push(`só ${comCotacao}/${linhas.length} linhas têm cotação numérica`);
  }

  return problemas;
}
