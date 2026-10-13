# Rotina

Agenda da família, tarefas da casa, finanças, lista de compras e arquivos importantes, a dois. Funciona no iPhone, no Android e no computador (Windows ou Mac), instalável sem loja.

## Como funciona

| Camada | Onde fica | O que faz |
|---|---|---|
| App | Este repositório, publicado no GitHub Pages | Telas. Abre na hora com os últimos dados guardados no aparelho e funciona sem internet |
| Servidor | Apps Script ligado a uma planilha Google (`servidor/`) | Login, gravação, revezamento e trocas das tarefas, lembretes da agenda, notificações, agenda para o calendário do celular |
| Dados | Planilha "Rotina" | Uma aba por assunto. Nada de dado pessoal fica neste repositório |

- Entrada: código de convite da casa + nome + PIN. Login depois: nome + PIN. 5 erros bloqueiam 15 minutos.
- Na planilha ficam só hashes do PIN e das sessões.
- O app chama a API com POST e JSON em `text/plain`, como o RM, o Rumo e o RACHA.
- Toda mudança aparece na hora e passa por uma fila no aparelho: sem internet, sai quando a conexão voltar.
- O app busca o que a outra pessoa mudou a cada 30 segundos enquanto está aberto.

Passo a passo para colocar no ar: [IMPLANTAR.md](IMPLANTAR.md).

## Celular e computador

| Onde | Como fica |
|---|---|
| iPhone e Android | Menu embaixo, uma coluna, painéis que sobem de baixo. Instala pela tela de início |
| Computador (Windows, Mac) e tablet deitado | A partir de 900 px de largura: menu lateral, telas em duas colunas, janelas centralizadas, valores dos gráficos ao passar o mouse. Instala pelo Edge ou Chrome e abre numa janela própria, com atalho no menu Iniciar |

Atalhos de teclado no computador: `1` a `6` trocam de tela, `N` abre um item novo da tela atual (compromisso, tarefa ou lançamento), `/` vai para a busca ou o campo de adicionar, `Esc` fecha. O ícone instalado no Windows tem atalhos (botão direito): Agenda, Novo lançamento, Finanças e Lista de compras.

Os dados são os mesmos em todos os aparelhos: cada um entra com o próprio nome e PIN.

## Telas

| Tela | O que tem |
|---|---|
| Hoje | Compromissos de hoje (e de amanhã, à noite), suas tarefas do dia, pedidos de troca, contas e faturas que vencem nos próximos 5 dias, resumo do mês, metas e a lista de compras |
| Agenda | Calendário da família: próximos dias, semana ou mês, uma cor por pessoa, filtro por pessoa, "quem leva", lembretes, conversa no compromisso e o combinado da semana |
| Tarefas | Tudo o que precisa ser feito, numa lista só: o que é de uma vez (renovar o passaporte) e o que se repete (lavar a louça), com responsável ou revezamento, prazo, passos, troca e placar de esforço |
| Finanças | Oito abas: Resumo, Extrato, Contas, Cartões, Orçamento, Metas, Patrimônio e Investimentos (detalhes abaixo) |
| Arquivos | Documentos da família num lugar só: carteirinha do plano, receitas, RG das crianças, contratos, manuais. Busca, categorias, validade com aviso e os importantes guardados no aparelho para abrir sem internet. No celular, fica no ícone de pasta no topo |
| Compras | Lista compartilhada organizada pelos corredores do mercado. "2 leite, pão, café" vira três itens. Depois: lançar o gasto e limpar |

## Finanças

