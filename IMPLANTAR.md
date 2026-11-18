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
5. No topo, escolha a função **configurar** e toque em **Executar**. Na primeira vez o Google pede autorização: **Revisar permissões › sua conta › Avançado › Acessar Rotina (não seguro) › Permitir**. É o seu próprio script pedindo acesso à sua planilha e ao seu Google Drive (onde ficam os arquivos que vocês guardarem pelo app, na pasta "Rotina · Arquivos").
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
4. Em **Tarefas**, toque nas ideias (lavar a louça, tirar o lixo…) ou crie as tarefas de vocês.
5. Em **Agenda**, toque em **+ Família** para cadastrar filhos (ou quem mais entra na agenda) e escreva o primeiro compromisso, do jeito que se fala: "dentista Ana sexta 14h".
6. Em **Finanças › Resumo**, siga o "Comece por aqui" (uns 15 minutos, com o app do banco aberto ao lado):
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

No app: toque no seu avatar (canto de cima) › **Convidar**. O link já leva o código. Ela cria o próprio nome e PIN e entra no revezamento das tarefas na hora.

> A casa aceita 2 pessoas com login. Filhos e avós não precisam de login para aparecer na agenda: cadastre em **Agenda › + Família**. Para mais gente com login, mude `max_pessoas` na aba Config.

### Agenda no calendário do celular (opcional)

Avatar › **Ver a agenda no calendário do celular** › Copiar. Depois:

- **iPhone:** Ajustes › Calendário › Contas › Adicionar Conta › Outra › Adicionar Calendário Assinado › colar.
- **Outlook (Windows):** Calendário › Adicionar calendário › Assinar da Web › colar.
- **Google Agenda (no computador):** Outras agendas › + › Do URL › colar.

É só leitura: compromissos se criam e mudam no Rotina. O iPhone e o Outlook atualizam de tempos em tempos (de minutos a algumas horas); o Google pode levar até um dia. Os lembretes na hora certa são os do Rotina.

---

## 3. Notificações (Firebase)

Dá para usar o **mesmo projeto Firebase do RM e do RACHA**. Copie da aba Config de um deles para a aba Config do Rotina:

| Chave | De onde vem |
|---|---|
| `firebase_web_config` | Console do Firebase › Configurações do projeto › Seus apps › bloco `firebaseConfig` |
| `firebase_vapid_key` | Cloud Messaging › Web Push certificates › par de chaves |
| `firebase_service_account` | Contas de serviço › Gerar nova chave privada (arquivo JSON inteiro) |

> No RM e no RACHA a conta de serviço já saiu da planilha e foi para as Propriedades do script. Se não tiver mais o arquivo JSON, gere uma chave nova no console do Firebase (Contas de serviço › Gerar nova chave privada). A chave antiga continua valendo para os outros apps.

Depois, no Apps Script, execute **ativarAvisos** (cria dois gatilhos: um de hora em hora e um a cada 5 minutos, para os lembretes da agenda). No app: avatar › **Notificações › Ativar**. No iPhone, só funciona com o app instalado na tela de início.

| Aviso | Quando |
|---|---|
| Lembrete de compromisso (só para quem está envolvido, ou todos) | No horário escolhido em cada compromisso, com até 5 minutos de diferença. Chega mesmo entre 22h e 7h |
| Compromisso novo, mudado ou com comentário novo | Na hora |
| Sua agenda e suas tarefas do dia | Às 8h (muda em Config › `hora_avisos`) |
| Documento perto de vencer (para quem está marcado nele) | Às 8h, 30 dias antes, 7 dias antes e no dia |
| Conta fixa, boleto agendado ou fatura vencendo | Às 8h, 2 dias antes e no dia |
| Pedido de troca, troca aceita ou recusada | Na hora |
| Tarefa passada para você ou concluída | Na hora |
| Itens novos na lista de compras | Na hora, no máximo 1 a cada 10 min (desligado de início) |
| Hora do combinado da semana (compromissos dos próximos 7 dias, placar das tarefas, gastos) | Domingo às 19h |
| Fechamento do mês (receitas, despesas, investido e metas de investir) | Dia 1, às 8h |

Entre 22h e 7h nenhum aviso é enviado, a não ser os lembretes de compromisso. Cada pessoa escolhe quais quer receber.

---

## Ligar a Luar, a coach financeira (servidor 3.6, app 3.9)

A Luar lê os números do Rotina, conversa em Finanças › Luar (e no Telegram) e manda no máximo uma mensagem por turno: 8h, 13h e 20h. Domingo à noite faz o check-in da semana; no dia 1, o fechamento do mês.

**1. Atualizar o servidor**
1. No Apps Script, troque o conteúdo de `Dados`, `Api` e `Push` pelos novos e crie três arquivos novos com o conteúdo de `servidor/Luar.gs`, `servidor/Telegram.gs` e `servidor/Banco.gs` (botão **+ › Script**, nomes `Luar`, `Telegram` e `Banco`).
2. **Implantar › Gerenciar implantações › editar › Versão: Nova versão**.

