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
  afazeres: 'Seus afazeres do dia, de manhã',
  pendencias: 'Pendências com prazo hoje ou amanhã, de manhã',
  contas: 'Contas fixas vencendo (2 dias antes e no dia)',
  trocas: 'Pedidos de troca de afazer',
  atribuidas: 'Pendência passada para você ou concluída',
  compras: 'Itens novos na lista de compras',
  resumo: 'Resumo da semana, domingo às 19h'
};
var PUSH_PADRAO = ['afazeres', 'pendencias', 'contas', 'trocas', 'atribuidas', 'resumo'];

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
  return ler_('Push').filter(function (r) { return r.Ativo === 'sim' && r.Pessoa === pessoa && String(r.Tipos).split(',').indexOf(tipo) >= 0; }).map(function (r) { return r.Token; });
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
function avisarPessoa_(pessoa, tipo, msg) {
  try {
    if (!pessoa || silencio_() || !pushStatus_().ativo) return 0;
    var n = 0;
    pushAparelhos_(pessoa, tipo).forEach(function (t) { if (pushEnviar_(t, msg).ok) n++; });
    return n;
  } catch (e) { Logger.log('aviso ' + tipo + ': ' + e); return 0; }
}
function avisarOutros_(autor, tipo, msg) {
  idsAtivos_().forEach(function (id) { if (id !== autor) avisarPessoa_(id, tipo, msg); });
}

/** Chamado por salvar_: pendência passada para alguém, pendência concluída, item novo na lista. */
function avisosDeSalvar_(s, col, antes, depois) {
  if (col === 'pendencias') {
    var resp = depois.resp, pessoa = resp !== 'ambos' && resp !== 'rodizio' ? resp : '';
    if (pessoa && pessoa !== s.pessoa && !depois.feita && (!antes || antes.resp !== resp))
      avisarPessoa_(pessoa, 'atribuidas', { titulo: nomeDe_(s.pessoa) + ' passou uma pendência para você', corpo: depois.titulo + (depois.prazo ? ' · prazo ' + dataCurta_(depois.prazo) : ''), url: '#pendencias', tag: 'pend-' + depois.id });
    if (depois.feita && antes && !antes.feita && depois.por && depois.por !== s.pessoa)
      avisarPessoa_(depois.por, 'atribuidas', { titulo: nomeDe_(s.pessoa) + ' concluiu uma pendência', corpo: depois.titulo, url: '#pendencias', tag: 'pend-' + depois.id });
  }
  if (col === 'compras' && !antes) {
    // No máximo um aviso a cada 10 minutos por pessoa: quem monta a lista adiciona vários itens seguidos
    var cache = CacheService.getScriptCache(), k = 'rotina_compras_' + s.pessoa;
    if (cache.get(k)) return;
    cache.put(k, '1', 600);
    avisarOutros_(s.pessoa, 'compras', { titulo: nomeDe_(s.pessoa) + ' adicionou à lista de compras', corpo: depois.item + (depois.qtd ? ' (' + depois.qtd + ')' : ''), url: '#compras', tag: 'compras' });
  }
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
    var afz = ativos_('afazeres'), pend = ativos_('pendencias'), amanha = N_somaDias(hoje, 1);
    pessoas.forEach(function (p) {
      var meus = afz.filter(function (a) { var q = N_quemFaz(a); return a.prox && a.prox <= hoje && (!q || q === p); });
      if (meus.length) {
        var atras = meus.filter(function (a) { return a.prox < hoje; }).length;
        avisarPessoa_(p, 'afazeres', { titulo: meus.length === 1 ? 'Hoje é com você: ' + meus[0].nome : meus.length + ' afazeres com você hoje',
          corpo: meus.length === 1 ? (atras ? 'Está atrasado desde ' + dataCurta_(meus[0].prox) + '.' : 'Toque para marcar quando terminar.')
            : lista_(meus.map(function (a) { return a.nome; })) + (atras ? ' (' + atras + ' atrasado' + (atras > 1 ? 's' : '') + ')' : ''), url: '#casa', tag: 'afazeres' });
      }
      var urg = pend.filter(function (x) { return !x.feita && x.prazo && x.prazo <= amanha && (x.resp === 'ambos' || x.resp === p); });
      if (urg.length) avisarPessoa_(p, 'pendencias', { titulo: urg.length === 1 ? 'Pendência: ' + urg[0].titulo : urg.length + ' pendências para hoje ou amanhã',
        corpo: urg.length === 1 ? (urg[0].prazo < hoje ? 'Está atrasada.' : urg[0].prazo === hoje ? 'O prazo é hoje.' : 'O prazo é amanhã.') : lista_(urg.map(function (x) { return x.titulo; })), url: '#pendencias', tag: 'pendencias' });
    });

    var mes = N_mes(hoje), pagos = {};
    ativos_('lancamentos').forEach(function (l) { if (l.conta && l.ref === mes) pagos[l.conta] = 1; });
    var vencendo = ativos_('contas').filter(function (c) {
      if (!c.ativa || pagos[c.id] || !c.vence) return false;
      var d = N_diasEntre(hoje, N_diaDoMes(mes, c.vence));
      return d === 0 || d === 2;
    });
    if (vencendo.length) {
      var hojeV = vencendo.filter(function (c) { return N_diaDoMes(mes, c.vence) === hoje; });
      pessoas.forEach(function (p) {
        avisarPessoa_(p, 'contas', { titulo: hojeV.length ? (hojeV.length === 1 ? hojeV[0].nome + ' vence hoje' : hojeV.length + ' contas vencem hoje') : (vencendo.length === 1 ? vencendo[0].nome + ' vence em 2 dias' : vencendo.length + ' contas vencem em 2 dias'),
          corpo: lista_(vencendo.map(function (c) { return c.nome + (c.v ? ' ' + reais_(c.v) : ''); })), url: '#financas', tag: 'contas' });
      });
    }
  }

  if (dow === 0 && hora === 19 && !feito('resumo')) {
    var seg = N_segunda(hoje), cont = {}, gasto = 0, pendOk = 0;
    ativos_('feitos').forEach(function (f) { if (f.dia >= seg) cont[f.quem] = (cont[f.quem] || 0) + 1; });
    ativos_('lancamentos').forEach(function (l) { if (l.dia >= seg && l.dia <= hoje && l.tipo === 'saida') gasto += l.v; });
    ativos_('pendencias').forEach(function (x) { if (x.feita && String(x.feitaEm).slice(0, 10) >= seg) pendOk++; });
    var placar = pessoas.map(function (p) { return nomeDe_(p) + ' ' + (cont[p] || 0); }).join(' · ');
    pessoas.forEach(function (p) {
      avisarPessoa_(p, 'resumo', { titulo: 'A semana da casa', corpo: 'Afazeres: ' + placar + '. Pendências resolvidas: ' + pendOk + '. Gastos: ' + reais_(gasto) + '.', url: '#hoje', tag: 'resumo' });
    });
  }

  if (hora === 3) {
    var lim = N_somaDias(hoje, -10), todas = props.getProperties();
    Object.keys(todas).forEach(function (k) { if (k.indexOf('AV_') === 0 && k.slice(-10) < lim) props.deleteProperty(k); });
  }
}

/** Rodar uma vez no editor: confere a configuração e cria o gatilho de hora em hora. */
function ativarAvisos() {
  var st = pushStatus_();
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'verificarAvisos') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('verificarAvisos').timeBased().everyHours(1).create();
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
