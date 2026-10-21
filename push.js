/* push.js — notificações no celular (Web Push pelo Firebase Cloud Messaging), igual ao RM, ao Rumo e ao RACHA.
   O servidor decide QUANDO avisar; aqui o aparelho só pede permissão, obtém o endereço (token) e escolhe os tipos.
   No iPhone, só funciona com o app instalado na tela de início (iOS 16.4 ou mais novo). */
'use strict';

const FIREBASE_VERSAO = '10.14.1';
const PUSH = { cfg: null, carregando: false, erro: null };
const _scripts = {};

function pushSuportado() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
function plataformaPush() { return IOS ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android' : 'computador'; }
function pushTiposLocais() { const t = lsGet('pushTipos'); return (t === null ? 'tarefas,agenda,agendanovo,contas,trocas,atribuidas,resumo,fechamento' : t.includes('agenda') ? t : t + ',tarefas,agenda,agendanovo').split(',').filter(Boolean); }

function carregarPushConfig() {
  if (PUSH.cfg || PUSH.carregando || !navigator.onLine || !S.sessao) return;
  PUSH.carregando = true;
  api('pushConfig', {}).then(c => { PUSH.cfg = c; PUSH.erro = null; })
    .catch(e => { PUSH.erro = e.message; })
    .finally(() => { PUSH.carregando = false; if (S.sheet && S.sheet.k === 'perfil') renderSheet(); });
}
function carregarScriptUnico(src) {
  _scripts[src] = _scripts[src] || new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.async = true;
    s.onload = () => res(); s.onerror = () => { delete _scripts[src]; rej(new Error('Sem internet para ativar as notificações.')); };
    document.head.appendChild(s);
  });
  return _scripts[src];
}
/** Obtém o token do Firebase usando o service worker do próprio app (que já sabe mostrar as notificações). */
async function tokenFirebase(cfg) {
  const base = 'https://www.gstatic.com/firebasejs/' + FIREBASE_VERSAO + '/';
  if (!window.firebase) await carregarScriptUnico(base + 'firebase-app-compat.js');
  if (!window.firebase.messaging) await carregarScriptUnico(base + 'firebase-messaging-compat.js');
  if (!firebase.apps.length) firebase.initializeApp(cfg.webConfig);
  const reg = await navigator.serviceWorker.ready;
  return firebase.messaging().getToken({ vapidKey: cfg.vapidKey, serviceWorkerRegistration: reg });
}

A['push-ativar'] = async () => {
  if (!pushSuportado()) { toast(IOS ? 'No iPhone, instale o app na tela de início para receber notificações.' : 'Este navegador não recebe notificações.', 6000); return; }
  // O pedido de permissão precisa ser a primeira coisa depois do toque (exigência do iPhone)
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { toast('Sem permissão, o app não consegue avisar. Dá para liberar depois nos ajustes do aparelho.', 6000); renderSheet(); return; }
  toast('Ativando notificações…');
  const cfg = PUSH.cfg || await api('pushConfig', {});
  PUSH.cfg = cfg;
  if (!cfg.ativo) throw new Error('As notificações ainda não foram configuradas no servidor da casa.');
  const tok = await tokenFirebase(cfg);
  if (!tok) throw new Error('O aparelho não devolveu o endereço de notificação. Tente de novo.');
  const r = await api('registrarPush', { token_push: tok, plataforma: plataformaPush(), tipos: pushTiposLocais() });
  lsSet('pushToken', tok); lsSet('pushTipos', r.tipos.join(',')); lsSet('pushVerif', N_iso(new Date()));
  toast('Notificações ativadas neste aparelho.');
  renderSheet(); renderTop();
};
A['push-tipo'] = async (d, el) => {
  const tok = lsGet('pushToken'); if (!tok) return;
  const t = d.t, atuais = pushTiposLocais(), liga = !atuais.includes(t);
  const novos = liga ? atuais.concat(t) : atuais.filter(x => x !== t);
  lsSet('pushTipos', novos.join(',')); renderSheet();
  try { await api('preferenciasPush', { token_push: tok, tipos: novos }); }
  catch (e) { lsSet('pushTipos', atuais.join(',')); renderSheet(); throw e; }
};
A['push-teste'] = async () => {
  const tok = lsGet('pushToken'); if (!tok) return;
  await api('testarPush', { token_push: tok });
  toast('Enviado. A notificação deve chegar em alguns segundos.');
};
A['push-desligar'] = async () => {
  const tok = lsGet('pushToken');
  if (tok) { try { await api('removerPush', { token_push: tok }); } catch (e) { /* desliga localmente mesmo assim */ } }
  try { if (window.firebase && firebase.apps.length) await firebase.messaging().deleteToken(); } catch (e) { /* ok */ }
  lsSet('pushToken', null); lsSet('pushVerif', null);
  toast('Notificações desligadas neste aparelho.');
  renderSheet(); renderTop();
};

