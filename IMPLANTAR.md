# Como colocar o Rotina no ar

São 3 partes. As partes 1 e 2 levam uns 15 minutos e já deixam o app funcionando para vocês dois. A parte 3 (notificações) pode ser feita depois.

| Parte | O que faz | Tempo |
|---|---|---|
| 1. Servidor | Planilha + Apps Script: guarda os dados da casa | 10 min |
| 2. App | GitHub Pages + endereço do servidor no `config.js` | 5 min |
| 3. Notificações | Firebase (dá para reaproveitar o do RM) | 10 min |

---

## 1. Servidor (planilha + Apps Script)

1. No Google Drive, crie uma planilha nova chamada **Rotina**.
2. Na planilha: **Extensões › Apps Script**.
3. No editor, crie 4 arquivos (botão **+** › Script), com estes nomes e o conteúdo dos arquivos da pasta `servidor/` deste repositório:

   | Arquivo no Apps Script | Copiar de |
   |---|---|
   | `Nucleo` | `servidor/Nucleo.gs` |
   | `Dados` | `servidor/Dados.gs` |
   | `Api` | `servidor/Api.gs` |
   | `Push` | `servidor/Push.gs` |

   Pelo celular: abra `https://raw.githubusercontent.com/brunomathias8-droid/rotina/main/servidor/Api.gs` no Safari, toque e segure › Selecionar tudo › Copiar. Repita para cada arquivo.
4. Apague o arquivo `Código.gs` que veio vazio.
5. No topo, escolha a função **configurar** e toque em **Executar**. Na primeira vez o Google pede autorização: **Revisar permissões › sua conta › Avançado › Acessar Rotina (não seguro) › Permitir**. É o seu próprio script pedindo acesso à sua planilha.
6. O registro de execução mostra o **código de convite** (ex.: `K7X2QM`). Ele também fica na aba **Config** da planilha.
7. **Implantar › Nova implantação** › tipo **App da Web**:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
8. Copie o endereço que termina em **/exec**.

> "Qualquer pessoa" só quer dizer que o app consegue chamar o servidor sem login do Google. Os dados continuam protegidos: tudo exige nome + PIN, e na planilha o PIN e as sessões ficam só como hash.

## 2. App (GitHub Pages)

1. No repositório `rotina`, abra `config.js` e cole o endereço /exec na linha `api: ''`. Salve (commit).
2. **Settings › Pages** › Source: **Deploy from a branch** › Branch: **main** › pasta **/(root)** › Save.
3. Em 1 ou 2 minutos o app fica em **https://brunomathias8-droid.github.io/rotina/**.

### Primeiro acesso (você)

1. Abra o endereço no Safari do iPhone.
2. **Primeiro acesso**: código de convite + seu nome + um PIN.
3. Instale: **Compartilhar › Adicionar à Tela de Início**. Abra pelo ícone e entre de novo (o app instalado tem um armazenamento separado do Safari).
4. Em **Casa**, toque nas sugestões (lavar a louça, tirar o lixo…) ou crie os afazeres de vocês.
5. Em **Finanças › Resumo**, siga o "Comece por aqui" (uns 15 minutos, com o app do banco aberto ao lado):
   1. Contas do banco com o saldo de hoje (Patrimônio › + Conta).
   2. Cartões de crédito com o dia de fechamento e de vencimento.
   3. Salários e contas fixas (aluguel, luz, internet, escola, assinaturas).
   4. Orçamento por categoria. Depois de 1 a 3 meses de uso, o botão "Preencher com a média" ajuda.
   5. A primeira meta: comece pela reserva de emergência.

### No computador (Windows)

