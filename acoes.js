/* acoes.js — o que cada toque faz, login, roteamento e a inicialização do app. */
'use strict';

const VERSAO_APP = '1.0.0';

/* ============ desenho ============ */
const ABAS_APP = [['hoje', 'Hoje', 'sun'], ['casa', 'Casa', 'home'], ['pendencias', 'Pendências', 'clip'], ['financas', 'Finanças', 'wallet'], ['compras', 'Compras', 'cart']];
const SCR = { hoje: scrHoje, casa: scrCasa, pendencias: scrPend, financas: scrFin, compras: scrCompras };
function renderTop() {
  const t = $('#top'); if (!t) return;
  const marca = `<p class="brand">Rotina<b>.</b></p>`;
  if (!S.sessao) { t.innerHTML = marca; return; }
  const env = S.fila.length, off = !navigator.onLine;
  t.innerHTML = `${marca}${off || env ? `<span class="tag ${off ? 'warn' : 'good'}" title="${env} envio(s) na fila">${off ? ic('wifi', 12, 2.2) + ' sem internet' : 'salvando…'}</span>` : ''}<span class="sp"></span>
    <button class="ib" data-a="sheet" data-k="perfil" aria-label="Perfil e ajustes">${av(S.eu, 34)}${S.pessoas.length < 2 || (pushSuportado() && !lsGet('pushToken')) ? '<span class="dot"></span>' : ''}</button>`;
}
function renderNav() {
  const n = $('#nav');
  if (!S.sessao) { n.innerHTML = ''; n.hidden = true; return; }
  n.hidden = false;
  const h = hoje();
  const badge = {
    casa: afazeres().filter(a => a.prox <= h && quemFaz(a) === S.eu).length,
    pendencias: pendAbertas().filter(p => p.prazo && p.prazo < h && (p.resp === S.eu || p.resp === 'ambos')).length
  };
  n.innerHTML = ABAS_APP.map(([k, l, i]) => `<button class="${S.tab === k ? 'on' : ''}" data-a="tab" data-v="${k}" aria-current="${S.tab === k ? 'page' : 'false'}">${ic(i, 22)}${l}${badge[k] ? `<span class="badge">${badge[k]}</span>` : ''}</button>`).join('');
}
function render(keep = true) {
  const m = $('#main'); if (!m) return; const y = m.scrollTop;
  try { m.innerHTML = S.sessao ? SCR[S.tab]() : telaLogin(); }
  catch (e) { console.error(e); m.innerHTML = `<div class="note warn"><span>Algo deu errado nesta tela: ${esc(e.message)}. Toque em outra aba ou feche e abra o app.</span></div>`; }
  m.scrollTop = keep ? y : 0; renderNav(); renderTop();
  S.diaDesenhado = hoje();
}
function renderSheet() {
  const L = $('#layer'); if (!S.sheet) { L.innerHTML = ''; return; }
  const k = S.sheet.k, prev = L.querySelector('.sheet'), same = prev && prev.dataset.k === k, y = same ? prev.scrollTop : 0;
  let html;
  try { html = SH[k](S.sheet); } catch (e) { console.error(e); html = head('Ops', 'Algo deu errado') + `<div class="note warn"><span>${esc(e.message)}</span></div>`; }
  L.innerHTML = `<div class="scrim" data-a="close"></div><div class="sheet" data-k="${k}" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  const nw = L.querySelector('.sheet'); if (y) nw.scrollTop = y; if (same) nw.style.animation = 'none';
}
function openSheet(o) { S.sheet = o; renderSheet(); }
function closeSheet() { S.sheet = null; renderSheet(); }
let tT;
function toast(msg, ms, acao) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${acao ? `<button type="button" id="toastbtn">${esc(acao.rot)}</button>` : ''}`;
  if (acao) $('#toastbtn').onclick = () => { t.hidden = true; acao.fn(); };
  t.hidden = false; t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(tT); tT = setTimeout(() => t.hidden = true, ms || 2800);
}
function aplicarTema() {
  const t = S.tema === 'claro' || S.tema === 'escuro' ? S.tema : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro');
  $('#app').dataset.theme = t;
  document.querySelector('meta[name=theme-color]').content = t === 'escuro' ? '#151411' : '#F5F1EA';
}
try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.tema === 'auto') aplicarTema(); }); } catch (e) { /* navegador antigo */ }