/** Bloco do painel de notificações. */
function secaoPush() {
  const tok = lsGet('pushToken');
  if (!pushSuportado()) {
    return IOS && !INSTALADO()
      ? `<div class="note"><span>No iPhone, as notificações só funcionam com o app <b>instalado na tela de início</b> (iOS 16.4 ou mais novo).</span></div><button class="btn block" data-a="sheet" data-k="instalar">Como instalar</button>`
      : '<div class="note"><span>Este navegador não recebe notificações. No Android, use o Chrome; no computador, Chrome, Edge ou Safari.</span></div>';
  }
  if (Notification.permission === 'denied') return `<div class="note warn"><span>As notificações estão bloqueadas para o Rotina neste aparelho. ${IOS ? 'Libere em <b>Ajustes do iPhone › Notificações › Rotina</b>.' : 'Libere nas configurações do app ou do site (cadeado ao lado do endereço).'}</span></div>`;
  if (tok && Notification.permission === 'granted') {
    const tipos = pushTiposLocais(), nomes = (PUSH.cfg && PUSH.cfg.tipos) || { tarefas: 'Agenda e tarefas do dia, de manhã', agenda: 'Lembretes dos compromissos', agendanovo: 'Compromisso novo, mudado ou comentado', contas: 'Contas e faturas vencendo', trocas: 'Pedidos de troca de tarefa', atribuidas: 'Tarefa passada para você ou concluída', compras: 'Itens novos na lista de compras e em Para comprar', resumo: 'Resumo da semana e o combinado de domingo', fechamento: 'Fechamento do mês, no dia 1' };
    if (!PUSH.cfg) carregarPushConfig();
    return `<p class="small"><span class="chip good">ligadas</span> neste aparelho. Escolha o que quer receber:</p>
      <div class="stack">${Object.keys(nomes).map(k => `<div class="between"><span class="small">${esc(nomes[k])}</span><button class="tog ${tipos.includes(k) ? 'on' : ''}" data-a="push-tipo" data-t="${k}" aria-pressed="${tipos.includes(k)}" aria-label="${esc(nomes[k])}"></button></div>`).join('')}</div>
      <div class="qa"><button class="btn sm" data-a="push-teste">Enviar um teste</button><button class="btn ghost sm" data-a="push-desligar">Desligar aqui</button></div>`;
  }
  if (!navigator.onLine) return '<div class="note"><span>Conecte-se à internet para ativar as notificações.</span></div>';
  if (!PUSH.cfg) { carregarPushConfig(); return PUSH.erro ? `<div class="note warn"><span>${esc(PUSH.erro)}</span></div>` : '<p class="small muted">Carregando…</p>'; }
  if (!PUSH.cfg.ativo) return `<div class="note"><span>As notificações ainda não foram ligadas no servidor da casa. Veja a parte 3 do guia de implantação (uns 10 minutos, uma vez só).</span></div>`;
  return `<p class="small">Receba no celular: lembretes dos compromissos, agenda e tarefas do dia, contas vencendo e pedidos de troca. Você escolhe quais depois.</p>
    <button class="btn block" data-a="push-ativar">${ic('bell', 16)} Ativar notificações</button>`;
}

/** Uma vez por dia: confirma o token (o Firebase pode trocá-lo) ou limpa se a permissão foi retirada. */
async function revisarPush() {
  const tok = lsGet('pushToken');
  if (!tok || !S.sessao || !navigator.onLine || !pushSuportado()) return;
  if (Notification.permission !== 'granted') { try { await api('removerPush', { token_push: tok }); } catch (e) { /* ok */ } lsSet('pushToken', null); return; }
  const hojeIso = N_iso(new Date());
  if (lsGet('pushVerif') === hojeIso) return;
  try {
    const cfg = PUSH.cfg || await api('pushConfig', {});
    PUSH.cfg = cfg;
    if (!cfg.ativo) return;
    const novo = await tokenFirebase(cfg);
    if (novo && novo !== tok) { try { await api('removerPush', { token_push: tok }); } catch (e) { /* ok */ } }
    const r = await api('registrarPush', { token_push: novo || tok, plataforma: plataformaPush(), tipos: pushTiposLocais() });
    lsSet('pushToken', novo || tok); lsSet('pushTipos', r.tipos.join(',')); lsSet('pushVerif', hojeIso);
  } catch (e) { /* tenta de novo na próxima abertura */ }
}

/* Tocar numa notificação abre o app na tela certa (o service worker avisa qual) */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.ir) { location.hash = String(e.data.ir).replace(/^#?/, '#'); } });
}