| Aba | O que tem |
|---|---|
| Resumo | Saldo do mês, receitas, despesas e investido, taxa de poupança, saldo previsto até o fim do mês, alertas, gráfico dos últimos 6 meses, divisão da renda (50/30/20), maiores gastos, metas e patrimônio |
| Extrato | Todos os lançamentos do mês com filtros (despesas, receitas, cartão, investimentos, a pagar) e busca |
| Contas | O que falta pagar e receber no mês (contas fixas, boletos agendados e faturas), o que já foi pago e o cadastro das contas fixas e receitas recorrentes |
| Cartões | Fatura atual de cada cartão (aberta, fechada, paga ou vencida), limite usado e disponível, parcelas já comprometidas nos próximos meses, pagar fatura |
| Orçamento | Limite por categoria com média dos últimos 3 meses, alertas aos 85% e ao passar, e a divisão da renda entre essenciais, estilo de vida e futuro |
| Metas | Juntar um valor até uma data, investir um valor todo mês, ou reduzir (a fatura do cartão, uma categoria, uma dívida). A meta do cartão mede a soma das faturas que vencem no mês, o mesmo valor que aparece no banco. Modelos prontos: reserva de emergência, investir todo mês, reduzir o cartão, quitar dívida, sonho |
| Patrimônio | Patrimônio líquido e sua evolução, onde está investido, contas, investimentos, bens, dívidas e cartões a pagar |
| Investimentos | Total investido, aplicado e rendimento bruto (R$ e %), pontos de atenção (acima do limite do FGC por instituição, posições zeradas ou abaixo do aplicado, concentração, saldos desatualizados), distribuição por tipo e por emissor, evolução e a lista de posições ordenável por saldo ou rendimento |

### Regras de cálculo

- **Competência:** a despesa conta no mês em que aconteceu. Compra parcelada: cada parcela no seu mês e na fatura certa.
- **Fatura:** compra feita no dia do fechamento ou depois entra na fatura seguinte. A fatura leva o nome do mês do vencimento. Compra importada de uma fatura fica na fatura de onde veio (coluna `Fatura` na planilha), mesmo que a data diga outra coisa.
- **Pagar a fatura não é despesa nova:** as compras já foram contadas. O pagamento só tira o dinheiro da conta e quita o cartão.
- **Investir não é despesa:** é dinheiro que sai da conta e entra no patrimônio. Conta como "futuro" na divisão da renda.
- **Saldos:** cada conta, investimento ou dívida guarda o último valor informado ("Atualizar saldo") e soma os movimentos depois dele.
- **Rendimento de um investimento** = saldo − aplicado. Aplicado = o total informado no cadastro (vale na data do primeiro saldo) + aportes − resgates lançados depois. Bruto, antes de impostos.
- **FGC:** garante até R$ 250 mil por CPF por instituição em CDB, LCI, LCA, RDB, poupança e conta (o app considera Renda fixa e Reserva, menos Tesouro). Fundos, FIIs, ações, exterior, previdência e cripto não têm FGC.
- **Patrimônio líquido** = contas + investimentos + bens − dívidas − saldo devedor dos cartões (incluindo parcelas futuras).
- **Reserva de emergência sugerida** = 6 meses das despesas essenciais (média dos últimos 3 meses).

## Agenda

- **Escrever do jeito que se fala:** "pediatra do Pedro sexta 14h" já vira um compromisso de saúde, do Pedro, na sexta às 14h. Confira e salve.
- **Família:** além de vocês dois, dá para cadastrar filhos, avós ou o pet (sem login). Cada um tem cor e emoji, e o aniversário entra sozinho na agenda, todo ano.
- **Quem leva:** compromisso de quem não usa o app (o Pedro no pediatra) mostra "quem leva?" até alguém tocar em "Eu levo".
- **Lembretes:** escolha quantos quiser, de "na hora" a "1 semana antes" (padrão: 1 dia e 1 hora antes; saúde: 1 dia e 2 horas antes; dia inteiro: na véspera às 19h). Vão só para quem está envolvido, ou para todos.
- **Repetir:** todo dia, semana, mês ou ano, com data final. Dá para tirar só uma data ("não vai ter futebol dia 16") ou apagar a série toda.
- **Conversa:** comentários dentro do compromisso ("levar a carteirinha"), em vez de perder no WhatsApp. Também cria uma tarefa a partir dele.
- **Combinado da semana:** domingo às 19h o app chama os dois para 15 minutos juntos: ver a semana, decidir quem leva e quem faz.
- **No calendário do celular:** perfil › "Ver a agenda no calendário do celular" dá um endereço para assinar no iPhone, Outlook ou Google Agenda (só leitura, atualiza sozinho). Cada compromisso também baixa como `.ics`.

## Importar a fatura do cartão

Finanças › Cartões › **Importar fatura** (ou, dentro da fatura, "Importar planilha").

