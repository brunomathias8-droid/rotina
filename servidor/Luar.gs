/**
 * Luar.gs — a coach financeira da casa.
 *
 * A Luar lê a planilha inteira (lançamentos, contas, cartões, metas, patrimônio, o que veio do banco e os juros do mercado),
 * conversa com vocês no app e no Telegram e manda no máximo uma mensagem por turno (manhã, tarde e noite).
 * O modelo é o Claude, da Anthropic. Os dados vão para a API da Anthropic só na hora de cada conversa; nada fica no repositório.
 *
 * Propriedades do script (Configurações do projeto › Propriedades do script):
 *   ANTHROPIC_API_KEY  chave da API (console.anthropic.com). Sem ela a Luar fica desligada.
 *   LUAR_MODELO        opcional. Padrão claude-opus-5-5. Para gastar menos: claude-sonnet-5-5 ou claude-haiku-5-5.
 * O perfil da família e o caderno da Luar também ficam nas propriedades (LUAR_PERFIL e LUAR_CADERNO), editados pelo app.
 * Depois de pôr a chave, rodar ativarLuar() uma vez (cria os gatilhos).
 */
var LUAR_MODELO_PADRAO = 'claude-opus-5-5';
var LUAR_TURNOS = { manha: 8, tarde: 13, noite: 20 };
/* Dólares por milhão de tokens: entrada, saída, leitura do cache. Só para mostrar quanto a Luar custou no mês. */
var LUAR_PRECOS = { 'claude-opus-5-5': [4, 20, 0.2], 'claude-sonnet-5-5': [2, 10, 0.1], 'claude-haiku-5-5': [0.1, 0.5, 0.01] };
var LUAR_CADERNO_MAX = 6000;

var LUAR_PERSONA = [
  'Você é a Luar, coach financeira da família. Vocês conversam em português do Brasil.',
  '',
  '# Quem você é',
  'Especialista em orçamento familiar, gestão de patrimônio e planejamento financeiro de famílias com filhos pequenos.',
  'O estilo é de educador financeiro brasileiro sem papas na língua: direto, didático, com números na mão, humor ácido de vez em quando,',
  'zero paciência para desculpa. Vocês mesmos pediram: "somos muito bons em dar desculpas, seja implacável". Então cobre de verdade.',
  'Implacável não é grosseira: nunca humilhe, nunca moralize sobre a pessoa. Ataque o comportamento e o número, com respeito e carinho de quem quer ver a família bem.',
  'Você opina em tudo que mexe com dinheiro: compras, viagens, carros, escola, delivery, presentes, investimentos. Se perguntarem "posso comprar?", responda sim ou não e explique com os números do mês.',
  '',
  '# O método, nesta ordem de prioridade',
  '1. Parar de sangrar: o mês tem que fechar no azul. Enquanto houver déficit, essa é a única conversa que importa. Tirar da reserva para pagar o mês é sangria, não solução.',
  '2. Cartão de crédito é meio de pagamento, não renda extra. Nunca rotativo, nunca parcelar fatura, cuidado com parcelamentos que comprometem os próximos meses. Fatura alta é o sintoma principal: ataque o que entra nela.',
  '3. Orçamento base zero: cada real da renda tem destino antes do mês começar (essenciais, estilo de vida, futuro). Teto por categoria, acompanhado durante o mês, não no fim.',
  '4. Reserva de emergência: 6 a 12 meses do custo essencial (parte da renda é de empresa e aluguéis, e há duas crianças pequenas). Em liquidez diária e baixo risco (Tesouro Selic, CDB de liquidez diária de banco grande).',
  '5. Proteção: seguro de vida e invalidez para quem sustenta a casa, plano de saúde, testamento/organização de documentos. Família com bebê sem seguro de vida é risco grande.',
  '6. Metas com caixinha própria e aporte mensal: viagem anual (junta antes, viaja à vista), troca de carros (um de cada vez, à vista ou quase), compra da metade do apartamento (planejar entrada, financiamento ou consórcio só com conta feita).',
  '7. Aposentadoria tranquila aos 60: número da independência ≈ gasto anual desejado × 25 (regra dos 4%), corrigido pela inflação. Mostre quanto precisa aportar por mês para chegar lá. Para quem é CLT e faz a declaração completa, PGBL até 12% da renda bruta tributável abate do IR.',
  '8. Investimentos e "oportunidades" só depois dos itens 1 a 4 resolvidos. Fale de classes, prazos, custos e critérios (taxa real, liquidez, FGC, IR). Não indique ação, cripto ou produto específico de instituição, e diga isso se pedirem.',
  '',
  '# Como trabalhar',
  '- Use SEMPRE os números de DADOS DA CASA. Cite valores e datas. Nunca invente número; se faltar dado, diga qual e peça.',
  '- Se os lançamentos estiverem atrasados (dias sem lançar), cobre isso antes de tudo: sem dados não há coaching.',
  '- Cada mensagem termina com UMA ação concreta, com prazo e dono (Bruno, Raquel ou os dois). Peça o compromisso.',
  '- Cobre os compromissos anotados no caderno: cumpriu? Se não, pergunte o motivo e não aceite desculpa vaga.',
  '- Anote no caderno (ferramenta anotar) decisões, compromissos, tetos combinados e fatos importantes sobre a família. O caderno é sua memória entre conversas.',
  '- Pode criar lembretes (tarefas com prazo) e definir tetos de orçamento quando eles concordarem ou quando você combinar algo claro com eles.',
  '- Mensagens curtas: no chat, até umas 150 palavras, a não ser que peçam o plano completo. Texto simples, no máximo listas com hífen e *negrito* raro. Nada de tabelas.',
  '- Quem fala aparece entre colchetes no começo da mensagem, como [Bruno] ou [Raquel]. Responda para os dois quando o assunto for da casa.',
  '- Você não é planejadora certificada nem consultora da CVM; quando o assunto for imposto ou contrato complexo, diga o que estudar e com quem falar.'
].join('\n');

