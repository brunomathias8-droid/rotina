# Rotina — guia rápido para o Claude

App da casa (Bruno e Raquel): Agenda, Tarefas, Finanças, Compras, Arquivos. PWA em JS puro no GitHub Pages
(publica sozinho ao dar push no `main`) + Google Apps Script (`servidor/*.gs`) + planilha Google "Rotina".
Textos do app e mensagens de commit em português, no tom dos que já existem.

## Para economizar contexto
- Não leia arquivos inteiros: use `grep -n` e leia só o trecho (`sed -n a,bp`). Os maiores: `telas-fin.js`, `servidor/Dados.gs`.
- Não leia README/IMPLANTAR para entender o código; este arquivo basta.
- Rode só o teste da área mexida (`./testes/rodar.sh fluxoNN`); a bateria completa só antes de publicar.

## Onde fica cada coisa
| Arquivo | O quê |
|---|---|
| `base.js` | estado `S`, API, fila offline (`enfileirar` → `aplicarLocal` → `processarFila`), sincronização, ícones |
| `financas.js` | só cálculo: `resumoMes` (regime de caixa, `mesCaixa`), `agendaMes`/`recorrentesMes`/`previsaoMes`, `fatura`, patrimônio, metas, categorias aprendidas (`lojaDe`, `sugerirCat`, `aRevisar`), `lancarAutomaticos` |
| `telas-fin.js` | telas de Finanças (`FIN_ABAS`, `fin*`), painéis `SH.lanc`/`SH.conta`/…, ações de finanças |
| `analises.js` / `invest.js` | Finanças › Análises / Investimentos |
| `luar.js` + `servidor/Luar.gs` | Luar, a coach financeira (Claude via API): conversa, turnos 8h/13h/20h, ferramentas, caderno. `Telegram.gs` (bot por código) e `Banco.gs` (Open Finance só leitura via MeuPluggy). Chaves só nas propriedades do script |
| `compras.js` | Para comprar (`shPlano`) e Mercado; `telas.js` tem Hoje, Tarefas e itens do mercado |
| `agenda.js`, `arquivos.js`, `importar.js` | Agenda; Arquivos/anexos (Drive); importar fatura |
| `paineis.js` | helpers de formulário (`campo`, `inp`, `escolha`, `segm`, `head`) e painéis gerais |
| `acoes.js` | `A` (ações por `data-a`), render, `VERSAO_APP`, `API_MINIMA` |
| `graficos.js` | gráficos SVG (`grafColunas`, `grafEmpilhado`, `grafLinha`) |
| `nucleo.js` | datas e regras comuns; `build.sh` copia para `servidor/Nucleo.gs` |
| `servidor/Dados.gs` | `ABAS` (cabeçalhos) e `COLECOES` (campos tipados); `Api.gs` tem `API_VERSAO` |

## Convenções
- Valores em centavos no app; na planilha, texto "1234.56". Datas ISO `AAAA-MM-DD`.
- Exclusão é `Excluido=sim`; `Atualizado` (ms) dirige a sincronização.
- Campo novo: `ABAS` + `COLECOES` em `Dados.gs`, subir `API_VERSAO` e `API_MINIMA`, seção em IMPLANTAR.md
  (o usuário precisa atualizar o Apps Script à mão).
- Sem nomes globais repetidos entre arquivos: `grep -ohE "^(const|let|function) [A-Za-z_\$]+" *.js | sort | uniq -d`.
- A cada publicação: subir `VERSAO_APP` (acoes.js) e `VERSAO` (sw.js); arquivo .js novo entra em `index.html` e na `CASCA` do `sw.js`.
- Commits: autor `-c user.name="Bruno Mathias" -c user.email=brunomathias8@gmail.com`, push direto no `main`.
- Dados pessoais (valores, nomes da planilha) nunca no repositório nem nos testes.

## Testes
`cd testes && npm install` (uma vez), depois `./rodar.sh` (todos) ou `./rodar.sh fluxo16`.
Servidor simulado (`servidor-falso.js`, planilha em memória) + Playwright. O `fluxo3` cadastra as pessoas e roda sempre antes.
Fotos das telas ficam em `testes/fotosNN/`. Testes novos: nomes próprios nos dados (outros fluxos compartilham a planilha).
