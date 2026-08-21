# Triagem B3

Reduz o universo da bolsa a uma lista curta, para você aplicar seu critério em cima
dela. Ações e FIIs, filtro por qualquer campo, dado local.

Não pontua ativo, não recomenda nada e não esconde coluna. A leitura é sua.

## Como rodar

```bash
cd b3-screener
npm install

npm run demo      # 5 ativos de exemplo, para ver a interface funcionando
npm start         # abre em http://localhost:3000

npm run coletar   # busca o snapshot real do Fundamentus (2 requisições)
```

`npm run demo` existe para você abrir a página sem depender da coleta. Os dados
são falsos e a interface avisa isso no topo.

## Por que existe um coletor separado da página

O navegador não consegue buscar direto na fonte — o Fundamentus não manda
cabeçalho de CORS, e uma página em `file://` não faz `fetch` de arquivo local.
Mais importante: buscar ao vivo faria o número de requisições crescer com o seu
uso.

Então o dado é coletado **uma vez por dia** e a página lê a cópia local:

```
coletar.js  ──2 requisições──▶  dados/atual.json  ──▶  página (filtro em memória)
   1× por dia                        ~1000 ativos          0 requisições
```

O que isso compra: você pode filtrar o dia inteiro sem tocar na rede. O volume de
requisições passou a depender do calendário, não do seu uso.

| Ação | Requisições |
|---|---|
| Coleta diária | 2 (ações + FIIs) |
| Abrir a página e filtrar à vontade | 0 |
| Abrir a ficha de um ativo | 1, com cache de 24h |

## As duas telas

**Garimpo** — escolhe o universo (Ações, FIIs ou Ambos), empilha filtros sobre
qualquer campo, ordena por qualquer coluna, exporta CSV. Começa com `DY ≥ 10%`
aplicado, que dá para limpar num clique.

**Consulta** — você digita os tickers que já conhece e compara lado a lado.

Clicar num ticker, em qualquer das duas, busca a **ficha completa** daquele ativo
no Fundamentus — as ~40 informações que não cabem na listagem (setor, valor de
mercado, LPA, VPA, últimos balanços, oscilações). Uma requisição, só quando você
pede, guardada por 24h.

## Campos

**Ações (21):** Cotação · P/L · P/VP · PSR · Div.Yield · P/Ativo · P/Cap.Giro ·
P/EBIT · P/Ativ Circ.Liq · EV/EBIT · EV/EBITDA · Mrg Ebit · Mrg. Líq. ·
Liq. Corr. · ROIC · ROE · Liq. 2 meses · Patrim. Líq · Dív.Brut/Patrim ·
Cresc. Rec.5a

**FIIs (13):** Segmento · Cotação · FFO Yield · Dividend Yield · P/VP ·
Valor de Mercado · Liquidez · Qtd Imóveis · Preço do m² · Aluguel por m² ·
Cap Rate · Vacância Média

Ação e FII vêm de páginas diferentes e têm colunas diferentes — vacância não
existe para ação, ROE não existe para FII. No modo **Ambos** só aparecem os cinco
campos que os dois universos compartilham (ticker, cotação, DY, P/VP, liquidez),
que é onde comparar os dois faz sentido.

**Não tem:** preço em tempo real (a cotação é de fechamento, com atraso), balanço
trimestral aberto, proventos individuais com data-com, consenso de analistas,
notícias. Serve para escolher o que estudar, não para operar.

## Como isso não quebra em silêncio

Scraping não tem contrato: a fonte pode mudar o layout a qualquer momento. O risco
real não é o coletor falhar — é ele continuar rodando e ler a coluna errada, e
você filtrar `DY ≥ 10` em cima do P/VP sem perceber.

Três defesas:

1. **Colunas são casadas por nome, nunca por posição.** Se o Fundamentus reordenar
   as colunas, nada muda. Se renomear uma, o campo fica sem casar e o coletor
   reclama, em vez de ler a vizinha.
2. **Coluna nova não é descartada.** Vai para `extra` na linha e é anunciada no fim
   da coleta, para você decidir se vira campo de primeira classe em `src/campos.js`.
3. **Validação antes de gravar.** Número mínimo de linhas, presença das colunas
   obrigatórias, formato dos tickers, proporção de cotações numéricas. Se algo
   reprova, **nada é gravado** e o snapshot do dia anterior continua valendo.
   Dado velho é melhor que dado errado.

```bash
npm run teste   # 11 testes cobrindo o parser e as validações
```

Os testes rodam sobre HTML de exemplo em `testes/fixtures/`, incluindo os casos
de coluna reordenada, coluna nova, coluna obrigatória ausente e leitura deslocada.

## Coleta automática

`.github/workflows/b3-coletar.yml` roda a coleta no GitHub Actions, hoje só em
execução manual. Para ligar o cron diário, veja as instruções no topo do arquivo —
elas dependem de o repositório estar privado, porque commitar os dados coletados
significa republicar a base da fonte.

## Estrutura

```
src/
  campos.js       definição dos campos e seus nomes na fonte
  parse.js        HTML da tabela -> objetos (casamento por nome)
  validar.js      barreira de sanidade antes de gravar
  coletar.js      orquestra a coleta diária
  fontes/
    fundamentus.js   a única parte que conhece a fonte
  servidor.js     serve a página, os dados e a ficha sob demanda
  demo.js         gera dados de exemplo a partir das fixtures
web/              interface (sem build, sem framework)
dados/            snapshot atual + cópias datadas (fora do git)
```

A fonte está isolada em `src/fontes/`. Trocar Fundamentus por outra origem é
escrever um arquivo novo ali com a mesma saída — o resto do sistema não muda.

## Ressalvas sobre os dados

- **DY alto quase nunca é uma empresa saudável e barata.** Os casos que aparecem
  costumam ser dividendo extraordinário não recorrente, preço em queda livre, ou
  papel sem liquidez. Cruzar com `Liq. 2 meses` corta boa parte do ruído; o resto é
  leitura sua, na ficha completa.
- A cotação é de fechamento e pode estar atrasada.
- Fonte única: se o Fundamentus estiver com dado errado, você tem dado errado.

## Licença de uso dos dados

Os dados vêm do [Fundamentus](https://www.fundamentus.com.br) e são deles. Este
projeto é de uso pessoal, faz duas requisições por dia e se identifica no
`User-Agent`. `dados/` está no `.gitignore` para não republicar a base.