1. Abra **https://brunomathias8-droid.github.io/rotina/** no **Edge** ou no **Chrome** e entre com o mesmo nome e PIN.
2. Instale: ícone de instalar na barra de endereço, à direita (ou menu **⋯ › Aplicativos › Instalar este site como um aplicativo**). O Rotina abre numa janela própria e aparece no menu Iniciar; dá para fixar na barra de tarefas.
3. Notificações no computador: avatar › Notificações › Ativar. Confira em **Configurações do Windows › Sistema › Notificações** se o Edge ou o Chrome estão liberados.

### Chamar sua esposa

No app: toque no seu avatar (canto de cima) › **Convidar**. O link já leva o código. Ela cria o próprio nome e PIN e entra no rodízio dos afazeres na hora.

> A casa aceita 2 pessoas. Para mais gente (um filho, por exemplo), mude `max_pessoas` na aba Config.

---

## 3. Notificações (Firebase)

Dá para usar o **mesmo projeto Firebase do RM e do RACHA**. Copie da aba Config de um deles para a aba Config do Rotina:

| Chave | De onde vem |
|---|---|
| `firebase_web_config` | Console do Firebase › Configurações do projeto › Seus apps › bloco `firebaseConfig` |
| `firebase_vapid_key` | Cloud Messaging › Web Push certificates › par de chaves |
| `firebase_service_account` | Contas de serviço › Gerar nova chave privada (arquivo JSON inteiro) |

> No RM e no RACHA a conta de serviço já saiu da planilha e foi para as Propriedades do script. Se não tiver mais o arquivo JSON, gere uma chave nova no console do Firebase (Contas de serviço › Gerar nova chave privada). A chave antiga continua valendo para os outros apps.

Depois, no Apps Script, execute **ativarAvisos** (cria o gatilho de hora em hora). No app: avatar › **Notificações › Ativar**. No iPhone, só funciona com o app instalado na tela de início.

| Aviso | Quando |
|---|---|
| Seus afazeres do dia | Às 8h (muda em Config › `hora_avisos`) |
| Pendências com prazo hoje ou amanhã | Às 8h |
| Conta fixa, boleto agendado ou fatura vencendo | Às 8h, 2 dias antes e no dia |
| Pedido de troca, troca aceita ou recusada | Na hora |
| Pendência passada para você ou concluída | Na hora |
| Itens novos na lista de compras | Na hora, no máximo 1 a cada 10 min (desligado de início) |
| Resumo da semana (pontos de cada um, pendências resolvidas, gastos) | Domingo às 19h |
| Fechamento do mês (receitas, despesas, investido e metas de investir) | Dia 1, às 8h |

Entre 22h e 7h nenhum aviso é enviado. Cada pessoa escolhe quais quer receber.

---

## Atualizar o app depois

| Mudou | O que fazer |
|---|---|
| Telas (arquivos `.js`, `index.html`) | Trocar `VERSAO` em `sw.js` e enviar. O app se atualiza sozinho na próxima abertura |
| Servidor (`servidor/*.gs`) | Colar no Apps Script › **Implantar › Gerenciar implantações › editar › Versão: Nova versão**. O endereço /exec não muda |
| Regras de datas e rodízio (`nucleo.js`) | Rodar `./build.sh` (copia para `servidor/Nucleo.gs`) e atualizar os dois lados |

## Rotina mensal sugerida (10 minutos, no dia 1)

1. Abrir **Finanças › Resumo** do mês que fechou: sobrou ou faltou? A divisão da renda ficou perto do 50/30/20?
2. **Patrimônio**: atualizar o saldo de cada conta e investimento (está no app do banco).
3. **Orçamento**: ajustar as categorias que passaram três meses seguidos.
4. **Metas**: ver o que está em "atenção" e combinar o mês seguinte.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| "Resposta inesperada do servidor" | Implantação não está como "Qualquer pessoa", ou o endereço não termina em /exec |
| Alguém esqueceu o PIN | No Apps Script, edite `redefinirPinAqui` com o nome e um PIN novo e execute |
| Celular perdido | Rode `encerrarTodasSessoes` |
| "A casa já está completa" | Aumente `max_pessoas` na aba Config |