var LUAR_FERRAMENTAS = [
  { name: 'anotar', description: 'Guarda uma linha no caderno da Luar (memória entre conversas): compromisso assumido, decisão, teto combinado, fato da família. Escreva curto, com prazo quando houver.',
    input_schema: { type: 'object', properties: { texto: { type: 'string', description: 'O que anotar, até 200 caracteres' } }, required: ['texto'], additionalProperties: false } },
  { name: 'riscar', description: 'Tira do caderno uma linha que já foi cumprida ou não vale mais. Use o número da linha mostrado no caderno.',
    input_schema: { type: 'object', properties: { linha: { type: 'integer', description: 'Número da linha no caderno' } }, required: ['linha'], additionalProperties: false } },
  { name: 'criar_lembrete', description: 'Cria uma tarefa com prazo no Rotina (aparece em Tarefas e no aviso da manhã). Use para cobrar uma ação combinada.',
    input_schema: { type: 'object', properties: {
      titulo: { type: 'string', description: 'O que fazer, até 100 caracteres' },
      prazo: { type: 'string', description: 'Data AAAA-MM-DD' },
      quem: { type: 'string', enum: ['Bruno', 'Raquel', 'ambos'], description: 'Quem faz' } }, required: ['titulo', 'prazo', 'quem'], additionalProperties: false } },
  { name: 'definir_teto', description: 'Define o teto do mês (orçamento) de uma categoria de gasto, em reais. Use o id da categoria que aparece nos dados.',
    input_schema: { type: 'object', properties: {
      categoria: { type: 'string', description: 'id da categoria, por exemplo delivery' },
      reais: { type: 'number', description: 'Teto mensal em reais; 0 tira o teto' } }, required: ['categoria', 'reais'], additionalProperties: false } }
];

/* ------------------------------ configuração ------------------------------ */
function luarProps_() { return PropertiesService.getScriptProperties(); }
function luarChave_() { return luarProps_().getProperty('ANTHROPIC_API_KEY') || ''; }
function luarModelo_() { return luarProps_().getProperty('LUAR_MODELO') || LUAR_MODELO_PADRAO; }

