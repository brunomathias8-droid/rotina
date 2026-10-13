/**
 * Push.gs — notificações no celular (Web Push pelo Firebase Cloud Messaging). Mesmo esquema do RM e do RACHA.
 * O servidor decide QUANDO avisar; o app só pede permissão, registra o aparelho e escolhe os tipos.
 * No iPhone, só funciona com o app instalado na tela de início (iOS 16.4 ou mais novo).
 *
 * Configuração (uma vez; dá para reaproveitar o projeto Firebase do RM):
 *   Config › firebase_web_config      bloco firebaseConfig do console do Firebase
 *   Config › firebase_vapid_key       chave do par "Web Push certificates" (Cloud Messaging)
 *   Config › firebase_service_account conteúdo do JSON da conta de serviço (vai para as Propriedades do script e a célula é limpa)
 * Depois rodar ativarAvisos() uma vez (cria o gatilho de hora em hora).
 */
var PUSH_TIPOS = {
  tarefas: 'Agenda e tarefas do dia, de manhã',
  agenda: 'Lembretes dos compromissos',
  agendanovo: 'Compromisso novo, mudado ou comentado',
  contas: 'Contas e faturas vencendo (2 dias antes e no dia)',
  trocas: 'Pedidos de troca de tarefa',
  atribuidas: 'Tarefa passada para você ou concluída',
  compras: 'Itens novos na lista de compras',
  resumo: 'Resumo da semana e o combinado de domingo, às 19h',
  fechamento: 'Fechamento do mês e das metas, no dia 1'
};
var PUSH_PADRAO = ['tarefas', 'agenda', 'agendanovo', 'contas', 'trocas', 'atribuidas', 'resumo', 'fechamento'];
var PUSH_V3 = ['tarefas', 'agenda', 'agendanovo'];

/* ------------------------------ configuração ------------------------------ */
function pushWebConfig_() {
  var t = String(cfg_().firebase_web_config || '').trim();
  if (!t) return null;
  var m = t.match(/\{[\s\S]*\}/);
  if (!m) return null;
  var s = m[0].replace(/\/\/[^\n]*/g, '').replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":').replace(/'/g, '"').replace(/,\s*\}/g, '}');
  try { var o = JSON.parse(s); return o.apiKey && o.projectId && o.messagingSenderId && o.appId ? o : null; } catch (e) { return null; }
}
function pushContaServico_() {
  var props = PropertiesService.getScriptProperties(), c = cfg_();
  var v = String(c.firebase_service_account || '').trim();
  if (v && v.charAt(0) === '{') {
    var j = pushLerConta_(v);
    if (j) { props.setProperty('FCM_SERVICE_ACCOUNT', JSON.stringify(j)); cfgSet_('firebase_service_account', '(guardada nas Propriedades do script)'); }
  }
  var p = props.getProperty('FCM_SERVICE_ACCOUNT');
  return p ? pushLerConta_(p) : null;
}
function pushLerConta_(txt) {
  try { var j = JSON.parse(String(txt).trim()); return j.client_email && j.private_key && j.project_id ? j : null; } catch (e) { return null; }
}
function pushStatus_() {
  var web = pushWebConfig_(), sa = pushContaServico_(), vapid = String(cfg_().firebase_vapid_key || '').trim(), falta = [];
  if (!web) falta.push('firebase_web_config');
  if (!vapid) falta.push('firebase_vapid_key');
  if (!sa) falta.push('firebase_service_account');
  return { ativo: !falta.length, falta: falta, web: web, vapid: vapid, sa: sa };
}

/* ------------------------------ API (chamada pelo Api.gs) ------------------------------ */
function pushApi_(acao, sessao, req) {
  if (acao === 'pushConfig') {
    var st = pushStatus_();
    return { ativo: st.ativo, falta: st.falta, webConfig: st.web, vapidKey: st.vapid, tipos: PUSH_TIPOS, padrao: PUSH_PADRAO };
  }
  var tok = String(req.token_push || '');
  if (tok.length < 20 || tok.length > 4096) throw apiErro_('Endereço de notificação inválido.', 'VALIDACAO');
  if (acao === 'registrarPush') return { tipos: comLock_(function () { return pushGravar_(tok, sessao.pessoa, req.plataforma, req.tipos); }) };
  if (acao === 'preferenciasPush') return { tipos: comLock_(function () { return pushGravar_(tok, sessao.pessoa, null, req.tipos); }) };
  if (acao === 'removerPush') { comLock_(function () { pushDesativar_(tok, 'removido no aparelho'); }); return { ok: true }; }
  if (acao === 'testarPush') {
    var r = pushEnviar_(tok, { titulo: 'Rotina · teste', corpo: 'As notificações estão funcionando neste aparelho.', url: '#hoje', tag: 'teste' });
    if (!r.ok) throw apiErro_('O Firebase recusou o envio: ' + r.erro, 'EXTERNO');
    return { ok: true };
  }
  throw apiErro_('Ação desconhecida.', 'ACAO');
}

