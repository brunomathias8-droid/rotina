# Rotina

Afazeres da casa, pendências, finanças e lista de compras, a dois. App instalável no celular (iPhone e Android), sem loja.

## Como funciona

| Camada | Onde fica | O que faz |
|---|---|---|
| App | Este repositório, publicado no GitHub Pages | Telas. Abre na hora com os últimos dados guardados no aparelho e funciona sem internet |
| Servidor | Apps Script ligado a uma planilha Google (`servidor/`) | Login, gravação, rodízio e trocas dos afazeres, notificações |
| Dados | Planilha "Rotina" | Uma aba por assunto. Nada de dado pessoal fica neste repositório |

- Entrada: código de convite da casa + nome + PIN. Login depois: nome + PIN. 5 erros bloqueiam 15 minutos.
- Na planilha ficam só hashes do PIN e das sessões.
- O app chama a API com POST e JSON em `text/plain`, como o RM, o Rumo e o RACHA.
- Toda mudança aparece na hora e passa por uma fila no aparelho: sem internet, sai quando a conexão voltar.
- O app busca o que a outra pessoa mudou a cada 30 segundos enquanto está aberto.

Passo a passo para colocar no ar: [IMPLANTAR.md](IMPLANTAR.md).

## Telas

| Tela | O que tem |
|---|---|
| Hoje | Seus afazeres do dia, pedidos de troca, pendências e contas que vencem logo, resumo do mês e da lista de compras |
| Casa | Afazeres por data (atrasados, hoje, amanhã…), placar da semana, sugestões para começar e o que foi feito nos últimos dias |
| Pendências | Coisas a resolver, com responsável, prazo e marcação de importante |
| Finanças | Saldo do mês, orçamento por categoria, contas fixas (com "Pagar") e os lançamentos |
| Compras | Lista do mercado compartilhada. "2 leite, pão, café" vira três itens. Depois: lançar o gasto e limpar |

## Afazeres: rodízio e troca

- **Quem faz** pode ser: rodízio, uma pessoa fixa ou qualquer um.
- **Rodízio**: quem faz passa a vez para o outro. Se a Ana faz no lugar do Bruno, a próxima vez é do Bruno. Ninguém faz duas seguidas.
- **Troca**: quem está com o afazer pede para o outro fazer esta vez. Se ele aceitar, faz no lugar; no rodízio, a vez seguinte volta para quem pediu.
- **Repetição**: todo dia, dias da semana, dia do mês ou a cada N dias. Feito adiantado não conta duas vezes; "a cada N dias" conta a partir de quando foi feito.
- Um toque errado em "feito" tem "Desfazer": a data e a vez voltam como estavam.

## Arquivos

| Arquivo | Para quê |
|---|---|
| `index.html` | Estrutura e estilos (aparência clara e escura) |
| `config.js` | Endereço /exec da API |
| `nucleo.js` | Datas, repetição e rodízio, iguais no app e no servidor (cópia em `servidor/Nucleo.gs`, via `build.sh`) |
| `base.js` | Estado, armazenamento no aparelho, API, fila offline e sincronização |
| `telas.js` | Telas Hoje, Casa, Pendências, Finanças e Compras |
| `paineis.js` | Painéis (ver e editar afazer, troca, pendência, lançamento, conta fixa, orçamento, perfil) |
| `acoes.js` | O que cada toque faz, login e inicialização |
| `push.js` | Notificações (Firebase Cloud Messaging) |
| `sw.js` | Guarda o app no aparelho e mostra as notificações. Trocar `VERSAO` a cada publicação |
| `servidor/*.gs` | Código do Apps Script |

## Planilha

| Aba | Uma linha por |
|---|---|
| Config | Ajuste (nome da casa, convite, categorias e orçamento, fuso, Firebase) |
| Pessoas, Sessoes | Pessoa da casa e aparelho conectado |
| Afazeres | Afazer (regra de repetição, quem faz, de quem é a vez, próxima data, troca em andamento) |
| Feitos | Vez em que um afazer foi feito, por quem e quando |
| Pendencias | Pendência |
| Lancamentos | Gasto ou entrada. `Valor` em reais com ponto (ex.: `87.50`), `Ref` = mês de referência quando paga uma conta fixa |
| Contas | Conta fixa (valor de sempre e dia do vencimento) |
| Compras | Item da lista |
| Push | Aparelho com notificação ligada |

Nada é apagado de verdade: excluir marca `Excluido = sim`. Dá para montar tabelas dinâmicas e gráficos direto na aba Lancamentos.