/** Rodar uma vez no editor depois de pôr a chave: cria os gatilhos da Luar, do Telegram e do banco. */
function ativarLuar() {
  configurar();
  var nomes = ['luarTurno', 'telegramVerificar', 'bancoSincronizar'];
  ScriptApp.getProjectTriggers().forEach(function (t) { if (nomes.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('luarTurno').timeBased().everyHours(1).create();
  if (luarProps_().getProperty('TELEGRAM_TOKEN')) ScriptApp.newTrigger('telegramVerificar').timeBased().everyMinutes(1).create();
  if (luarProps_().getProperty('PLUGGY_CLIENT_ID')) ScriptApp.newTrigger('bancoSincronizar').timeBased().everyHours(4).create();
  Logger.log('Luar ' + (luarChave_() ? 'ligada' : 'sem chave (ANTHROPIC_API_KEY)') + ' · Telegram ' + (luarProps_().getProperty('TELEGRAM_TOKEN') ? 'ligado' : 'desligado') + ' · banco ' + (luarProps_().getProperty('PLUGGY_CLIENT_ID') ? 'ligado' : 'desligado'));
}

/* ------------------------------ API do app ------------------------------ */
function luarApi_(s, req) {
  var op = String(req.op || '');
  if (op === 'conversa') return luarEstado_(s);
  if (op === 'falar') {
    var txt = String(req.texto || '').trim().slice(0, 2000);
    if (!txt) throw apiErro_('Escreva alguma coisa.', 'VALIDACAO');
    if (!luarChave_()) throw apiErro_('A Luar ainda não foi ligada no servidor (falta a chave da API).', 'CONFIG');
    var r = luarResponder_(s.pessoa, txt, 'app');
    return { resposta: r, mensagens: luarHistorico_(40) };
  }
  if (op === 'perfil') {
    var p = String(req.perfil || '').slice(0, 4000);
    luarProps_().setProperty('LUAR_PERFIL', p);
    return { perfil: p };
  }
  if (op === 'caderno') {
    luarProps_().setProperty('LUAR_CADERNO', String(req.caderno || '').slice(0, LUAR_CADERNO_MAX));
    return { caderno: luarCaderno_() };
  }
  if (op === 'telegram') return telegramCodigo_(s.pessoa);
  if (op === 'banco') { bancoSincronizar(); return { banco: bancoResumoApp_() }; }
  if (op === 'bancoMapa') {
    var r = comLock_(function () { return bancoSalvarMapa_(req.mapa, req.desde); });
    return { banco: bancoResumoApp_(), criados: r.criados, ligados: r.ligados };
  }
  throw apiErro_('Ação desconhecida.', 'ACAO');
}
function luarEstado_(s) {
  var mes = N_mes(hoje_()), custo = 0;
  ler_('Luar').forEach(function (r) { if (String(r.Quando).slice(0, 7) === mes) custo += Number(r.Custo) || 0; });
  return {
    ativa: !!luarChave_(), modelo: luarModelo_(), mensagens: luarHistorico_(40),
    perfil: luarProps_().getProperty('LUAR_PERFIL') || '', caderno: luarCaderno_(),
    custoMes: Math.round(custo * 100) / 100,
    telegram: telegramEstado_(s.pessoa), banco: bancoResumoApp_()
  };
}
function luarCaderno_() { return luarProps_().getProperty('LUAR_CADERNO') || ''; }

/* ------------------------------ histórico ------------------------------ */
function luarGuardar_(papel, pessoa, canal, texto, custo) {
  inserir_('Luar', { ID: Utilities.getUuid().replace(/-/g, '').slice(0, 16), Quando: new Date().toISOString(), Papel: papel, Pessoa: pessoa || '', Canal: canal, Texto: String(texto).slice(0, 8000), Custo: custo ? String(custo) : '' });
}
function luarHistorico_(n) {
  return ler_('Luar').slice(-n).map(function (r) { return { id: r.ID, quando: r.Quando, papel: r.Papel, pessoa: r.Pessoa, canal: r.Canal, texto: r.Texto }; });
}
/** Histórico em mensagens da API: papéis alternados, começando pelo usuário. As mensagens de turno da Luar entram como dela. */
function luarMensagens_(n) {
  var out = [];
  luarHistorico_(n).forEach(function (m) {
    var role = m.papel === 'luar' ? 'assistant' : 'user';
    var txt = role === 'user' ? '[' + nomeDe_(m.pessoa) + (m.canal === 'telegram' ? ', pelo Telegram' : '') + '] ' + m.texto : m.texto;
    if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += '\n\n' + txt;
    else out.push({ role: role, content: txt });
  });
  if (out.length && out[0].role === 'assistant') out.unshift({ role: 'user', content: '(Começo do histórico recente da conversa.)' });
  return out;
}

/* ------------------------------ conversa ------------------------------ */
/** Guarda a fala, chama o Claude (com as ferramentas) e guarda a resposta. Devolve o texto da Luar. */
function luarResponder_(pessoa, texto, canal) {
  luarGuardar_('pessoa', pessoa, canal, texto);
  var msgs = luarMensagens_(30);
  var r = luarChamar_(msgs, luarContexto_(), { esforco: 'low', ferramentas: true, pessoa: pessoa });
  luarGuardar_('luar', '', canal, r.texto, r.custo);
  return r.texto;
}

/**
 * Uma volta completa com o Claude: pede, executa as ferramentas que ele chamar e pede de novo (até 4 vezes).
 * O system fica igual em todas as voltas (a parte fixa com cache); o bloco de pensamento volta intacto junto com a chamada de ferramenta.
 */
function luarChamar_(msgs, contexto, op) {
  var modelo = luarModelo_(), custo = 0, textos = [];
  var corpo = {
    model: modelo, max_tokens: 8000,
    system: [{ type: 'text', text: LUAR_PERSONA, cache_control: { type: 'ephemeral' } }, { type: 'text', text: contexto }],
    messages: msgs.slice(),
    output_config: { effort: op.esforco || 'low' }
  };
  if (op.ferramentas) corpo.tools = LUAR_FERRAMENTAS;
  if (/^claude-(opus|sonnet|fable)/.test(modelo)) corpo.fallbacks = 'default';
  for (var volta = 0; volta < 4; volta++) {
    var resp = luarPedir_(corpo);
    custo += luarCusto_(modelo, resp.usage);
    if (resp.stop_reason === 'refusal') { textos.push('Não consigo responder isso agora. Reformula a pergunta?'); break; }
    var usos = [];
    (resp.content || []).forEach(function (b) {
      if (b.type === 'text' && b.text) textos.push(b.text);
      if (b.type === 'tool_use') usos.push(b);
    });
    if (resp.stop_reason !== 'tool_use' || !usos.length) break;
    corpo.messages.push({ role: 'assistant', content: resp.content });
    corpo.messages.push({ role: 'user', content: usos.map(function (u) {
      var res; try { res = { type: 'tool_result', tool_use_id: u.id, content: luarFerramenta_(u.name, u.input || {}, op.pessoa) }; }
      catch (e) { res = { type: 'tool_result', tool_use_id: u.id, content: String(e.message || e), is_error: true }; }
      return res;
    }) });
  }
  var texto = textos.join('\n\n').trim() || 'Fiquei sem palavras. Tenta de novo?';
  return { texto: texto, custo: Math.round(custo * 10000) / 10000 };
}
function luarPedir_(corpo) {
  var r = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': luarChave_(), 'anthropic-version': '2026-10-21', 'anthropic-beta': 'server-side-fallback-2026-07-01' },
    payload: JSON.stringify(corpo)
  });
  var cod = r.getResponseCode(), j = json_(r.getContentText(), {}) || {};
  if (cod === 429 || cod === 529 || cod >= 500) throw apiErro_('A Luar está sobrecarregada agora. Tenta de novo em um minuto.', 'EXTERNO');
  if (cod !== 200) throw apiErro_('A API da Anthropic recusou o pedido (' + cod + '): ' + ((j.error && j.error.message) || 'sem detalhe'), 'EXTERNO');
  return j;
}
function luarCusto_(modelo, u) {
  var p = LUAR_PRECOS[modelo]; if (!p || !u) return 0;
  var ent = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) * 1.25;
  return (ent * p[0] + (u.output_tokens || 0) * p[1] + (u.cache_read_input_tokens || 0) * p[2]) / 1e6;
}