function pushGravar_(tok, pessoa, plataforma, tipos) {
  var validos = (Array.isArray(tipos) ? tipos : PUSH_PADRAO).filter(function (t) { return PUSH_TIPOS[t]; });
  var agora = new Date().toISOString(), atual = ler_('Push').filter(function (r) { return r.Token === tok; })[0];
  if (atual) atualizar_('Push', atual._lin, { Pessoa: pessoa, Plataforma: plataforma || atual.Plataforma, Tipos: validos.join(','), AtualizadoEm: agora, Ativo: 'sim', UltimoErro: '' });
  else inserir_('Push', { Token: tok, Pessoa: pessoa, Plataforma: String(plataforma || '').slice(0, 30), Tipos: validos.join(','), CriadoEm: agora, AtualizadoEm: agora, Ativo: 'sim', UltimoErro: '' });
  return validos;
}
function pushDesativar_(tok, motivo) {
  ler_('Push').forEach(function (r) { if (r.Token === tok) atualizar_('Push', r._lin, { Ativo: 'não', UltimoErro: String(motivo || '').slice(0, 200) }); });
}
function pushAparelhos_(pessoa, tipo) {
  return ler_('Push').filter(function (r) {
    if (r.Ativo !== 'sim' || r.Pessoa !== pessoa) return false;
    var l = String(r.Tipos).split(',');
    if (l.indexOf(tipo) >= 0) return true;
    // Aparelho registrado na versão 2 (antes da Agenda): afazeres/pendências valem como tarefas, e a agenda vem ligada
    var antigo = !PUSH_V3.some(function (t) { return l.indexOf(t) >= 0; });
    return antigo && (tipo === 'agenda' || tipo === 'agendanovo' || (tipo === 'tarefas' && (l.indexOf('afazeres') >= 0 || l.indexOf('pendencias') >= 0)));
  }).map(function (r) { return r.Token; });
}

/* ------------------------------ envio (FCM HTTP v1) ------------------------------ */
function pushAcesso_(sa) {
  var cache = CacheService.getScriptCache(), c = cache.get('fcm_acesso');
  if (c) return c;
  var b64 = function (s) { return Utilities.base64EncodeWebSafe(s).replace(/=+$/, ''); };
  var agora = Math.floor(Date.now() / 1000);
  var cab = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  var corpo = b64(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: agora, exp: agora + 3600 }));
  var ass = Utilities.base64EncodeWebSafe(Utilities.computeRsaSha256Signature(cab + '.' + corpo, sa.private_key)).replace(/=+$/, '');
  var r = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', { method: 'post', muteHttpExceptions: true,
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: cab + '.' + corpo + '.' + ass } });
  if (r.getResponseCode() !== 200) throw new Error('Google não liberou o acesso ao Firebase (' + r.getResponseCode() + '): ' + r.getContentText().slice(0, 200));
  var tok = JSON.parse(r.getContentText()).access_token;
  cache.put('fcm_acesso', tok, 3000);
  return tok;
}
/** Envia para um aparelho. Devolve { ok, erro }. Endereço inválido ou desinstalado é desativado. */
function pushEnviar_(tok, msg) {
  var sa = pushContaServico_();
  if (!sa) return { ok: false, erro: 'conta de serviço do Firebase não configurada' };
  try {
    var r = UrlFetchApp.fetch('https://fcm.googleapis.com/v1/projects/' + sa.project_id + '/messages:send', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + pushAcesso_(sa) },
      payload: JSON.stringify({ message: { token: tok,
        data: { titulo: String(msg.titulo || 'Rotina'), corpo: String(msg.corpo || ''), url: String(msg.url || '#hoje'), tag: String(msg.tag || '') },
        webpush: { headers: { Urgency: 'high', TTL: '43200' } } } })
    });
    var code = r.getResponseCode();
    if (code === 200) return { ok: true };
    var txt = r.getContentText().slice(0, 300);
    if (code === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(txt)) pushDesativar_(tok, txt);
    return { ok: false, erro: code + ' ' + txt };
  } catch (e) { return { ok: false, erro: String(e.message || e) }; }
}