/* ============ login ============ */
function telaLogin() {
  const L = S.login || { modo: 'entrar' }, novo = L.modo === 'novo';
  const lin = (id, lab, val, extra) => `<label class="lab"><span>${lab}</span><input class="in" id="${id}" value="${esc(val || '')}" ${extra}></label>`;
  return `<div class="login">
    <img class="logo" src="icones/icone.svg" alt="">
    <h1 class="display" style="text-align:center">A casa em dia,<br>a dois.</h1>
    <p class="muted" style="text-align:center">Afazeres, pendências, contas e a lista do mercado, num lugar só.</p>
    <div class="seg" role="tablist"><button role="tab" class="${novo ? '' : 'on'}" aria-selected="${!novo}" data-a="loginmodo" data-v="entrar">Entrar</button><button role="tab" class="${novo ? 'on' : ''}" aria-selected="${novo}" data-a="loginmodo" data-v="novo">Primeiro acesso</button></div>
    <form data-f="login" class="stack" autocomplete="on">
      ${novo ? lin('lconvite', 'Código de convite da casa', L.convite, 'autocapitalize="characters" autocomplete="off" placeholder="Ex.: K7X2QM"') : ''}
      ${lin('lnome', 'Seu nome', L.nome, 'autocomplete="username" autocapitalize="words" maxlength="24"')}
      ${lin('lpin', novo ? 'Crie um PIN (4 a 8 números)' : 'PIN', '', `type="password" inputmode="numeric" autocomplete="${novo ? 'new-password' : 'current-password'}" maxlength="8"`)}
      ${L.erro ? `<div class="note warn"><span>${esc(L.erro)}</span></div>` : ''}
      <button class="btn block" type="submit" ${L.ocupado ? 'disabled' : ''}>${L.ocupado ? 'Entrando…' : novo ? 'Criar meu acesso' : 'Entrar'}</button>
    </form>
    ${novo ? '<p class="tiny muted">Seu PIN fica guardado de forma cifrada. Se esquecer, dá para redefinir pelo Apps Script.</p>' : ''}
    ${!CFG.api ? `<details class="small"><summary class="muted">Endereço do servidor</summary>${lin('lapi', 'URL /exec do Apps Script', apiUrl(), 'autocomplete="off"')}</details>` : ''}
  </div>`;
}
async function enviarLogin() {
  const L = S.login, novo = L.modo === 'novo', v = id => ($('#' + id) || {}).value || '';
  L.nome = v('lnome').trim(); L.convite = novo ? v('lconvite').trim() : L.convite;
  if ($('#lapi') && v('lapi').trim()) lsSet('api', v('lapi').trim());
  const pin = v('lpin').trim();
  if (!L.nome || !pin || (novo && !L.convite)) { L.erro = 'Preencha todos os campos.'; render(); return; }
  L.erro = ''; L.ocupado = true; render();
  try {
    const r = await api(novo ? 'cadastro' : 'login', { nome: L.nome, pin, convite: L.convite, aparelho: navigator.userAgent.slice(0, 110) }, { timeout: 60000 });
    entrarCom(r);
    S.login = null; S.tab = 'hoje'; history.replaceState(null, '', location.pathname);
    render(false);
    if (novo) toast(S.pessoas.length > 1 ? `Bem-vindo à ${S.casa.nome}.` : 'Casa criada. Agora chame a outra pessoa pelo convite.', 4500);
  } catch (e) { L.ocupado = false; L.erro = e.message; render(); }
}

/* ============ compras: "2 leite, pão" vira dois itens ============ */
function lerItensCompra(txt) {
  return String(txt).split(/[,;\n]/).map(x => x.trim()).filter(Boolean).map(x => {
    const m = x.match(/^(\d+(?:[.,]\d+)?\s*(?:kg|g|l|ml|un|und|cx|pct|dz|pacotes?|caixas?|latas?|garrafas?|duzias?|dúzias?)?)\s+(?:de\s+)?(.+)$/i);
    return m ? { item: m[2].slice(0, 80), qtd: m[1].trim().slice(0, 30) } : { item: x.slice(0, 80), qtd: '' };
  });
}
function addCompras(itens) {
  itens.forEach(c => { enfileirar('salvar', { col: 'compras', item: { id: uidNovo(), item: c.item[0].toUpperCase() + c.item.slice(1), qtd: c.qtd, comprado: false } }); lembrarCompra(c.item[0].toUpperCase() + c.item.slice(1)); });
}
const focar = id => { const el = $('#' + id); if (el) el.focus({ preventScroll: true }); };