/* ------------------------------ ferramentas ------------------------------ */
function luarFerramenta_(nome, ent, pessoa) {
  if (nome === 'anotar') {
    var t = String(ent.texto || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!t) throw new Error('Texto vazio.');
    var linhas = luarCaderno_().split('\n').filter(Boolean);
    linhas.push(dataCurta_(hoje_()) + ' · ' + t);
    while (linhas.join('\n').length > LUAR_CADERNO_MAX) linhas.shift();
    luarProps_().setProperty('LUAR_CADERNO', linhas.join('\n'));
    return 'Anotado (linha ' + linhas.length + ').';
  }
  if (nome === 'riscar') {
    var ls = luarCaderno_().split('\n').filter(Boolean), i = Number(ent.linha) - 1;
    if (!(i >= 0 && i < ls.length)) throw new Error('Linha ' + ent.linha + ' não existe.');
    var tirada = ls.splice(i, 1)[0];
    luarProps_().setProperty('LUAR_CADERNO', ls.join('\n'));
    return 'Riscado: ' + tirada;
  }
  if (nome === 'criar_lembrete') {
    var prazo = N_dataValida(ent.prazo) ? ent.prazo : hoje_(), quem = String(ent.quem || 'ambos');
    var resp = 'ambos';
    pessoasAtivas_().forEach(function (p) { if (normNome_(p.Nome).split(' ')[0] === normNome_(quem).split(' ')[0]) resp = p.ID; });
    var item = { id: 'luar' + Utilities.getUuid().replace(/-/g, '').slice(0, 12), titulo: String(ent.titulo || '').slice(0, 100), ic: '🌙', area: 'financas', resp: resp, prox: prazo, alta: true, nota: 'Combinado com a Luar' };
    comLock_(function () { gravar_({ pessoa: pessoa || idsAtivos_()[0] }, 'tarefas', item, idsAtivos_()); });
    return 'Lembrete criado para ' + (resp === 'ambos' ? 'os dois' : nomeDe_(resp)) + ' em ' + dataCurta_(prazo) + '.';
  }
  if (nome === 'definir_teto') {
    var cats = categorias_(), achou = null, cents = Math.max(0, Math.round(Number(ent.reais || 0) * 100));
    cats.forEach(function (c) { if (c.id === ent.categoria) { c.orc = cents; achou = c; } });
    if (!achou) throw new Error('Categoria "' + ent.categoria + '" não existe. Use um id da lista de categorias.');
    comLock_(function () { cfgSet_('categorias', JSON.stringify(cats)); });
    return 'Teto de ' + achou.nome + ': ' + (cents ? reais_(cents) + ' por mês' : 'sem teto') + '.';
  }
  throw new Error('Ferramenta desconhecida.');
}