/* ------------------------------ avisos na hora ------------------------------ */
function silencio_() { var h = horaAgora_(); return h >= 22 || h < 7; }
function avisarPessoa_(pessoa, tipo, msg, ignorarSilencio) {
  try {
    if (!pessoa || (silencio_() && !ignorarSilencio) || !pushStatus_().ativo) return 0;
    var n = 0;
    pushAparelhos_(pessoa, tipo).forEach(function (t) { if (pushEnviar_(t, msg).ok) n++; });
    return n;
  } catch (e) { Logger.log('aviso ' + tipo + ': ' + e); return 0; }
}
function avisarOutros_(autor, tipo, msg) {
  idsAtivos_().forEach(function (id) { if (id !== autor) avisarPessoa_(id, tipo, msg); });
}

/** Chamado por salvar_: tarefa passada para alguém, compromisso novo ou mudado, item novo na lista. */
function avisosDeSalvar_(s, col, antes, depois) {
  if (col === 'tarefas') {
    var resp = depois.resp, pessoa = resp !== 'ambos' && resp !== 'rodizio' ? resp : '';
    if (pessoa && pessoa !== s.pessoa && !depois.feita && (!antes || antes.resp !== resp))
      avisarPessoa_(pessoa, 'atribuidas', { titulo: nomeDe_(s.pessoa) + ' passou uma tarefa para você', corpo: depois.titulo + (depois.prox ? ' · ' + dataCurta_(depois.prox) : ''), url: '#tarefas', tag: 'tarefa-' + depois.id });
  }
  if (col === 'eventos' && !depois.excluido) {
    var mudou = antes && (antes.dia !== depois.dia || antes.ini !== depois.ini || antes.titulo !== depois.titulo || antes.diaTodo !== depois.diaTodo);
    if (!antes || mudou) envolvidos_(depois).forEach(function (p) {
      if (p !== s.pessoa) avisarPessoa_(p, 'agendanovo', { titulo: nomeDe_(s.pessoa) + (antes ? ' mudou: ' : ' marcou: ') + depois.titulo, corpo: quandoEvento_(depois, depois.dia) + (depois.local ? ' · ' + depois.local : ''), url: '#agenda', tag: 'ev-' + depois.id });
    });
  }
  if (col === 'compras' && !antes) {
    // No máximo um aviso a cada 10 minutos por pessoa: quem monta a lista adiciona vários itens seguidos
    var cache = CacheService.getScriptCache(), k = 'rotina_compras_' + s.pessoa;
    if (cache.get(k)) return;
    cache.put(k, '1', 600);
    avisarOutros_(s.pessoa, 'compras', { titulo: nomeDe_(s.pessoa) + ' adicionou à lista de compras', corpo: depois.item + (depois.qtd ? ' (' + depois.qtd + ')' : ''), url: '#compras', tag: 'compras' });
  }
}
var DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
/** "hoje às 14:00", "amanhã (dia todo)", "sex, 10/out às 9:30". */
function quandoEvento_(e, dia) {
  var h = hoje_(), n = N_diasEntre(h, dia), d = n === 0 ? 'hoje' : n === 1 ? 'amanhã' : DIAS_SEMANA[N_dataObj(dia).getDay()] + ', ' + dataCurta_(dia);
  return d + (e.diaTodo || !e.ini ? '' : ' às ' + e.ini);
}
/** Compromissos de um dia (com as repetições), em ordem de horário. */
function eventosDoDia_(dia) {
  return ativos_('eventos').filter(function (e) { return N_ocorrencias(e, dia, dia).length; })
    .sort(function (a, b) { return (a.diaTodo ? '' : a.ini || '').localeCompare(b.diaTodo ? '' : b.ini || ''); });
}