/* ============ ações ============ */
const A = {
  tab: d => { S.tab = d.v; closeSheet(); render(false); },
  sheet: d => openSheet({ k: d.k, id: d.id }),
  close: () => closeSheet(),
  filtro: d => { S[d.k] = d.v; render(); },
  loginmodo: d => { S.login = { ...(S.login || {}), modo: d.v, erro: '' }; render(); },
  editar: () => { const s = S.sheet; if (s.k === 'afazer') s.f = formAfazer(S.d.afazeres.get(s.id)); renderSheet(); },

  // campos de formulário
  f: d => {
    const s = S.sheet, f = s.f; if (!f) return;
    let v = d.v;
    if (d.k === 'alta' || d.k === 'ativa') v = !!v;
    if (d.k === 'forma' && f.forma === v) v = '';
    f[d.k] = v;
    if (s.k === 'afazer' && d.k === 'freq') recalcProx(s);
    if (s.k === 'lanc' && d.k === 'tipo' && !categorias(v).some(c => c.id === f.cat)) f.cat = (categorias(v)[0] || {}).id || '';
    renderSheet();
  },
  fdia: d => {
    const s = S.sheet, f = s.f, n = +d.v;
    f.dias = f.dias.includes(n) ? f.dias.filter(x => x !== n) : [...f.dias, n].sort();
    if (!f.dias.length) { f.dias = [n]; toast('Escolha pelo menos um dia.'); }
    recalcProx(s); renderSheet();
  },

  // afazeres
  concluir: d => {
    const a = S.d.afazeres.get(d.id); if (!a) return;
    const feito = uidNovo();
    if (d.fechar) closeSheet();
    enfileirar('concluir', { id: a.id, feito, prox: a.prox, dia: hoje() });
    const nv = S.d.afazeres.get(a.id) || a, q = quemFaz(nv);
    toast(`${a.nome}: feito. Próxima vez ${rotuloDia(nv.prox)}${nv.resp === 'rodizio' && q ? (q === S.eu ? ', com você' : ', com ' + primeiroNome(q)) : ''}.`, 4500, { rot: 'Desfazer', fn: () => enfileirar('desfazer', { id: feito }) });
  },
  desfazer: d => { enfileirar('desfazer', { id: d.id }); toast('Desfeito.'); },
  troca: d => {
    const a = S.d.afazeres.get(d.id); if (!a) return;
    enfileirar('troca', { id: d.id, op: d.op });
    if (d.op === 'aceitar') toast(`Combinado: ${a.nome} fica com você desta vez.`);
    if (d.op === 'recusar') toast('Troca recusada.');
    if (d.op === 'cancelar' && S.sheet) renderSheet();
  },
  pedirTroca: () => {
    const s = S.sheet, f = s.f;
    if (!f.para) { toast('Ainda não tem com quem trocar.'); return; }
    enfileirar('troca', { id: s.id, op: 'pedir', para: f.para, motivo: f.motivo.trim() });
    closeSheet(); toast(`Pedido enviado para ${primeiroNome(f.para)}.`);
  },
  salvarAfazer: () => {
    const s = S.sheet, f = s.f, nome = f.nome.trim();
    if (!nome) { toast('Dê um nome ao afazer.'); focar('f-nome'); return; }
    if (!N_dataValida(f.prox)) { toast('Escolha a data da próxima vez.'); return; }
    const item = { id: s.id || uidNovo(), nome, ic: f.ic, freq: f.freq, dias: f.dias, n: clamp(parseInt(f.n, 10) || 1, 1, 365), dm: clamp(parseInt(f.dm, 10) || 1, 1, 31),
      resp: f.resp, vez: f.resp === 'rodizio' ? f.vez : '', prox: f.prox, nota: String(f.nota || '').trim() };
    closeSheet(); enfileirar('salvar', { col: 'afazeres', item });
    toast(s.id ? 'Afazer atualizado.' : `${nome} adicionado.`);
  },
  sugestao: d => {
    const g = SUGESTOES[+d.i]; if (!g) return;
    // Rodízio mesmo com uma pessoa só: quem entrar depois passa a fazer parte dele sozinho
    const item = { id: uidNovo(), nome: g.nome, ic: g.ic, freq: g.freq, dias: g.dias || [], n: g.n || 7, dm: g.dm || 1, resp: g.resp, vez: g.resp === 'rodizio' ? S.eu : '', nota: '' };
    item.prox = N_primeira(item, hoje());
    enfileirar('salvar', { col: 'afazeres', item });
    toast(`${g.nome} adicionado. Toque nele para ajustar.`);
  },

  // pendências
  pendok: d => {
    const p = S.d.pendencias.get(d.id); if (!p) return;
    const feita = !p.feita;
    if (d.fechar) closeSheet();
    enfileirar('salvar', { col: 'pendencias', item: { id: p.id, feita, feitaPor: feita ? S.eu : '', feitaEm: feita ? new Date().toISOString() : '' } });
    toast(feita ? 'Pendência resolvida.' : 'Pendência reaberta.', 3500, feita ? { rot: 'Desfazer', fn: () => A.pendok({ id: p.id }) } : null);
  },
  salvarPend: () => {
    const s = S.sheet, f = s.f, titulo = f.titulo.trim();
    if (!titulo) { toast('Escreva o que precisa ser resolvido.'); focar('f-titulo'); return; }
    const item = { id: s.id || uidNovo(), titulo, nota: String(f.nota || '').trim(), resp: f.resp, prazo: N_dataValida(f.prazo) ? f.prazo : '', alta: !!f.alta };
    const resp = f.resp !== 'ambos' && f.resp !== S.eu ? primeiroNome(f.resp) : '';
    closeSheet(); enfileirar('salvar', { col: 'pendencias', item });
    toast(resp ? `Pendência passada para ${resp}.` : s.id ? 'Pendência atualizada.' : 'Pendência anotada.');
  },

  // finanças
  mes: d => { S.mes = N_somaMes(S.mes, +d.v); S.fCat = null; render(false); },
  fcat: d => { S.fCat = S.fCat === d.v ? null : d.v; render(); },
  novoLanc: d => openSheet({ k: 'lanc', pre: { tipo: d.tipo, dia: S.mes === N_mes(hoje()) ? hoje() : S.mes + '-01' } }),
  pagar: d => {
    const c = S.d.contas.get(d.id); if (!c) return;
    openSheet({ k: 'lanc', pre: { tipo: 'saida', v: c.v, desc: c.nome, cat: c.cat, conta: c.id, ref: d.ref, dia: d.ref === N_mes(hoje()) ? hoje() : N_diaDoMes(d.ref, c.vence) } });
    setTimeout(() => focar('f-v'), 300);
  },
  salvarLanc: () => {
    const s = S.sheet, f = s.f, v = lerReais(f.v);
    if (v <= 0) { toast('Digite o valor.'); focar('f-v'); return; }
    if (!N_dataValida(f.dia)) { toast('Escolha a data.'); return; }
    const ent = f.tipo === 'entrada';
    const item = { id: s.id || uidNovo(), tipo: f.tipo, v, dia: f.dia, desc: String(f.desc || '').trim(), cat: f.cat, forma: ent ? '' : f.forma, conta: f.conta || '', ref: f.ref || '' };
    closeSheet(); enfileirar('salvar', { col: 'lancamentos', item });
    if (S.tab === 'financas' && N_mes(item.dia) !== S.mes) { S.mes = N_mes(item.dia); render(false); }
    toast(`${ent ? 'Entrada' : 'Gasto'} de ${reais(v)} lançado.`);
  },
  salvarConta: () => {
    const s = S.sheet, f = s.f, nome = f.nome.trim();
    if (!nome) { toast('Dê um nome à conta.'); focar('f-nome'); return; }
    const item = { id: s.id || uidNovo(), nome, v: lerReais(f.v), vence: clamp(parseInt(f.vence, 10) || 1, 1, 31), cat: f.cat, ativa: s.id ? !!f.ativa : true, nota: String(f.nota || '').trim() };
    closeSheet(); enfileirar('salvar', { col: 'contas', item });
    toast(s.id ? 'Conta atualizada.' : `${nome} cadastrada. Vence todo dia ${item.vence}.`);
  },
  addCat: () => {
    const f = S.sheet.f, nome = String(f.nnome || '').trim();
    if (!nome) { toast('Dê um nome à categoria.'); focar('f-nnome'); return; }
    const id = nome.normalize('NFD').replace(/[^A-Za-z0-9]/g, '').toLowerCase().slice(0, 12) + uidNovo().slice(-4);
    f.cats.push({ id, nome, ic: f.nic, tipo: f.ntipo, orc: 0, orcTxt: '' });
    f.nnome = ''; renderSheet();
  },
  rmCat: d => {
    const f = S.sheet.f, c = f.cats[+d.i]; if (!c) return;
    if (f.cats.filter(x => x.tipo === c.tipo).length < 2) { toast('Precisa ficar pelo menos uma categoria.'); return; }
    const usos = lista('lancamentos').filter(l => l.cat === c.id).length;
    if (usos && !confirm(`${c.nome} tem ${usos} ${plu(usos, 'lançamento')}. Eles vão aparecer como "Sem categoria". Remover mesmo assim?`)) return;
    f.cats.splice(+d.i, 1); renderSheet();
  },
  salvarOrc: () => {
    const cats = S.sheet.f.cats.map(c => ({ id: c.id, nome: String(c.nome || '').trim() || 'Sem nome', ic: c.ic, tipo: c.tipo, orc: c.tipo === 'saida' ? lerReais(c.orcTxt) : 0 }));
    closeSheet(); enfileirar('casa', { categorias: cats }); toast('Orçamento salvo.');
  },

  // compras
  comprado: d => { const c = S.d.compras.get(d.id); if (!c) return; const v = !c.comprado; enfileirar('salvar', { col: 'compras', item: { id: c.id, comprado: v, compradoPor: v ? S.eu : '', compradoEm: v ? new Date().toISOString() : '' } }); },
  rmCompra: d => { const c = S.d.compras.get(d.id); if (!c) return; enfileirar('excluir', { col: 'compras', id: d.id }); toast(`${c.item} saiu da lista.`, 3500, { rot: 'Desfazer', fn: () => addCompras([{ item: c.item, qtd: c.qtd }]) }); },
  readd: d => { addCompras([{ item: d.v, qtd: '' }]); },
  limparCompras: () => { const n = lista('compras').filter(c => c.comprado).length; enfileirar('limparCompras', {}); toast(`${n} ${plu(n, 'item saiu', 'itens saíram')} da lista.`); },
  gastoCompras: () => openSheet({ k: 'lanc', pre: { tipo: 'saida', cat: categorias('saida').some(c => c.id === 'mercado') ? 'mercado' : '', desc: 'Mercado', dia: hoje() } }),

  // genérico
  excluir: d => {
    const nomes = { afazeres: 'este afazer', pendencias: 'esta pendência', lancamentos: 'este lançamento', contas: 'esta conta fixa' };
    if (!confirm(`Excluir ${nomes[d.col] || 'isto'}? Some para os dois.`)) return;
    closeSheet(); enfileirar('excluir', { col: d.col, id: d.id }); toast('Excluído.');
  },

  // perfil
  tema: d => { S.tema = d.v; lsSet('tema', d.v === 'auto' ? null : d.v); aplicarTema(); renderSheet(); },
  convidar: async () => {
    const cod = S.casa && S.casa.convite; if (!cod) return;
    const link = location.origin + location.pathname + '#convite=' + cod;
    const texto = `Vamos organizar a casa juntos no Rotina? Abra ${link} e use o código ${cod}.`;
    try { if (navigator.share) { await navigator.share({ title: 'Rotina', text: texto }); return; } } catch (e) { if (e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(texto); toast('Convite copiado. Cole no WhatsApp.'); } catch (e) { toast('Código de convite: ' + cod, 6000); }
  },
  sair: async () => {
    if (!confirm('Sair deste aparelho? Seus dados continuam guardados na planilha.')) return;
    try { await api('sair', {}); } catch (e) { /* sai localmente mesmo assim */ }
    sairLocal();
  },
  instalarja: async () => { if (!S.instalarEvt) return; S.instalarEvt.prompt(); await S.instalarEvt.userChoice.catch(() => { }); S.instalarEvt = null; closeSheet(); }
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el || el.disabled) return;
  const fn = A[el.dataset.a]; if (!fn) return; e.preventDefault();
  try { const r = fn(el.dataset, el, e); if (r && r.catch) r.catch(x => toast(x.message)); } catch (x) { console.error(x); toast('Erro: ' + x.message); }
});
document.addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target.dataset.f;
  if (f === 'login') { enviarLogin(); return; }
  if (f === 'pend') {
    const el = $('#pendtxt'), v = el.value.trim(); if (!v) return;
    const resp = S.fPend !== 'todas' ? S.fPend : 'ambos';
    enfileirar('salvar', { col: 'pendencias', item: { id: uidNovo(), titulo: v.slice(0, 120), resp, nota: '', prazo: '', alta: false } });
    focar('pendtxt'); toast('Anotado. Toque nela para pôr prazo ou responsável.');
  }
  if (f === 'compra') { const el = $('#comptxt'), v = el.value.trim(); if (!v) return; addCompras(lerItensCompra(v)); focar('comptxt'); }
  if (f === 'pin') {
    const atual = $('#pinAtual').value.trim(), novo = $('#pinNovo').value.trim();
    if (!/^\d{4,8}$/.test(novo)) { toast('O PIN novo precisa ter de 4 a 8 números.'); return; }
    try { await api('trocarPin', { atual, novo }); closeSheet(); toast('PIN trocado.'); } catch (x) { toast(x.message); }
  }
});
function aoDigitar(e) {
  const t = e.target, k = t.dataset.i; if (!k || !S.sheet || !S.sheet.f) return;
  const s = S.sheet, f = s.f;
  if (k.startsWith('cnome:')) { f.cats[+k.slice(6)].nome = t.value; return; }
  if (k.startsWith('corc:')) { f.cats[+k.slice(5)].orcTxt = t.value; return; }
  f[k] = t.value;
  if (s.k === 'afazer') {
    if (k === 'prox') s.proxManual = true;
    if (k === 'dm' || k === 'n') { recalcProx(s); const el = $('#f-prox'); if (el) el.value = f.prox; }
  }
}
document.addEventListener('input', aoDigitar);
document.addEventListener('change', aoDigitar);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.sheet) closeSheet(); });