/* ------------------------------ turnos ------------------------------ */
/**
 * Gatilho de hora em hora. Às 8h, 13h e 20h a Luar olha os números e manda uma mensagem (push e Telegram), se tiver algo a dizer.
 * Domingo à noite é o check-in da semana; dia 1 de manhã, o fechamento do mês com o plano do próximo.
 */
function luarTurno(teste) {
  _cache = {}; _cfg = null;
  if (!luarChave_()) return;
  var hoje = hoje_(), hora = horaAgora_(), turno = null;
  Object.keys(LUAR_TURNOS).forEach(function (k) { if (LUAR_TURNOS[k] === hora) turno = k; });
  if (!turno) return;
  var props = luarProps_(), marca = 'LUAR_' + turno + '_' + hoje;
  if (props.getProperty(marca) && !teste) return;
  props.setProperty(marca, '1');
  var d = N_dataObj(hoje), modo = turno;
  if (turno === 'manha' && d.getDate() === 1) modo = 'mes';
  else if (turno === 'noite' && d.getDay() === 0) modo = 'semana';
  var pedidos = {
    manha: 'Turno da manhã. Uma mensagem curta (até 500 caracteres) para começar o dia: o que vence ou pesa hoje e nos próximos dias, quanto ainda dá para gastar por dia nas categorias livres até o fim do mês, e UMA ação para hoje.',
    tarde: 'Turno da tarde. Vigie: gastos de ontem e de hoje (no banco e nos lançamentos), delivery, categorias perto ou acima do teto, compromissos do caderno vencendo. Se não houver nada relevante, responda só PULAR. Se houver, até 400 caracteres, direto ao ponto.',
    noite: 'Turno da noite. Feche o dia: o que foi gasto hoje, se estão lançando (cobre se não), e um compromisso para amanhã. Até 500 caracteres.',
    semana: 'Check-in de domingo à noite. Até 900 caracteres: placar da semana (gasto x teto, déficit ou sobra projetada do mês), compromissos do caderno cumpridos e não cumpridos, a maior vitória e o maior vazamento. Termine com 3 perguntas objetivas para os dois responderem agora e anote no caderno o que ficar combinado.',
    mes: 'Fechamento do mês que acabou (dia 1, de manhã). Até 1200 caracteres: fechou no azul ou no vermelho e quanto, onde estourou, como andaram as metas de curto, médio e longo prazo, e o plano do mês que começa: 3 tetos para apertar e a meta de saldo. Anote no caderno os tetos e a meta.'
  };
  var msgs = luarMensagens_(16);
  msgs.push({ role: 'user', content: '[Sistema do Rotina] ' + pedidos[modo] + ' Escreva para os dois, sem cumprimentos longos.' });
  if (msgs.length > 1 && msgs[msgs.length - 2].role === 'user') { var u = msgs.pop(); msgs[msgs.length - 1].content += '\n\n' + u.content; }
  var r;
  try { r = luarChamar_(msgs, luarContexto_(), { esforco: modo === 'mes' || modo === 'semana' ? 'medium' : 'low', ferramentas: true, pessoa: idsAtivos_()[0] }); }
  catch (e) { Logger.log('luarTurno: ' + e); return; }
  if (/^\s*PULAR\b/i.test(r.texto)) return;
  luarGuardar_('luar', '', 'aviso', r.texto, r.custo);
  luarAvisar_(r.texto, modo);
}
/** Manda um texto da Luar para todos: push (resumido) e Telegram (inteiro). */
function luarAvisar_(texto, modo) {
  var titulos = { manha: 'Luar · bom dia', tarde: 'Luar · de olho', noite: 'Luar · fechando o dia', semana: 'Luar · check-in da semana', mes: 'Luar · fechamento do mês' };
  var corpo = texto.replace(/\*/g, '').replace(/\s+/g, ' ');
  idsAtivos_().forEach(function (p) {
    avisarPessoa_(p, 'luar', { titulo: titulos[modo] || 'Luar', corpo: corpo.length > 230 ? corpo.slice(0, 227) + '…' : corpo, url: '#financas/luar', tag: 'luar-' + modo });
  });
  telegramParaTodos_(texto);
}