/* ------------------------------ avisos programados ------------------------------ */
var MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function dataCurta_(iso) { var d = N_dataObj(iso); return d.getDate() + '/' + MESES_ABREV[d.getMonth()]; }
function reais_(c) { return 'R$ ' + (c / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function lista_(nomes) { return nomes.length <= 3 ? nomes.join(', ') : nomes.slice(0, 3).join(', ') + ' e mais ' + (nomes.length - 3); }
function ativos_(col) { return ler_(COLECOES[col].aba).filter(function (r) { return r.Excluido !== 'sim'; }).map(function (r) { return paraApp_(col, r); }); }

/** Gatilho de hora em hora. Cada aviso sai uma vez por dia (marca nas Propriedades do script). */
function verificarAvisos() {
  _cache = {}; _cfg = null;
  if (!pushStatus_().ativo) return;
  var hoje = hoje_(), hora = horaAgora_(), dow = N_dataObj(hoje).getDay(), props = PropertiesService.getScriptProperties();
  var feito = function (k) { var c = 'AV_' + k + '_' + hoje; if (props.getProperty(c)) return true; props.setProperty(c, '1'); return false; };
  var manha = Number(cfg_().hora_avisos) || 8, pessoas = idsAtivos_();

  if (hora === manha && !feito('manha')) {
    var tars = ativos_('tarefas'), evs = eventosDoDia_(hoje);
    pessoas.forEach(function (p) {
      var meusEv = evs.filter(function (e) { return envolvidos_(e).indexOf(p) >= 0; });
      var minhas = tars.filter(function (t) { var q = N_quemFaz(t); return !t.feita && t.prox && t.prox <= hoje && (!q || q === p); });
      if (!meusEv.length && !minhas.length) return;
      var atras = minhas.filter(function (t) { return t.prox < hoje; }).length;
      var titulo = meusEv.length ? 'Hoje: ' + lista_(meusEv.map(function (e) { return e.titulo + (e.diaTodo || !e.ini ? '' : ' ' + e.ini); }))
        : (minhas.length === 1 ? 'Hoje é com você: ' + minhas[0].titulo : minhas.length + ' tarefas com você hoje');
      var corpo = meusEv.length ? (minhas.length ? minhas.length + (minhas.length === 1 ? ' tarefa' : ' tarefas') + ' com você: ' + lista_(minhas.map(function (t) { return t.titulo; })) : 'Nenhuma tarefa sua para hoje.')
        : (minhas.length === 1 ? (atras ? 'Está atrasada desde ' + dataCurta_(minhas[0].prox) + '.' : 'Toque para marcar quando terminar.') : lista_(minhas.map(function (t) { return t.titulo; })) + (atras ? ' (' + atras + ' atrasada' + (atras > 1 ? 's' : '') + ')' : ''));
      avisarPessoa_(p, 'tarefas', { titulo: titulo, corpo: corpo, url: '#hoje', tag: 'manha' });
    });

    // Documentos soltos com validade (passaporte, CNH, carteirinha do plano): 30 dias antes, 7 dias antes e no dia. Anexo segue o prazo da tarefa ou compromisso.
    var vencendo = ativos_('arquivos').filter(function (x) { var n = x.validade && !x.liga ? N_diasEntre(hoje, x.validade) : -1; return n === 30 || n === 7 || n === 0; });
    vencendo.forEach(function (x) {
      var n = N_diasEntre(hoje, x.validade), quem = (x.pessoas || []).filter(function (p) { return pessoas.indexOf(p) >= 0; });
      (quem.length ? quem : pessoas).forEach(function (p) {
        avisarPessoa_(p, 'tarefas', { titulo: x.titulo + (n ? ' vence em ' + n + ' dias' : ' vence hoje'), corpo: 'Validade ' + dataCurta_(x.validade) + '. Que tal já marcar a renovação?', url: '#arquivos', tag: 'doc-' + x.id });
      });
    });

    var aPagar = contasAVencer_(hoje);
    if (aPagar.length) {
      var hojeV = aPagar.filter(function (c) { return c.venc === hoje; });
      var titulo = hojeV.length ? (hojeV.length === 1 ? hojeV[0].nome + ' vence hoje' : hojeV.length + ' contas vencem hoje') : (aPagar.length === 1 ? aPagar[0].nome + ' vence em 2 dias' : aPagar.length + ' contas vencem em 2 dias');
      pessoas.forEach(function (p) {
        avisarPessoa_(p, 'contas', { titulo: titulo, corpo: lista_(aPagar.map(function (c) { return c.nome + (c.v ? ' ' + reais_(c.v) : ''); })), url: '#financas/contas', tag: 'contas' });
      });
    }
  }

  if (N_dataObj(hoje).getDate() === 1 && hora === manha && !feito('fechamento')) {
    var f = fechamentoMes_(N_somaMes(N_mes(hoje), -1));
    if (f.receitas || f.despesas) pessoas.forEach(function (p) {
      avisarPessoa_(p, 'fechamento', { titulo: 'Fechamento de ' + f.nomeMes + ': ' + (f.saldo >= 0 ? 'sobraram ' : 'faltaram ') + reais_(Math.abs(f.saldo)),
        corpo: 'Receitas ' + reais_(f.receitas) + ' · despesas ' + reais_(f.despesas) + ' · investido ' + reais_(f.investido) + '.' + (f.metas ? ' ' + f.metas : ''), url: '#financas', tag: 'fechamento' });
    });
  }

  if (dow === 0 && hora === 19 && !feito('resumo')) {
    var seg = N_segunda(hoje), cont = {}, gasto = 0;
    ativos_('feitos').forEach(function (f) { if (f.dia >= seg && !f.pulou) cont[f.quem] = (cont[f.quem] || 0) + (f.peso || 2); });
    ativos_('lancamentos').forEach(function (l) { if (l.dia >= seg && l.dia <= hoje && l.tipo === 'saida') gasto += l.v; });
    var placar = pessoas.map(function (p) { var n = cont[p] || 0; return nomeDe_(p) + ' ' + n + (n === 1 ? ' pt' : ' pts'); }).join(' · ');
    var prox = 0; for (var i = 1; i <= 7; i++) prox += eventosDoDia_(N_somaDias(hoje, i)).length;
    pessoas.forEach(function (p) {
      avisarPessoa_(p, 'resumo', { titulo: 'Hora do combinado da semana', corpo: (prox ? prox + (prox === 1 ? ' compromisso' : ' compromissos') + ' nos próximos 7 dias. ' : '') + 'Tarefas: ' + placar + '. Gastos da semana: ' + reais_(gasto) + '.', url: '#agenda/semana', tag: 'resumo' });
    });
  }

  if (hora === 3) {
    var lim = N_somaDias(hoje, -10), todas = props.getProperties();
    Object.keys(todas).forEach(function (k) { if (k.indexOf('AV_') === 0 && k.slice(-10) < lim) props.deleteProperty(k); });
  }
}

/** Contas que vencem hoje ou daqui a 2 dias e ainda não foram pagas: contas fixas, lançamentos agendados e faturas de cartão. */
function contasAVencer_(hoje) {
  var mes = N_mes(hoje), lancs = ativos_('lancamentos'), pagos = {}, out = [];
  var alvo = function (d) { var n = N_diasEntre(hoje, d); return n === 0 || n === 2; };
  lancs.forEach(function (l) { if (l.conta && l.ref === mes && l.pago) pagos[l.conta] = 1; });
  ativos_('contas').forEach(function (c) {
    if (!c.ativa || c.tipo !== 'saida' || c.forma === 'cartao' || pagos[c.id] || !c.vence || (c.fim && c.fim < mes)) return;
    var venc = N_diaDoMes(mes, c.vence);
    if (alvo(venc)) out.push({ nome: c.nome, v: c.v, venc: venc });
  });
  lancs.forEach(function (l) { if (l.tipo === 'saida' && !l.pago && l.forma !== 'cartao' && !l.conta && alvo(l.dia)) out.push({ nome: l.desc || 'Conta agendada', v: l.v, venc: l.dia }); });
  ativos_('cartoes').forEach(function (k) {
    if (!k.ativo) return;
    [mes, N_somaMes(mes, 1)].forEach(function (ref) {
      var venc = N_vencimento(k, ref); if (!alvo(venc)) return;
      var total = 0, pago = 0;
      lancs.forEach(function (l) {
        if (l.cartao !== k.id) return;
        if (l.tipo === 'saida' && l.forma === 'cartao' && N_faturaDe(k, l) === ref) total += l.v;
        if (l.tipo === 'fatura' && l.ref === ref) pago += l.v;
      });
      if (total - pago > 0) out.push({ nome: 'Fatura ' + k.nome, v: total - pago, venc: venc });
    });
  });
  return out;
}

/** Números de um mês fechado e como ficaram as metas de investir por mês. */
function fechamentoMes_(ref) {
  var r = { receitas: 0, despesas: 0, investido: 0, nomeMes: MESES_LONGO[+ref.slice(5, 7) - 1] };
  ativos_('lancamentos').forEach(function (l) {
    if (N_mes(l.dia) !== ref) return;
    if (l.tipo === 'entrada') r.receitas += l.v;
    if (l.tipo === 'saida') r.despesas += l.v;
    if (l.tipo === 'aporte') r.investido += l.v;
    if (l.tipo === 'resgate') r.investido -= l.v;
  });
  r.saldo = r.receitas - r.despesas;
  var mensais = ativos_('metas').filter(function (m) { return m.ativa !== false && m.tipo === 'mensal' && m.alvo; });
  r.metas = mensais.map(function (m) { return m.nome + (r.investido >= m.alvo ? ': cumprida ✓' : ': ' + reais_(Math.max(0, r.investido)) + ' de ' + reais_(m.alvo)); }).join('. ');
  return r;
}
var MESES_LONGO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/**
 * Gatilho de 5 em 5 minutos: lembretes dos compromissos ("1 hora antes", "na véspera às 19h"…).
 * Manda os lembretes cujo horário caiu entre a última verificação e agora (no máximo 30 minutos para trás).
 */
function verificarAgenda(teste) {
  _cache = {}; _cfg = null;
  if (!pushStatus_().ativo) return;
  // "teste" (texto AAAA-MM-DD HH:MM) só para testar no editor; o gatilho passa um objeto de evento
  var props = PropertiesService.getScriptProperties(), fuso = fuso_(), simulado = typeof teste === 'string';
  var agora = simulado ? teste : Utilities.formatDate(new Date(), fuso, 'yyyy-MM-dd HH:mm');
  var minimo = simulado ? menosMinutos_(agora, 30) : Utilities.formatDate(new Date(Date.now() - 30 * 60000), fuso, 'yyyy-MM-dd HH:mm'), ultima = props.getProperty('AGENDA_ULTIMA') || minimo;
  if (ultima < minimo) ultima = minimo;
  props.setProperty('AGENDA_ULTIMA', agora);
  var h = agora.slice(0, 10), de = N_somaDias(h, -1), ate = N_somaDias(h, 15);
  ativos_('eventos').forEach(function (e) {
    if (!e.alertas || !e.alertas.length) return;
    N_ocorrencias(e, de, ate).forEach(function (dia) {
      N_momentosAlerta(e, dia).forEach(function (m) {
        if (m > ultima && m <= agora) envolvidos_(e).forEach(function (p) {
          avisarPessoa_(p, 'agenda', { titulo: e.titulo + ' · ' + quandoEvento_(e, dia), corpo: [nomesEvento_(e), e.local].filter(Boolean).join(' · ') || 'Lembrete da agenda', url: '#agenda', tag: 'ev-' + e.id + '-' + dia }, true);
        });
      });
    });
  });
}
function menosMinutos_(dh, m) {
  var t = N_minutos(dh.slice(11)) - m, dias = Math.floor(t / 1440), r = t - dias * 1440;
  return N_somaDias(dh.slice(0, 10), dias) + ' ' + N_pad(Math.floor(r / 60)) + ':' + N_pad(r % 60);
}
function nomesEvento_(e) {
  var nomes = {}; ler_('Pessoas').forEach(function (p) { nomes[p.ID] = p.Nome; }); ativos_('perfis').forEach(function (p) { nomes[p.id] = p.nome; });
  var quem = (e.pessoas || []).map(function (id) { return nomes[id]; }).filter(Boolean).join(', ');
  return [quem, e.leva ? 'leva: ' + nomes[e.leva] : ''].filter(Boolean).join(' · ');
}

/** Rodar uma vez no editor: confere a configuração e cria os gatilhos (avisos de hora em hora e lembretes da agenda de 5 em 5 minutos). */
function ativarAvisos() {
  var st = pushStatus_();
  ScriptApp.getProjectTriggers().forEach(function (t) { if (['verificarAvisos', 'verificarAgenda'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('verificarAvisos').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('verificarAgenda').timeBased().everyMinutes(5).create();
  aba_('Push');
  var msg = st.ativo ? 'Avisos ativados. Agora, no app: Perfil › Notificações › Ativar.' : 'Gatilho criado, mas falta preencher na aba Config: ' + st.falta.join(', ');
  Logger.log(msg);
  return msg;
}

/** Para testar no editor: manda um aviso a todos os aparelhos ativos. */
function testarAvisos() {
  var ok = 0;
  ler_('Push').forEach(function (r) { if (r.Ativo === 'sim' && pushEnviar_(r.Token, { titulo: 'Rotina · teste', corpo: 'Aviso de teste enviado pelo editor.', url: '#hoje', tag: 'teste' }).ok) ok++; });
  Logger.log('Avisos enviados: ' + ok);
  return ok;
}