/* ============ rotas (links das notificações e do convite) ============ */
function aplicarRota() {
  const h = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (!h) return;
  const ap = h.match(/api=(https:\/\/script\.google\.com\/[^&]+)/);
  if (ap) lsSet('api', ap[1]);
  const cv = h.match(/convite=([A-Za-z0-9]+)/);
  if (cv) { if (!S.sessao) S.login = { modo: 'novo', convite: cv[1].toUpperCase() }; history.replaceState(null, '', location.pathname); return; }
  const tab = h.split('/')[0];
  if (SCR[tab]) S.tab = tab;
  history.replaceState(null, '', location.pathname);
}
window.addEventListener('hashchange', () => { aplicarRota(); closeSheet(); render(false); });

/* ============ inicialização ============ */
function tick() {
  if (!S.sessao || document.visibilityState !== 'visible') return;
  if (S.diaDesenhado !== hoje()) { S.mes = N_mes(hoje()); render(); }
  processarFila();
  sincronizar();
}
async function iniciar() {
  aplicarTema();
  const sessao = JSON.parse(lsGet('sessao') || 'null');
  aplicarRota();
  if (!sessao) { S.login = S.login || { modo: 'entrar' }; render(false); return; }
  S.sessao = sessao; S.eu = sessao.eu;
  const [cache, fila] = await Promise.all(['cache', 'fila'].map(k => idb.get(k).catch(() => null)));
  S.fila = fila || [];
  if (cache) aplicarSinc({ completo: true, agora: cache.ultimaSinc, casa: cache.casa, pessoas: cache.pessoas || [], ...(cache.cols || {}) });
  render(false);
  if (navigator.onLine) {
    await sincronizar(!cache);
    processarFila();
    if (typeof revisarPush === 'function') revisarPush();
  }
}
setInterval(tick, (CFG.intervaloSincSeg || 30) * 1000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); });
window.addEventListener('online', () => { renderTop(); processarFila(); sincronizar(); });
window.addEventListener('offline', () => renderTop());
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.instalarEvt = e; });
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) w.postMessage('ativar'); }); });
  }).catch(() => { });
  let recarregou = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (recarregou) return; recarregou = true; if (!S.sheet) location.reload(); });
}
/* iniciar() é chamado no fim do index.html, depois de carregar todos os arquivos. */