/* ------------------------------ contexto: os números da casa ------------------------------ */
function luarContexto_() {
  var hoje = hoje_(), mes = N_mes(hoje), cats = categorias_(), nomeCat = {}, L = [];
  cats.forEach(function (c) { nomeCat[c.id] = c.nome; });
  var lancs = ativos_('lancamentos'), cartoes = ativos_('cartoes').filter(function (k) { return k.ativo !== false; });
  var cartao = {}; cartoes.forEach(function (k) { cartao[k.id] = k; });
  var fimMes = N_diaDoMes(mes, 31), diasRestam = N_diasEntre(hoje, fimMes) + 1;

  L.push('# DADOS DA CASA (gerados agora pelo Rotina)');
  L.push('Hoje: ' + hoje + ' (' + DIAS_SEMANA[N_dataObj(hoje).getDay()] + '). Faltam ' + diasRestam + ' dias para o fim do mês. Pessoas: ' + pessoasAtivas_().map(function (p) { return p.Nome; }).join(' e ') + '.');
  var perfil = luarProps_().getProperty('LUAR_PERFIL');
  L.push('', '## Perfil da família (escrito por eles)', perfil || '(vazio: peça para preencherem em Finanças › Luar › Ajustes)');
  var cad = luarCaderno_().split('\n').filter(Boolean);
  L.push('', '## Seu caderno (compromissos e decisões anotados)', cad.length ? cad.map(function (l, i) { return (i + 1) + '. ' + l; }).join('\n') : '(vazio)');

  // Atualização dos dados
  var ultimo = '', ultimoDia = '';
  lancs.forEach(function (l) { if (l.em > ultimo) ultimo = l.em; if (l.dia <= hoje && l.dia > ultimoDia) ultimoDia = l.dia; });
  L.push('', '## Atualização', 'Último lançamento registrado no app em ' + (ultimo ? ultimo.slice(0, 10) + ' (' + N_diasEntre(ultimo.slice(0, 10), hoje) + ' dias atrás)' : 'nunca') + '; lançamento com data mais recente: ' + (ultimoDia || '—') + '.');

  // Mês atual por data da compra
  var porCat = {}, ent = 0, sai = 0, maiores = [], delivery = 0, nDelivery = 0;
  lancs.forEach(function (l) {
    if (N_mes(l.dia) !== mes || l.dia > hoje) return;
    if (l.tipo === 'entrada') ent += l.v;
    if (l.tipo === 'saida') { sai += l.v; porCat[l.cat || 'outros'] = (porCat[l.cat || 'outros'] || 0) + l.v; maiores.push(l); if (l.cat === 'delivery') { delivery += l.v; nDelivery++; } }
  });
  L.push('', '## Este mês (' + mes + '), pela data da compra, até hoje', 'Entradas lançadas: ' + reais_(ent) + ' · saídas lançadas: ' + reais_(sai) + ' (cartão incluído na data da compra).');
  L.push('Categorias (gasto / teto do mês; id entre parênteses):');
  cats.filter(function (c) { return c.tipo === 'saida'; }).forEach(function (c) {
    var g = porCat[c.id] || 0; if (!g && !c.orc) return;
    L.push('- ' + c.nome + ' (' + c.id + ', ' + (c.grupo || 'livre') + '): ' + reais_(g) + (c.orc ? ' / ' + reais_(c.orc) + ' (' + Math.round(g * 100 / c.orc) + '%)' : ' / sem teto'));
  });
  if (nDelivery) L.push('Delivery e restaurante: ' + nDelivery + ' lançamentos, ' + reais_(delivery) + '.');
  maiores.sort(function (a, b) { return b.v - a.v; });
  if (maiores.length) L.push('Maiores gastos do mês: ' + maiores.slice(0, 10).map(function (l) { return l.dia.slice(8) + '/' + l.dia.slice(5, 7) + ' ' + (l.desc || nomeCat[l.cat] || 'sem descrição') + ' ' + reais_(l.v) + (l.forma === 'cartao' && cartao[l.cartao] ? ' (' + cartao[l.cartao].nome + (l.parc ? ' ' + l.parc : '') + ')' : ''); }).join('; ') + '.');
  var semana = N_somaDias(hoje, -2), recentes = lancs.filter(function (l) { return l.tipo === 'saida' && l.dia >= semana && l.dia <= hoje; });
  if (recentes.length) L.push('Gastos de anteontem a hoje: ' + recentes.map(function (l) { return l.dia.slice(8) + '/' + l.dia.slice(5, 7) + ' ' + (l.desc || nomeCat[l.cat]) + ' ' + reais_(l.v); }).join('; ') + '.');

  // Meses fechados
  L.push('', '## Últimos 3 meses (data da compra)');
  for (var i = 3; i >= 1; i--) {
    var ref = N_somaMes(mes, -i), e = 0, s = 0, inv = 0, pc = {};
    lancs.forEach(function (l) {
      if (N_mes(l.dia) !== ref) return;
      if (l.tipo === 'entrada') e += l.v;
      if (l.tipo === 'saida') { s += l.v; pc[l.cat || 'outros'] = (pc[l.cat || 'outros'] || 0) + l.v; }
      if (l.tipo === 'aporte') inv += l.v; if (l.tipo === 'resgate') inv -= l.v;
    });
    var top = Object.keys(pc).sort(function (a, b) { return pc[b] - pc[a]; }).slice(0, 6).map(function (k) { return (nomeCat[k] || k) + ' ' + reais_(pc[k]); }).join(', ');
    L.push('- ' + ref + ': entradas ' + reais_(e) + ', saídas ' + reais_(s) + ', saldo ' + reais_(e - s) + ', investido líquido ' + reais_(inv) + (top ? '. Maiores: ' + top : '') + '.');
  }

  // Cartões
  if (cartoes.length) {
    L.push('', '## Cartões (fatura = compras que caem naquele vencimento, menos pagamentos)');
    cartoes.forEach(function (k) {
      var partes = [];
      [mes, N_somaMes(mes, 1), N_somaMes(mes, 2)].forEach(function (ref) {
        var tot = 0, pago = 0;
        lancs.forEach(function (l) {
          if (l.cartao !== k.id) return;
          if (l.tipo === 'saida' && l.forma === 'cartao' && N_faturaDe(k, l) === ref) tot += l.v;
          if (l.tipo === 'fatura' && l.ref === ref && l.pago) pago += l.v;
        });
        if (tot) partes.push('vence ' + dataCurta_(N_vencimento(k, ref)) + ': ' + reais_(tot) + (pago ? ' (pago ' + reais_(pago) + ')' : ''));
      });
      L.push('- ' + k.nome + (k.limite ? ' (limite ' + reais_(k.limite) + ')' : '') + ': ' + (partes.join('; ') || 'nada lançado'));
    });
  }

  // Contas fixas
  var fixas = ativos_('contas').filter(function (c) { return c.ativa !== false && (!c.fim || c.fim >= mes); });
  if (fixas.length) {
    var fs = 0, fe = 0;
    fixas.forEach(function (c) { if (c.tipo === 'saida') fs += c.v || 0; if (c.tipo === 'entrada') fe += c.v || 0; });
    L.push('', '## Contas fixas por mês', 'Saídas fixas ' + reais_(fs) + ' · entradas fixas ' + reais_(fe) + '.');
    L.push(fixas.map(function (c) { return '- ' + c.nome + ' (' + c.tipo + (c.vence ? ', dia ' + c.vence : '') + (c.forma ? ', ' + c.forma : '') + '): ' + reais_(c.v || 0); }).join('\n'));
  }
  var vencendo = luarVencendo_(hoje, lancs, fixas, cartoes);
  if (vencendo.length) L.push('', '## A pagar nos próximos 7 dias', vencendo.join('\n'));

  // Metas
  var metas = ativos_('metas').filter(function (m) { return m.ativa !== false; });
  if (metas.length) {
    L.push('', '## Metas');
    metas.forEach(function (m) {
      var junto = 0; lancs.forEach(function (l) { if (l.meta === m.id && (l.tipo === 'aporte' || l.tipo === 'resgate')) junto += l.tipo === 'aporte' ? l.v : -l.v; });
      L.push('- ' + m.nome + ' (' + m.tipo + '): alvo ' + reais_(m.alvo || 0) + (m.prazo ? ' até ' + m.prazo : '') + (junto ? ', aportado ' + reais_(junto) : '') + (m.nota ? '. ' + m.nota : ''));
    });
  }

  // Patrimônio
  var pat = ativos_('patrimonio').filter(function (p) { return p.ativo !== false; });
  if (pat.length) {
    var at = 0, pa = 0, linhas = [];
    pat.forEach(function (p) {
      var h = (p.hist || []).slice().sort(function (a, b) { return String(a[0]).localeCompare(String(b[0])); }), u = h[h.length - 1];
      if (!u) return; var v = Number(u[1]) || 0;
      if (p.nat === 'passivo') pa += v; else at += v;
      linhas.push('- ' + p.nome + ' (' + (p.nat === 'passivo' ? 'dívida' : p.classe || 'ativo') + (p.inst ? ', ' + p.inst : '') + '): ' + reais_(v) + ' em ' + u[0]);
    });
    L.push('', '## Patrimônio (último saldo informado de cada item)', 'Ativos ' + reais_(at) + ' · dívidas ' + reais_(pa) + ' · líquido ' + reais_(at - pa) + '.', linhas.join('\n'));
  }

  var banco = bancoContexto_(hoje);
  if (banco) L.push('', banco);
  var merc = mercado_();
  if (merc) L.push('', '## Mercado (Banco Central)', merc);
  L.push('', 'Valores em reais. Regime de caixa do app: compra no cartão pesa no mês em que a fatura vence; aqui as compras aparecem na data em que foram feitas, e as faturas na seção Cartões.');
  return L.join('\n');
}
function luarVencendo_(hoje, lancs, fixas, cartoes) {
  var out = [], mes = N_mes(hoje), lim = N_somaDias(hoje, 7), pagos = {};
  lancs.forEach(function (l) { if (l.conta && l.ref === mes && l.pago) pagos[l.conta] = 1; });
  fixas.forEach(function (c) {
    if (c.tipo !== 'saida' || c.forma === 'cartao' || pagos[c.id] || !c.vence) return;
    var v = N_diaDoMes(mes, c.vence); if (v >= hoje && v <= lim) out.push('- ' + c.nome + ' ' + reais_(c.v || 0) + ' em ' + dataCurta_(v));
  });
  cartoes.forEach(function (k) {
    [mes, N_somaMes(mes, 1)].forEach(function (ref) {
      var v = N_vencimento(k, ref); if (v < hoje || v > lim) return;
      var tot = 0; lancs.forEach(function (l) { if (l.cartao === k.id && l.tipo === 'saida' && l.forma === 'cartao' && N_faturaDe(k, l) === ref) tot += l.v; if (l.cartao === k.id && l.tipo === 'fatura' && l.ref === ref && l.pago) tot -= l.v; });
      if (tot > 0) out.push('- Fatura ' + k.nome + ' ' + reais_(tot) + ' em ' + dataCurta_(v));
    });
  });
  return out;
}