- **Arquivos aceitos:** CSV, Excel (.xlsx, .xls), OFX ou linhas coladas do Excel ou do Google Planilhas. Serve o arquivo exportado pelo banco (Nubank, Inter, C6, Itaú…) ou a **planilha modelo** do app: Data, Descrição, Valor, Categoria, Parcela, Observação.
- **Colunas pelo nome**, em qualquer ordem. Datas como 05/10/2026, 2026-10-05 ou 05/10 (o ano é deduzido); valores como 1.234,56 ou 1234.56. Compras negativas (alguns bancos) são invertidas.
- **Revisão antes de lançar:** a fatura é sugerida pelas datas; dá para desmarcar linhas e trocar a categoria de cada uma. A categoria vem da planilha, de uma compra igual já lançada antes ou do nome da loja (Uber → Transporte, iFood → Restaurante e delivery…).
- **Conferência:** digite o total que o banco mostra e o app diz se bate ou quanto falta.
- **Sem duplicar:** o que já está no app (mesmo valor e parcela) fica de fora. Dá para importar a mesma fatura de novo.
- **Parcelas:** "Loja 3/10" entra na fatura importada e, se quiser, as parcelas 4/10 a 10/10 já entram nas próximas faturas (e no limite usado). Na próxima importação, elas são reconhecidas.
- **Pagamento da fatura** que vier no arquivo fica de fora (pague pelo botão Pagar). **Estorno** entra como crédito, abatendo a fatura e a categoria.
- **Desfazer:** logo depois de importar, o aviso tem "Desfazer", que apaga tudo o que entrou.
- PDF não dá para ler: no banco, procure "exportar" ou "baixar em CSV/Excel". O leitor de Excel é baixado da internet na primeira vez que você abre um .xlsx.

## Arquivos e anexos

- **Onde ficam:** no Google Drive de quem implantou o servidor, numa pasta "Rotina · Arquivos" criada sozinha. Na planilha (aba Arquivos) fica só a ficha. Quem tem login na casa abre tudo pelo app, sem precisar de conta no Drive nem de compartilhar nada.
- **Anexos:** em cada compromisso (a receita do pediatra, a guia do plano), tarefa (o boleto do IPVA), lançamento (comprovante, nota fiscal) e conta fixa. Na conta fixa, o **boleto de cada mês** fica separado (aparece em "A pagar" com 📎 e de novo na hora de pagar) e os **documentos da conta** (contrato, código do cliente) valem para todos os meses. O anexo também aparece na tela Arquivos.
- **Links:** guarde só o endereço de uma pasta ou arquivo do Google Drive (ou de um site). Para a outra pessoa abrir, o arquivo precisa estar compartilhado com ela no Drive.
- **Fotos:** foto de 3 a 6 MB do celular vira um JPEG de até 2400 px antes de subir: dá para ler uma receita e sobe rápido. Limite: 10 MB por arquivo.
- **Sem internet:** o arquivo escolhido fica guardado no aparelho e sobe quando a conexão voltar. Os marcados como ⭐ importantes ficam no aparelho dos dois para abrir sem internet (no consultório, na portaria). Cada aparelho guarda até ~150 MB de cópias.
- **Validade:** passaporte, CNH, carteirinha, apólice. O app avisa 30 dias antes, 7 dias antes e no dia, para as pessoas marcadas no documento. Vale só para documento solto: anexo de tarefa, compromisso ou conta segue o prazo de onde está anexado (se um anexo antigo tiver data, ele oferece "Usar como prazo da tarefa").
- **Excluir:** a ficha some para os dois e o arquivo vai para a lixeira do Drive (dá para recuperar por 30 dias).

## Tarefas e compras

