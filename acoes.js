/* acoes.js — o que cada toque faz, login, roteamento e a inicialização do app. */
'use strict';

const VERSAO_APP = '3.1.0';

/* ============ desenho ============ */
const ABAS_APP = [['hoje', 'Hoje', 'sun'], ['agenda', 'Agenda', 'cal'], ['tarefas', 'Tarefas', 'clip'], ['financas', 'Finanças', 'wallet'], ['compras', 'Compras', 'cart'], ['arquivos', 'Arquivos', 'pasta']];
const SCR = { hoje: () => scrHoje(), agenda: () => scrAgenda(), tarefas: () => scrTarefas(), financas: () => scrFin(), compras: () => scrCompras(), arquivos: () => scrArquivos() };
function renderTop() {
  const t = $('#top'); if (!t) return;
  const marca = `<p class="brand">Rotina<b>.</b></p>`;
  if (!S.sessao) { t.innerHTML = marca; return; }
  const env = S.fila.length, off = !navigator.onLine;
  t.innerHTML = `${marca}${off || env ? `<span class="tag ${off ? 'warn' : 'good'}" title="${env} envio(s) na fila">${off ? ic('wifi', 12, 2.2) + ' sem internet' : 'salvando…'}</span>` : ''}<span class="sp"></span>
    <button class="ib so-celular${S.tab === 'arquivos' ? ' on' : ''}" data-a="tab" data-v="arquivos" aria-label="Arquivos" title="Arquivos">${ic('pasta', 20)}</button>
    <button class="ib" data-a="sheet" data-k="perfil" aria-label="Perfil e ajustes">${av(S.eu, 34)}${S.pessoas.length < 2 || (pushSuportado() && !lsGet('pushToken')) ? '<span class="dot"></span>' : ''}</button>`;
}
function renderNav() {
  const n = $('#nav');
  if (!S.sessao) { n.innerHTML = ''; n.hidden = true; return; }
  n.hidden = false;
  const h = hoje();
  const badge = {
    agenda: eventosDoDia(h, true).filter(x => (x.e.pessoas || []).includes(S.eu) || x.e.leva === S.eu).length,
    tarefas: abertas().filter(t => t.prox && t.prox <= h && quemFaz(t) === S.eu).length
  };
  n.innerHTML = `<p class="brand nav-brand">Rotina<b>.</b></p>`
    + ABAS_APP.map(([k, l, i], j) => `<button class="${S.tab === k ? 'on' : ''}${k === 'arquivos' ? ' so-largo' : ''}" data-a="tab" data-v="${k}" aria-current="${S.tab === k ? 'page' : 'false'}" title="${l} (${j + 1})">${ic(i, 22)}${l}${badge[k] ? `<span class="badge">${badge[k]}</span>` : ''}</button>`).join('')
    + `<p class="nav-dica">Atalhos: <kbd>1</kbd>–<kbd>6</kbd> trocam de tela · <kbd>N</kbd> novo (compromisso, tarefa ou lançamento) · <kbd>/</kbd> buscar ou adicionar · <kbd>Esc</kbd> fecha</p>`;
}
function render(keep = true) {
  const m = $('#main'); if (!m) return; const y = m.scrollTop;
  $('#app').classList.toggle('logado', !!S.sessao);
  m.classList.toggle('estreito', !S.sessao || S.tab === 'compras' || S.tab === 'arquivos' || (S.tab === 'agenda' && S.ag === 'lista') || (S.tab === 'financas' && S.fv === 'extrato'));
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
function soltarPrevia() { if (S.sheet && S.sheet.url) { URL.revokeObjectURL(S.sheet.url); S.sheet.url = ''; } }
function openSheet(o) { if (!(o && o.volta === S.sheet)) soltarPrevia(); S.sheet = o; renderSheet(); }
function closeSheet() { soltarPrevia(); S.sheet = null; renderSheet(); }
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
    <p class="muted" style="text-align:center">Agenda, tarefas, finanças e a lista do mercado da família, num lugar só.</p>
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
  const novos = itens.map(c => { const nome = c.item[0].toUpperCase() + c.item.slice(1); lembrarCompra(nome); return { id: uidNovo(), item: nome, qtd: c.qtd, setor: setorDe(nome), comprado: false }; });
  if (novos.length === 1) enfileirar('salvar', { col: 'compras', item: novos[0] }); else enfileirar('lote', { col: 'compras', itens: novos });
}
const focar = id => { const el = $('#' + id); if (el) el.focus({ preventScroll: true }); };