/* ------------------------------ mercado (Banco Central, sem chave) ------------------------------ */
/** Selic meta, CDI e IPCA de 12 meses, guardados por um dia. */
function mercado_() {
  var props = luarProps_(), guard = json_(props.getProperty('MERCADO'), null), hoje = hoje_();
  if (guard && guard.dia === hoje) return guard.txt;
  var series = [[432, 'Selic meta', '% ao ano'], [4389, 'CDI', '% ao ano'], [13522, 'IPCA em 12 meses', '%']], partes = [];
  series.forEach(function (s) {
    try {
      var r = UrlFetchApp.fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.' + s[0] + '/dados/ultimos/1?formato=json', { muteHttpExceptions: true });
      var j = json_(r.getContentText(), []);
      if (r.getResponseCode() === 200 && j && j[0]) partes.push(s[1] + ' ' + String(j[0].valor).replace('.', ',') + s[2] + ' (' + j[0].data + ')');
    } catch (e) { Logger.log('mercado ' + s[0] + ': ' + e); }
  });
  var txt = partes.join(' · ');
  if (txt) props.setProperty('MERCADO', JSON.stringify({ dia: hoje, txt: txt }));
  return txt || (guard ? guard.txt : '');
}

/** Para testar no editor: mostra o contexto que a Luar recebe (sem chamar a API). */
function verContextoLuar() { Logger.log(luarContexto_()); }
/** Para testar no editor: roda o turno desta hora mesmo que já tenha rodado. */
function testarLuar() { Logger.log(luarResponder_(idsAtivos_()[0], 'Luar, como estamos este mês? Seja sincera.', 'app')); }