**2. Chave da Anthropic (obrigatória)**
1. Em [console.anthropic.com](https://console.anthropic.com): crie a conta, ponha crédito (US$ 10 dá para começar) e crie uma chave em **API Keys**. Em **Limits**, ponha um limite mensal de gasto (por exemplo US$ 12) para nunca passar do combinado.
2. No Apps Script: **Configurações do projeto (engrenagem) › Propriedades do script › Adicionar**: `ANTHROPIC_API_KEY` = a chave.
3. Opcional: `LUAR_MODELO`. O padrão é `claude-opus-5-5`, a melhor. Cada resposta custa uns US$ 0,04 a 0,06: só os turnos dão uns US$ 5 por mês, e cada 10 conversas por dia somam uns US$ 15. Para caber em R$ 50 conversando bastante, use `claude-sonnet-5-5` (cerca da metade do preço, ainda muito boa). `claude-haiku-5-5` custa centavos, mas é bem menos esperta. O app mostra o gasto do mês em Luar › Ajustes.
4. Escolha a função `ativarLuar` e clique em **Executar** (autorize se pedir). Ela cria as abas `Luar`, `Banco` e `BancoContas` e os gatilhos.
5. No app: Finanças › Luar › **Ajustes** › preencha o **Perfil da família** (renda, dívidas, filhos, metas). Isso fica só nas propriedades do script, nunca no GitHub.

Para conferir sem gastar: `verContextoLuar` mostra no registro tudo o que a Luar recebe. `testarLuar` faz uma pergunta de verdade.

**3. Telegram (opcional)**
1. No Telegram, fale com **@BotFather**, mande `/newbot`, escolha nome e usuário. Ele devolve um token.
2. Propriedade do script `TELEGRAM_TOKEN` = o token. Rode `ativarLuar` de novo.
3. No app: Finanças › Luar › Ajustes › **Gerar código para vincular** e mande `/vincular CÓDIGO` para o bot. Cada um vincula o seu. `/sair` desvincula.

O bot só conversa com quem vinculou por código; para os outros ele responde que é particular. As mensagens chegam em até 1 minuto.

**4. Bancos pelo Open Finance (opcional, só leitura)**
1. Crie conta em [meu.pluggy.ai](https://meu.pluggy.ai) e conecte os bancos (BB, Santander, Nubank, C6, Inter…). Cada banco pede a autorização no app dele; a permissão é só de leitura e pode ser revogada lá a qualquer hora.
2. Em [dashboard.pluggy.ai](https://dashboard.pluggy.ai): crie a conta de desenvolvedor, inclua o conector **MeuPluggy** na aplicação, crie uma **aplicação de desenvolvimento** (anote `client_id` e `client_secret`) e, pela aplicação demo, autorize o MeuPluggy uma vez por banco. Cada autorização gera um **item**; copie os IDs.
3. Propriedades do script: `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET` e `PLUGGY_ITENS` (IDs separados por vírgula). Rode `ativarLuar` de novo.
4. No app: Luar › Ajustes › **Buscar agora**. Depois disso o servidor busca de 4 em 4 horas (o MeuPluggy atualiza os bancos uma vez por dia).

As transações ficam nas abas `Banco` e `BancoContas`; a Luar lê de lá saldos, faturas e gastos do mês, mesmo sem ninguém lançar nada no app.

**5. Do banco para os lançamentos (servidor 3.7, app 3.10)**
1. No Apps Script, troque `Nucleo`, `Dados`, `Api`, `Luar` e `Banco` pelos novos e faça **Nova versão** na implantação.
2. Cadastre no app as contas correntes (Finanças › Patrimônio › Conta), se ainda não estiverem lá, e diga em cada cartão qual conta paga a fatura.
3. Em Luar › Ajustes › Bancos, escolha para cada conta do banco qual cartão ou conta do app ela é, e a data a partir da qual lançar. **Salvar e lançar**.

Daí em diante, a cada busca (de 4 em 4 horas) as transações viram lançamentos e aparecem em tudo: extrato, faturas, orçamento, resumo, análises e Luar.
- O que vocês já tinham lançado à mão (mesmo valor e conta ou cartão, até 3 dias de diferença, ou a mesma parcela) é reconhecido e não duplica.
- Pagamento de fatura que sai da conta vira o pagamento do cartão. O pagamento que aparece no próprio cartão fica de fora.
- Transferência entre as contas de vocês vira transferência, não gasto.
- A categoria vem das regras da casa, do que vocês mais usaram para a mesma loja ou do nome da loja. O que ficar sem categoria vai para Extrato › Revisar.
- Compra ainda pendente no banco só entra quando for confirmada.
- Cada lançamento traz a nota "Open Finance"; na aba `Banco`, a coluna `Lancamento` mostra qual lançamento veio de cada transação.

**Segurança**: nenhuma chave fica no código nem no GitHub, só nas propriedades do script. Nada aqui consegue pagar ou transferir dinheiro. As conversas e os números vão para a API da Anthropic na hora de cada resposta.

## Atualizar da versão 3.4 para a 3.5 (app 3.8: Para comprar, Análises, receita automática)

1. No Apps Script, troque o conteúdo de `Dados`, `Api` e `Push` pelos novos.
2. **Implantar › Gerenciar implantações › editar › Versão: Nova versão**.

As colunas novas aparecem sozinhas na primeira gravação: `Lista`, `Fixo`, `Opcoes`, `Orcamento`, `Prazo`, `Resp`, `Prioridade`, `Categoria`, `Lancamento` e `Nota` em Compras; `Auto` e `AutoDesde` em Contas; `Projeto`, `Reembolso` e `Reembolsado` em Lancamentos. As regras de categoria ficam na aba Config (`regras`).

Enquanto o servidor não for atualizado, o app mostra um aviso em Finanças e em Compras, e o que é novo (itens de Para comprar, receita automática, regras de categoria, viagem e reembolso) não fica guardado.

## Atualizar da versão 3.3 para a 3.4 (investimentos)

1. No Apps Script, troque o conteúdo de `Dados` e `Api` pelos novos.
2. **Implantar › Gerenciar implantações › editar › Versão: Nova versão**.

Sem isso, o "total aplicado" dos investimentos não chega ao app e o rendimento aparece como zero.

## Atualizar da versão 3.2 para a 3.3 (importar fatura)

1. No Apps Script, troque o conteúdo de `Nucleo`, `Dados`, `Api` e `Push` pelos novos.
2. **Implantar › Gerenciar implantações › editar › Versão: Nova versão**.

A coluna `Fatura` aparece sozinha na aba Lancamentos na primeira importação. Sem atualizar o servidor, as compras importadas são gravadas sem a fatura e voltam a ser calculadas pela data.

## Atualizar da versão 3.1 para a 3.2 (boleto na conta fixa)

1. No Apps Script, troque o conteúdo de `Dados` e `Api` pelos novos.
2. **Implantar › Gerenciar implantações › editar › Versão: Nova versão**.

Sem isso, o app até mostra o boleto anexado na conta, mas o servidor grava o arquivo sem a ligação com a conta.

## Atualizar da versão 3.0 para a 3.1 (Arquivos)

1. No Apps Script, troque o conteúdo de `Dados`, `Api` e `Push` pelos novos.
2. Execute **configurar**. O Google pede autorização de novo, agora também para o **Google Drive**: **Revisar permissões › Avançado › Acessar Rotina › Permitir**. Isso cria a aba Arquivos e a pasta "Rotina · Arquivos" no seu Drive.
3. **Implantar › Gerenciar implantações › editar › Versão: Nova versão**.

> Faça o passo 2 antes do 3. Sem a autorização do Drive, enviar arquivo dá erro.

## Atualizar da versão 2 para a 3 (Agenda e Tarefas)

Quem já usa a versão 2:

1. No Apps Script, troque o conteúdo dos 4 arquivos (`Nucleo`, `Dados`, `Api`, `Push`) pelos novos.
2. Execute **configurar**: cria as abas Tarefas, Eventos e Perfis e copia os afazeres e pendências para Tarefas. As abas antigas ficam intactas.
3. Execute **ativarAvisos** de novo, para criar o gatilho de 5 minutos dos lembretes da agenda.
4. **Implantar › Gerenciar implantações › editar › Versão: Nova versão**. O endereço /exec não muda.
5. Abra o app: ele se atualiza sozinho (se não, feche e abra de novo).

## Atualizar o app depois

| Mudou | O que fazer |
|---|---|
| Telas (arquivos `.js`, `index.html`) | Trocar `VERSAO` em `sw.js` e enviar. O app se atualiza sozinho na próxima abertura |
| Servidor (`servidor/*.gs`) | Colar no Apps Script › **Implantar › Gerenciar implantações › editar › Versão: Nova versão**. O endereço /exec não muda |
| Regras de datas, revezamento e agenda (`nucleo.js`) | Rodar `./build.sh` (copia para `servidor/Nucleo.gs`) e atualizar os dois lados |

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
| "A casa já está completa" | Aumente `max_pessoas` na aba Config (ou cadastre a pessoa em Agenda › + Família, sem login) |
| Lembrete de compromisso não chega | Rode `ativarAvisos` de novo e confira em **Acionadores** (relógio) se existe `verificarAgenda` a cada 5 minutos |
| Enviar arquivo dá erro de autorização | Rode **configurar** no editor e aceite o acesso ao Google Drive; depois publique uma nova versão |
| Calendário assinado não aparece | O endereço é o /exec com `?agenda=`; a implantação precisa estar como "Qualquer pessoa" |