/* ============ ações ============ */
const A = {
  tab: d => { S.tab = d.v; closeSheet(); render(false); },
  irFin: d => { S.tab = 'financas'; S.fv = d.v; S.mes = N_mes(hoje()); closeSheet(); render(false); },
  // Abrir um anexo de dentro de um compromisso (ou tarefa, lançamento): ao fechar, volta para ele
  sheet: d => openSheet({ k: d.k, id: d.id, v: d.v, volta: d.k === 'arquivo' && S.sheet && S.sheet.k !== 'arquivo' ? S.sheet : null }),
  close: () => { const v = S.sheet && S.sheet.volta; if (v) { soltarPrevia(); S.sheet = v; renderSheet(); } else closeSheet(); },
  filtro: d => { S[d.k] = d.v; render(); },
  loginmodo: d => { S.login = { ...(S.login || {}), modo: d.v, erro: '' }; render(); },

  // campos de formulário
  f: d => {
    const s = S.sheet, f = s.f; if (!f) return;
    let v = d.v;
    if (['alta', 'ativa', 'ativo', 'pago', 'diaTodo', 'fixo'].includes(d.k)) v = !!v;
    if (d.k === 'forma' && s.k === 'lanc' && f.forma === v) return;
    f[d.k] = v;
    if (s.k === 'tarefa' && d.k === 'freq') { if (v === 'mes' && f.prox) f.dm = +f.prox.slice(8); recalcProx(s); }
    if (s.k === 'tarefa' && d.k === 'prox') s.proxManual = true;
    if (s.k === 'evento' && d.k === 'diaTodo') { f.alertas = alertasPadrao(v, f.tipo).map(String); if (!v && !f.ini) f.ini = '09:00'; }
    if (s.k === 'evento' && d.k === 'tipo' && !s.id) { f.alertas = alertasPadrao(f.diaTodo, v).map(String); if (v === 'aniversario') { f.diaTodo = true; f.repete = 'ano'; f.alertas = alertasPadrao(true, v).map(String); } }
    if ((s.k === 'lanc' || s.k === 'conta') && d.k === 'tipo') {
      const cats = categorias(v === 'entrada' ? 'entrada' : 'saida');
      if (!cats.some(c => c.id === f.cat)) f.cat = (cats[0] || {}).id || '';
      if ((v === 'aporte' || v === 'resgate') && !investimentos().some(p => p.id === f.destino)) f.destino = (investimentos()[0] || {}).id || '';
      if (v === 'transf' && (!f.destino || f.destino === f.carteira || !contasBancarias().some(p => p.id === f.destino))) f.destino = (contasBancarias().find(p => p.id !== f.carteira) || {}).id || '';
    }
    if (s.k === 'pat' && d.k === 'grupo') f.classe = Object.keys(CLASSES).find(k => CLASSES[k].g === v);
    renderSheet();
  },
  fdia: d => {
    const s = S.sheet, f = s.f, n = +d.v;
    f.dias = f.dias.includes(n) ? f.dias.filter(x => x !== n) : [...f.dias, n].sort();
    if (!f.dias.length) { f.dias = [n]; toast('Escolha pelo menos um dia.'); }
    recalcProx(s); renderSheet();
  },

  // tarefas
  concluir: d => {
    const a = S.d.tarefas.get(d.id); if (!a || a.feita) return;
    const feito = uidNovo();
    if (d.fechar) closeSheet();
    enfileirar('concluir', { id: a.id, feito, prox: a.prox, dia: hoje() });
    const nv = S.d.tarefas.get(a.id) || a, q = quemFaz(nv);
    const msg = a.freq ? `${a.titulo}: feito. Próxima vez ${rotuloDia(nv.prox)}${nv.resp === 'rodizio' && q ? (q === S.eu ? ', com você' : ', com ' + primeiroNome(q)) : ''}.` : `${a.titulo}: concluída.`;
    toast(msg, 4500, { rot: 'Desfazer', fn: () => enfileirar('desfazer', { id: feito }) });
  },
  reabrir: d => {
    const a = S.d.tarefas.get(d.id); if (!a) return;
    if (d.fechar) closeSheet();
    const f = feitosDe(a.id).filter(x => !x.pulou).sort((x, y) => (y.dia + y.hora).localeCompare(x.dia + x.hora))[0];
    if (f) enfileirar('desfazer', { id: f.id }); else enfileirar('salvar', { col: 'tarefas', item: { id: a.id, feita: false, feitaPor: '', feitaEm: '' } });
    toast('Tarefa reaberta.');
  },
  desfazer: d => { enfileirar('desfazer', { id: d.id }); toast('Desfeito.'); },
  pular: d => {
    const a = S.d.tarefas.get(d.id); if (!a || !a.freq) return;
    const feito = uidNovo(); closeSheet();
    enfileirar('concluir', { id: a.id, feito, prox: a.prox, dia: hoje(), pular: true });
    toast(`${a.titulo}: pulada. Próxima vez ${rotuloDia(S.d.tarefas.get(a.id).prox)}.`, 4500, { rot: 'Desfazer', fn: () => enfileirar('desfazer', { id: feito }) });
  },
  troca: d => {
    const a = S.d.tarefas.get(d.id); if (!a) return;
    enfileirar('troca', { id: d.id, op: d.op });
    if (d.op === 'aceitar') toast(`Combinado: ${a.titulo} fica com você desta vez.`);
    if (d.op === 'recusar') toast('Troca recusada.');
    if (d.op === 'cancelar' && S.sheet) renderSheet();
  },
  pedirTroca: () => {
    const s = S.sheet, f = s.f;
    if (!f.para) { toast('Ainda não tem com quem trocar.'); return; }
    enfileirar('troca', { id: s.id, op: 'pedir', para: f.para, motivo: f.motivo.trim() });
    closeSheet(); toast(`Pedido enviado para ${primeiroNome(f.para)}.`);
  },
  salvarTarefa: () => {
    const s = S.sheet, f = s.f, titulo = f.titulo.trim();
    if (!titulo) { toast('Escreva o que precisa ser feito.'); focar('f-titulo'); return; }
    if (f.prox && !N_dataValida(f.prox)) { toast('Data inválida.'); return; }
    const item = { id: s.id || uidNovo(), titulo, ic: f.ic || '', nota: String(f.nota || '').trim(), area: f.area || '', resp: f.resp, vez: f.resp === 'rodizio' ? f.vez : '',
      prox: f.prox || (f.freq ? N_primeira(f, hoje()) : ''), freq: f.freq || '', dias: f.dias, n: clamp(parseInt(f.n, 10) || 1, 1, 365), dm: clamp(parseInt(f.dm, 10) || 1, 1, 31),
      peso: clamp(+f.peso || 2, 1, 3), alta: !!f.alta, itens: f.itens.map(({ t, ok }) => ({ t, ok })) };
    const para = f.resp !== 'ambos' && f.resp !== 'rodizio' && f.resp !== S.eu ? primeiroNome(f.resp) : '';
    closeSheet(); enfileirar('salvar', { col: 'tarefas', item });
    toast(para && !s.id ? `Tarefa passada para ${para}.` : s.id ? 'Tarefa atualizada.' : 'Tarefa anotada.');
  },
  sugestao: d => {
    const g = SUGESTOES[+d.i]; if (!g) return;
    // Revezando mesmo com uma pessoa só: quem entrar depois passa a fazer parte do revezamento sozinho
    const item = { id: uidNovo(), titulo: g.titulo, ic: g.ic, area: 'casa', freq: g.freq, dias: g.dias || [], n: g.n || 7, dm: g.dm || 1, resp: g.resp, vez: g.resp === 'rodizio' ? S.eu : '', peso: g.peso || 2, nota: '', itens: [], alta: false };
    item.prox = N_primeira(item, hoje());
    enfileirar('salvar', { col: 'tarefas', item });
    toast(`${g.titulo} adicionada. Toque nela para ajustar.`);
  },
  passoPend: d => {
    const s = S.sheet, x = s.f.itens[+d.i]; if (!x) return;
    x.ok = !x.ok; renderSheet();
    if (s.id) enfileirar('salvar', { col: 'tarefas', item: { id: s.id, itens: s.f.itens.map(({ t, ok }) => ({ t, ok })) } });
  },
  addPasso: () => {
    const s = S.sheet, t = String(s.f.novoItem || '').trim(); if (!t) { focar('f-novoItem'); return; }
    s.f.itens.push({ t: t.slice(0, 80), ok: false }); s.f.novoItem = ''; renderSheet(); focar('f-novoItem');
    if (s.id) enfileirar('salvar', { col: 'tarefas', item: { id: s.id, itens: s.f.itens.map(({ t: tt, ok }) => ({ t: tt, ok })) } });
  },
  rmPasso: d => {
    const s = S.sheet; s.f.itens.splice(+d.i, 1); renderSheet();
    if (s.id) enfileirar('salvar', { col: 'tarefas', item: { id: s.id, itens: s.f.itens.map(({ t, ok }) => ({ t, ok })) } });
  },


  // compras
  comprado: d => { const c = S.d.compras.get(d.id); if (!c) return; const v = !c.comprado; enfileirar('salvar', { col: 'compras', item: { id: c.id, comprado: v, compradoPor: v ? S.eu : '', compradoEm: v ? new Date().toISOString() : '' } }); },
  rmCompra: d => { const c = S.d.compras.get(d.id); if (!c) return; enfileirar('excluir', { col: 'compras', id: d.id }); toast(`${c.item} saiu da lista.`, 3500, { rot: 'Desfazer', fn: () => addCompras([{ item: c.item, qtd: c.qtd }]) }); },
  readd: d => { addCompras([{ item: d.v, qtd: '' }]); },
  salvarCompra: () => {
    const s = S.sheet, f = s.f, item = f.item.trim(); if (!item) { toast('Escreva o item.'); return; }
    closeSheet(); enfileirar('salvar', { col: 'compras', item: { id: s.id, item, qtd: f.qtd.trim(), setor: f.setor } });
  },
  limparCompras: () => { const n = lista('compras').filter(c => c.comprado).length; enfileirar('limparCompras', {}); toast(`${n} ${plu(n, 'item saiu', 'itens saíram')} da lista.`); },
  gastoCompras: () => { openSheet({ k: 'lanc', pre: { tipo: 'saida', cat: categorias('saida').some(c => c.id === 'mercado') ? 'mercado' : '', desc: 'Mercado', dia: hoje() } }); setTimeout(() => focar('f-v'), 280); },

  // genérico
  excluir: d => {
    const nomes = { tarefas: 'esta tarefa', perfis: 'esta pessoa da agenda', lancamentos: 'este lançamento', contas: 'esta conta fixa', cartoes: 'este cartão', patrimonio: 'este item', metas: 'esta meta' };
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
  if (f === 'tarefa') {
    const el = $('#tartxt'), v = el.value.trim(); if (!v) return;
    const resp = S.fTar !== 'todas' && S.fTar !== 'casa' ? S.fTar : 'ambos';
    enfileirar('salvar', { col: 'tarefas', item: { id: uidNovo(), titulo: v.slice(0, 120), resp, nota: '', prox: '', freq: '', alta: false, itens: [], peso: 2 } });
    focar('tartxt'); toast('Anotada. Toque nela para pôr data, responsável ou repetição.');
  }
  if (f === 'evento') {
    const el = $('#evtxt'), v = el.value.trim(); if (!v) return;
    const pre = lerEvento(v); el.value = '';
    openSheet({ k: 'evento', pre }); toast('Confira e salve.');
  }
  if (f === 'coment') {
    const el = $('#comtxt'), v = el.value.trim(); if (!v || !S.sheet) return;
    enfileirar('comentar', { id: S.sheet.id, cid: uidNovo(), texto: v.slice(0, 500) }); renderSheet(); focar('comtxt');
  }
  if (f === 'compra') { const el = $('#comptxt'), v = el.value.trim(); if (!v) return; addCompras(lerItensCompra(v)); focar('comptxt'); }
  if (f === 'pin') {
    const atual = $('#pinAtual').value.trim(), novo = $('#pinNovo').value.trim();
    if (!/^\d{4,8}$/.test(novo)) { toast('O PIN novo precisa ter de 4 a 8 números.'); return; }
    try { await api('trocarPin', { atual, novo }); closeSheet(); toast('PIN trocado.'); } catch (x) { toast(x.message); }
  }
});
function aoDigitar(e) {
  const t = e.target, k = t.dataset.i;
  if (k === 'busca') { S.busca = t.value; const L = $('#extlista'); if (L) { const y = $('#main').scrollTop; render(); const b = $('#busca'); if (b) { b.focus({ preventScroll: true }); b.setSelectionRange(b.value.length, b.value.length); } $('#main').scrollTop = y; } return; }
  if (k === 'arqbusca') { S.arqBusca = t.value; const y = $('#main').scrollTop; render(); const b = $('#arqbusca'); if (b) { b.focus({ preventScroll: true }); b.setSelectionRange(b.value.length, b.value.length); } $('#main').scrollTop = y; return; }
  if (!k || !S.sheet || !S.sheet.f) return;
  const s = S.sheet, f = s.f;
  if (k.startsWith('met:')) { f.met[k.slice(4)] = t.value; return; }
  if (k.startsWith('cnome:')) { f.cats[+k.slice(6)].nome = t.value; return; }
  if (k.startsWith('corc:')) { f.cats[+k.slice(5)].orcTxt = t.value; return; }
  f[k] = t.value;
  if (s.k === 'tarefa') {
    if (k === 'prox') s.proxManual = true;
    if (k === 'dm' || k === 'n') { recalcProx(s); const el = $('#f-prox'); if (el) el.value = f.prox; }
  }
}
document.addEventListener('input', aoDigitar);
document.addEventListener('change', aoDigitar);
/* Teclado (computador): Esc fecha, 1–5 trocam de tela, N abre um lançamento, / vai para a busca ou o campo de adicionar */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (S.sheet) A.close(); else if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); return; }
  const alvo = e.target, digitando = alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName));
  if (digitando || e.ctrlKey || e.metaKey || e.altKey || !S.sessao || S.sheet) return;
  if (/^[1-6]$/.test(e.key)) { e.preventDefault(); A.tab({ v: ABAS_APP[+e.key - 1][0] }); return; }
  if (e.key === 'n' || e.key === 'N') { e.preventDefault(); if (S.tab === 'agenda') A.novoEvento({}); else if (S.tab === 'arquivos') A.anexar({ abrir: '1' }); else if (S.tab === 'tarefas') A.sheet({ k: 'tarefa' }); else A.novoLanc({ tipo: 'saida' }); return; }
  if (e.key === '/') { const c = $('#busca') || $('#arqbusca') || $('#comptxt') || $('#tartxt') || $('#evtxt'); if (c) { e.preventDefault(); c.focus(); } }
});
/* Ao passar da tela de celular para a de computador (ou girar o tablet), redesenha no novo formato */
try { window.matchMedia('(min-width: 900px)').addEventListener('change', () => { if (S.sessao) { render(); if (S.sheet) renderSheet(); } }); } catch (e) { /* navegador antigo */ }

/* ============ rotas (links das notificações e do convite) ============ */
function aplicarRota() {
  const h = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (!h) return;
  const ap = h.match(/api=(https:\/\/script\.google\.com\/[^&]+)/);
  if (ap) lsSet('api', ap[1]);
  const cv = h.match(/convite=([A-Za-z0-9]+)/);
  if (cv) { if (!S.sessao) S.login = { modo: 'novo', convite: cv[1].toUpperCase() }; history.replaceState(null, '', location.pathname); return; }
  let [tab, sub] = h.split('/');
  if (tab === 'casa' || tab === 'pendencias') tab = 'tarefas'; // endereços da versão 2
  if (SCR[tab]) S.tab = tab;
  if (tab === 'agenda' && sub === 'semana' && S.sessao) setTimeout(() => openSheet({ k: 'semana' }), 300);
  if (tab === 'financas' && sub) S.fv = sub;
  if (tab === 'novo') { S.tab = 'financas'; S.fv = 'resumo'; S.abrirNovo = true; } // atalho do ícone instalado
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
  if (S.abrirNovo) { S.abrirNovo = false; A.novoLanc({ tipo: 'saida' }); }
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