- **Uma lista só:** o que antes era "afazer" e "pendência" agora é tarefa. A diferença é só se ela repete ou não. Filtros: Minhas, De Ana, Nós dois, Rotina da casa.
- **Quem faz:** uma pessoa, nós dois ou revezando. No revezamento, quem faz passa a vez para o outro. Se um faz no lugar do outro, a próxima é de quem não fez. Ninguém faz duas seguidas.
- **Troca:** quem está com a tarefa pede para o outro fazer esta vez. Aceita, faz no lugar; no rodízio, a vez seguinte volta para quem pediu.
- **Esforço (leve 1, médio 2, pesado 3):** o placar soma pontos, não tarefas. Lavar o banheiro não vale o mesmo que regar as plantas. O objetivo é enxergar a divisão, inspirado no método *Fair Play*.
- **Pular esta vez** (viagem, não precisou): a data anda, a vez não muda e não conta ponto.
- **Próximo passo:** cada tarefa pode ter um checklist curto, área (casa, saúde, documentos, carro…) e prazo. As que repetem (IPTU, seguro, revisão do carro) já marcam a próxima data ao serem concluídas.
- **Compras** se agrupam pelos corredores do mercado (hortifrúti, padaria, açougue…), adivinhados pelo nome; tocar no item muda o setor.

## Arquivos

| Arquivo | Para quê |
|---|---|
| `index.html` | Estrutura e estilos (aparência clara e escura) |
| `config.js` | Endereço /exec da API |
| `nucleo.js` | Datas, repetição, revezamento, ocorrências e lembretes da agenda e ciclo do cartão, iguais no app e no servidor (cópia em `servidor/Nucleo.gs`, via `build.sh`) |
| `base.js` | Estado, armazenamento no aparelho, API, fila offline e sincronização |
| `financas.js` | Cálculos de finanças: mês, contas a pagar, faturas, orçamento, metas e patrimônio |
| `graficos.js` | Gráficos em SVG (colunas, linha, barra empilhada) com valores no toque e tabela |
| `telas.js` | Telas Hoje, Tarefas e Compras |
| `agenda.js` | Tela, painéis e ações da Agenda e da família |
| `arquivos.js` | Tela Arquivos, anexos, envio e cópias no aparelho |
| `importar.js` | Importar fatura do cartão (CSV, Excel, OFX, colado) |
| `invest.js` | Finanças › Investimentos: análise da carteira |
| `telas-fin.js` | Telas, painéis e ações de Finanças |
| `paineis.js` | Painéis de tarefa, troca, item de compra e perfil |
| `acoes.js` | O que cada toque faz, login e inicialização |
| `push.js` | Notificações (Firebase Cloud Messaging) |
| `sw.js` | Guarda o app no aparelho e mostra as notificações. Trocar `VERSAO` a cada publicação |
| `servidor/*.gs` | Código do Apps Script |

## Planilha

| Aba | Uma linha por |
|---|---|
| Config | Ajuste (nome da casa, convite, categorias e orçamento, divisão da renda, fuso, Firebase) |
| Pessoas, Sessoes | Pessoa da casa e aparelho conectado |
| Tarefas | Tarefa (repetição, quem faz, de quem é a vez, próxima data ou prazo, área, passos em JSON, esforço, troca em andamento) |
| Feitos | Vez em que uma tarefa foi feita (ou pulada), por quem, quando e quantos pontos |
| Eventos | Compromisso (data, hora, quem, quem leva, lembretes, repetição, datas tiradas, conversa) |
| Perfis | Pessoa da família sem login (filho, avó, pet), com cor, emoji e aniversário |
| Arquivos | Ficha de um arquivo ou link (nome, categoria, de quem, onde está anexado, validade, ID no Google Drive) |
| Lancamentos | Despesa, receita, pagamento de fatura, aporte, resgate ou transferência. `Valor` em reais com ponto (ex.: `87.50`) |
| Contas | Conta fixa, receita recorrente ou aporte mensal |
| Cartoes | Cartão (limite, dia de fechamento e de vencimento) |
| Patrimonio | Conta, investimento, bem ou dívida, com o histórico de saldos informados |
| Metas | Meta da família |
| Compras | Item da lista |
| Push | Aparelho com notificação ligada |

As abas antigas `Afazeres` e `Pendencias` (versão 2) são copiadas para `Tarefas` sozinhas na primeira vez que a versão 3 roda, e ficam lá intactas.

As colunas são encontradas pelo nome do cabeçalho: uma versão nova que acrescente colunas não estraga os dados antigos. Nada é apagado de verdade: excluir marca `Excluido = sim`. Dá para montar tabelas dinâmicas direto na aba Lancamentos.
