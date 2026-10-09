/* base.js — utilidades, estado, armazenamento no aparelho, API, fila offline e sincronização. */
'use strict';

const CFG = Object.assign({ api: '', intervaloSincSeg: 30 }, window.ROTINA_CONFIG || {});
const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const INSTALADO = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const COLS = ['tarefas', 'feitos', 'eventos', 'perfis', 'arquivos', 'lancamentos', 'contas', 'cartoes', 'patrimonio', 'metas', 'compras'];

/* ============================== utilidades ============================== */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (n, d = 0) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const plu = (n, um, varios) => n === 1 ? um : (varios || um + 's');
const uidNovo = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const agoraHM = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
function lsGet(k) { try { return localStorage.getItem('rotina_' + k); } catch (e) { return null; } }
function lsSet(k, v) { try { if (v === null) localStorage.removeItem('rotina_' + k); else localStorage.setItem('rotina_' + k, v); } catch (e) { /* sem armazenamento */ } }

/* tela larga (computador): menu lateral e duas colunas. No celular as colunas somem e tudo fica em sequência. */
const LARGO = () => window.matchMedia('(min-width: 900px)').matches;
const COL_INI = '<div class="cols"><div class="col">', COL_MEIO = '</div><div class="col">', COL_FIM = '</div></div>';

/* datas */
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_LONGO = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const hoje = () => N_iso(new Date());
const isoLocal = ts => ts ? N_iso(new Date(ts)) : '';
const fmtData = iso => { const d = N_dataObj(iso); return `${DIAS_LONGO[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`; };
const fmtCurta = iso => { const d = N_dataObj(iso); return `${d.getDate()}/${String(d.getMonth() + 1).padStart(2, '0')}`; };
const fmtMes = ref => { const m = MESES[+ref.slice(5, 7) - 1]; return m[0].toUpperCase() + m.slice(1) + (ref.slice(0, 4) === hoje().slice(0, 4) ? '' : ' de ' + ref.slice(0, 4)); };
function rotuloDia(iso) {
  if (!iso) return '';
  const h = hoje(), n = N_diasEntre(h, iso);
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n === -1) return 'ontem';
  if (n > 1 && n < 7) return DIAS_LONGO[N_dataObj(iso).getDay()];
  if (n < 0 && n > -7) return `há ${-n} dias`;
  return fmtCurta(iso);
}

/* dinheiro: centavos inteiros no app */
const reais = (c, sinal) => (sinal && c > 0 ? '+' : '') + (c < 0 ? '−' : '') + 'R$ ' + fmt(Math.abs(c) / 100, 2);
const reaisCurto = c => Math.abs(c) >= 1e6 ? 'R$ ' + fmt(c / 100, 0) : reais(c);
/** "1.234,56", "12,5", "12.50" ou "R$ 30" viram centavos. */
function lerReais(txt) {
  let t = String(txt || '').replace(/[^\d,.-]/g, '');
  if (!t) return 0;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if ((t.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(t)) t = t.replace(/\./g, '');
  const v = parseFloat(t);
  return isFinite(v) ? Math.round(v * 100) : 0;
}
const reaisInput = c => c ? fmt(c / 100, 2) : '';

/* ============================== ícones ============================== */
const P = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  clip: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="m9 12 2 2 4-4"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z"/><path d="M16 14.5h.01"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h3l2.6 12.4a1.5 1.5 0 0 0 1.5 1.1h8.6a1.5 1.5 0 0 0 1.5-1.2L21.5 8H6.2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  chevl: '<path d="m15 6-6 6 6 6"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  swap: '<path d="M7 4 3 8l4 4"/><path d="M3 8h14"/><path d="m17 20 4-4-4-4"/><path d="M21 16H7"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17h.01"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/>',
  share: '<path d="M12 3v13"/><path d="m7 8 5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3z"/><path d="M9 8h6M9 12h6"/>',
  clipe: '<path d="m21 11.5-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9"/>',
  link: '<path d="M10 13.5a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10.5a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  pasta: '<path d="M3 7a2 2 0 0 1 2-2h4.5l2 2.2H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  wifi: '<path d="M2 8.8a15 15 0 0 1 20 0M5 12.6a10 10 0 0 1 14 0M8.5 16.4a5 5 0 0 1 7 0M12 20h.01"/>',
};
const ic = (n, s = 20, sw = 1.9) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || P.check}</svg>`;
const bar = (v, max, cor) => `<div class="bar" role="img" aria-label="${max ? Math.round(v / max * 100) : 0}%"><i style="width:${max ? clamp(v / max * 100, 0, 100) : 0}%;background:${cor}"></i></div>`;

/* ============================== armazenamento (IndexedDB) ============================== */
const idb = {
  db: null, mem: new Map(), falhou: false,
  abrir() {
    if (this.db || this.falhou) return Promise.resolve(this.db);
    return new Promise(res => {
      try {
        const r = indexedDB.open('rotina', 1);
        r.onupgradeneeded = () => { r.result.createObjectStore('kv'); };
        r.onsuccess = () => { this.db = r.result; res(this.db); };
        r.onerror = () => { this.falhou = true; res(null); };
      } catch (e) { this.falhou = true; res(null); }
    });
  },
  async op(modo, fn) {
    const db = await this.abrir();
    if (!db) return fn(null, this.mem);
    return new Promise((res, rej) => {
      const tx = db.transaction('kv', modo), q = fn(tx.objectStore('kv'));
      tx.oncomplete = () => res(q && q.result);
      tx.onerror = () => rej(tx.error);
    });
  },
  get(k) { return this.op('readonly', (os, mem) => mem ? mem.get(k) : os.get(k)); },
  set(k, v) { return this.op('readwrite', (os, mem) => mem ? mem.set(k, v) : os.put(v, k)); },
  del(k) { return this.op('readwrite', (os, mem) => mem ? mem.delete(k) : os.delete(k)); },
  limpar() { return this.op('readwrite', (os, mem) => mem ? mem.clear() : os.clear()); }
};

/* ============================== estado ============================== */
const novasColecoes = () => Object.fromEntries(COLS.map(c => [c, new Map()]));
const S = {
  // compartilhado (vem da sincronização)
  eu: null, casa: null, pessoas: [], d: novasColecoes(),
  // sessão e controle
  sessao: null, fila: [], ultimaSinc: 0, sincronizando: false,
  // tela
  tab: 'hoje', sheet: null, login: null, tema: lsGet('tema') || 'auto',
  fTar: 'todas', mes: N_mes(hoje()), fCat: null, fv: 'resumo', fExt: 'tudo', busca: '', placar: 'semana',
  ag: lsGet('agVisao') || 'lista', agDia: hoje(), fPess: '', fArq: '', arqBusca: ''
};

/* ============================== consultas ============================== */
const lista = col => [...S.d[col].values()];
/* Pessoas: quem entra no app (com nome e PIN) e os perfis sem login da família (filhos, pais, pet), usados na agenda. */
const perfis = () => lista('perfis').sort((a, b) => a.nome.localeCompare(b.nome));
const membros = () => [...S.pessoas.map(p => ({ ...p, login: true })), ...perfis().map(p => ({ ...p, cor: p.cor || 'e' }))];
const pessoa = id => S.pessoas.find(p => p.id === id) || (S.d.perfis && S.d.perfis.get(id)) || { id, nome: 'Alguém', cor: 'a' };
const nomeDe = id => id === S.eu ? 'Você' : pessoa(id).nome;
const primeiroNome = id => pessoa(id).nome.split(' ')[0];
const outros = () => S.pessoas.filter(p => p.id !== S.eu);
const outro = () => outros()[0] || null;
const idsAtivos = () => S.pessoas.map(p => p.id);
const av = (id, s = 28) => { const p = pessoa(id); return `<span class="av cor-${esc(p.cor || 'e')}" style="width:${s}px;height:${s}px;font-size:${Math.round(s * (p.ic ? .58 : .46))}px" aria-hidden="true">${p.ic ? esc(p.ic) : esc((p.nome || '?').trim()[0] || '?').toUpperCase()}</span>`; };

/* Tarefas: únicas ou que repetem. Quem faz: uma pessoa, nós dois ('ambos') ou revezando ('rodizio'). */
const quemFaz = a => N_quemFaz(a);
const comigo = a => { const q = quemFaz(a); return !q || q === S.eu; };
const tarefas = () => lista('tarefas').sort((a, b) => (b.alta - a.alta) || (a.prox || '9999').localeCompare(b.prox || '9999') || a.titulo.localeCompare(b.titulo));
const abertas = () => tarefas().filter(t => !t.feita);
const feitosDe = (id, dia) => lista('feitos').filter(f => f.afazer === id && (!dia || f.dia === dia));
const respNome = r => r === 'rodizio' ? 'Revezando' : r === 'ambos' || !r ? 'Nós dois' : primeiroNome(r);
function freqTexto(a) {
  if (!a.freq) return '';
  if (a.freq === 'dia') return 'todo dia';
  if (a.freq === 'cada') return `a cada ${a.n || 1} ${plu(+a.n || 1, 'dia')}`;
  if (a.freq === 'mes') return `todo dia ${a.dm || 1}`;
  if (a.freq === 'ano') return a.prox ? `todo ano em ${fmtCurta(a.prox)}` : 'todo ano';
  const d = N_diasSemana(a);
  return d.length === 7 ? 'todo dia' : 'toda ' + d.map(x => DIAS[x].toLowerCase()).join(', ');
}

const categorias = tipo => ((S.casa && S.casa.categorias) || []).filter(c => !tipo || c.tipo === tipo);
const categoria = id => categorias().find(c => c.id === id) || { id, nome: 'Sem categoria', ic: '📦', orc: 0, grupo: 'livre' };
const compras = () => lista('compras').sort((a, b) => (a.comprado - b.comprado) || String(b.em || '').localeCompare(String(a.em || '')));

/* ============================== API ============================== */
function erroApp(msg, codigo) { const e = new Error(msg); e.codigo = codigo || 'ERRO'; return e; }
function apiUrl() { return CFG.api || lsGet('api') || ''; }
async function api(acao, dados, opts) {
  const url = apiUrl();
  if (!url) throw erroApp('Endereço do servidor não configurado.', 'CONFIG');
  if (!navigator.onLine) throw erroApp('Sem internet agora.', 'OFFLINE');
  const corpo = Object.assign({ acao, token: S.sessao ? S.sessao.token : undefined }, dados || {});
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), (opts && opts.timeout) || 45000);
  let r;
  try { r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corpo), signal: ctl.signal, redirect: 'follow' }); }
  catch (e) { throw erroApp(e.name === 'AbortError' ? 'O servidor demorou para responder.' : 'Sem conexão com o servidor.', 'OFFLINE'); }
  finally { clearTimeout(t); }
  let j;
  try { j = await r.json(); } catch (e) { throw erroApp('Resposta inesperada do servidor. Confira se a implantação do Apps Script está como "Qualquer pessoa".', 'SERVIDOR'); }
  if (!j.ok) {
    if (j.codigo === 'SESSAO' && S.sessao) sairLocal('Sua sessão expirou. Entre de novo.');
    throw erroApp(j.erro || 'Erro no servidor.', j.codigo);
  }
  return j.dados;
}

/* ============================== mudanças locais ============================== */
/*
 * Toda mudança aparece na hora no aparelho (aplicarLocal) e vai para o servidor pela fila.
 * aplicarLocal é idempotente: depois de cada sincronização, os itens ainda na fila são aplicados de novo
 * por cima do que veio do servidor, para nada "piscar" de volta.
 */
function aplicarSalvar(col, item) {
  const m = S.d[col], atual = m.get(item.id), novo = { ...(atual || { por: S.eu, em: new Date().toISOString() }), ...item, pend: true };
  if (col === 'tarefas') {
    if (novo.freq && !novo.prox) novo.prox = N_primeira(novo, hoje());
    if (novo.resp === 'rodizio' && !novo.vez) novo.vez = S.eu;
    if (atual && item.resp && item.resp !== atual.resp) novo.troca = null;
  }
  if (col === 'compras' && novo.comprado && !(atual && atual.comprado)) { novo.compradoPor = novo.compradoPor || S.eu; novo.compradoEm = novo.compradoEm || new Date().toISOString(); }
  m.set(item.id, novo);
}
function aplicarLocal(f) {
  const d = f.dados;
  if (f.acao === 'salvar') aplicarSalvar(d.col, d.item);
  if (f.acao === 'lote') d.itens.forEach(it => aplicarSalvar(d.col, it));
  if (f.acao === 'enviarArquivo') { const a = S.d.arquivos.get(d.item.id); if (!a || !a.drive) aplicarSalvar('arquivos', { ...d.item, enviando: true }); }
  if (f.acao === 'excluir') (d.ids || [d.id]).forEach(id => S.d[d.col].delete(id));
  if (f.acao === 'limparCompras') lista('compras').filter(c => c.comprado).forEach(c => S.d.compras.delete(c.id));
  if (f.acao === 'concluir') {
    const a = S.d.tarefas.get(d.id);
    const pode = a && !S.d.feitos.has(d.feito) && (a.freq ? a.prox === d.prox : !a.feita);
    if (pode) {
      let antes, nova;
      if (a.freq) {
        const prox = N_proxima(a, d.dia);
        antes = { prox: a.prox, vez: a.vez, troca: a.troca ? JSON.stringify(a.troca) : '', itens: a.itens ? JSON.stringify(a.itens) : '', depois: prox };
        nova = { ...a, prox, vez: a.resp === 'rodizio' && !d.pular ? N_proximaVez(idsAtivos(), S.eu) : a.vez, troca: null, itens: (a.itens || []).map(x => ({ t: x.t, ok: false })), pend: true };
      } else {
        antes = { unica: true, troca: a.troca ? JSON.stringify(a.troca) : '' };
        nova = { ...a, feita: true, feitaPor: S.eu, feitaEm: new Date().toISOString(), troca: null, pend: true };
      }
      S.d.tarefas.set(a.id, nova);
      S.d.feitos.set(d.feito, { id: d.feito, afazer: a.id, nome: a.titulo, quem: S.eu, dia: d.dia, hora: agoraHM(), peso: a.peso || 2, pulou: !!d.pular, por: S.eu, pend: true, antes });
    }
  }
  if (f.acao === 'desfazer') {
    const fe = S.d.feitos.get(d.id), an = fe && fe.antes, a = fe && S.d.tarefas.get(fe.afazer);
    S.d.feitos.delete(d.id);
    if (an && a) {
      const troca = an.troca ? JSON.parse(an.troca) : null;
      if (an.unica && a.feita) S.d.tarefas.set(a.id, { ...a, feita: false, feitaPor: '', feitaEm: '', troca, pend: true });
      else if (!an.unica && a.prox === an.depois) S.d.tarefas.set(a.id, { ...a, prox: an.prox || a.prox, vez: an.vez || '', troca, itens: an.itens ? JSON.parse(an.itens) : a.itens, pend: true });
    }
  }
  if (f.acao === 'troca') {
    const a = S.d.tarefas.get(d.id); if (!a) return;
    let t = a.troca;
    if (d.op === 'pedir') t = { de: S.eu, para: d.para, st: 'pedida', motivo: d.motivo || '', prox: a.prox };
    else if (d.op === 'aceitar' && t) t = { ...t, st: 'aceita' };
    else if (d.op === 'recusar' && t) t = { ...t, st: 'recusada' };
    else if (d.op === 'cancelar') t = null;
    S.d.tarefas.set(a.id, { ...a, troca: t, pend: true });
  }
  if (f.acao === 'comentar') {
    const e = S.d.eventos.get(d.id); if (!e) return;
    const l = e.coments || [];
    if (!l.some(c => c.id === d.cid)) S.d.eventos.set(e.id, { ...e, coments: [...l, { id: d.cid, p: S.eu, t: d.texto, em: new Date().toISOString(), pend: true }], pend: true });
  }
  if (f.acao === 'casa' && S.casa) { if (d.categorias) S.casa.categorias = d.categorias; if (d.metodo) S.casa.metodo = d.metodo; if (d.nome) S.casa.nome = d.nome; }
}
/* Formulário aberto (S.sheet.f) não é redesenhado: não atropela o que está sendo digitado. Prévia de arquivo (estavel) também não, para não piscar. */
function redesenharSheet() { if (S.sheet && !S.sheet.f && !S.sheet.estavel) renderSheet(); }
function reaplicarFila() { S.fila.forEach(f => { try { aplicarLocal(f); } catch (e) { /* item antigo: ignora */ } }); }

/* ============================== fila offline ============================== */
const ERROS_DEFINITIVOS = ['VALIDACAO', 'PERMISSAO', 'LIMITE', 'NAOACHOU', 'ACAO'];
let _filaRodando = false;
function enfileirar(acao, dados) {
  const f = { id: uidNovo(), acao, dados, tent: 0 };
  // Edições seguidas do mesmo item viram um envio só (menos espera no servidor)
  const ini = _filaRodando ? 1 : 0;
  const igual = acao === 'salvar' && S.fila.slice(ini).find(x => x.acao === 'salvar' && x.dados.col === dados.col && x.dados.item.id === dados.item.id);
  if (igual) Object.assign(igual.dados.item, dados.item); else S.fila.push(f);
  aplicarLocal(f);
  salvarFila(); salvarCache(); render(); redesenharSheet();
  processarFila();
}
function salvarFila() { idb.set('fila', S.fila).catch(() => { }); }
async function processarFila() {
  if (_filaRodando || !S.sessao || !navigator.onLine) return;
  _filaRodando = true;
  let refazer = false;
  try {
    while (S.fila.length) {
      const item = S.fila[0];
      try {
        const dados = item.acao === 'enviarArquivo' ? await dadosDoEnvio(item.dados) : item.dados;
        if (!dados) { S.fila.shift(); salvarFila(); S.d.arquivos.delete(item.dados.item.id); toast('Um arquivo não pôde ser enviado: ele não está mais guardado neste aparelho. Anexe de novo.', 6000); continue; }
        const r = await api(item.acao, dados, { timeout: item.acao === 'enviarArquivo' ? 300000 : 90000 });
        S.fila.shift(); salvarFila();
        if (item.acao === 'enviarArquivo') idb.del('env:' + item.dados.item.id).catch(() => { });
        aplicarResposta(r);
      } catch (e) {
        if (ERROS_DEFINITIVOS.includes(e.codigo)) { S.fila.shift(); salvarFila(); toast(e.message, 5000); refazer = true; continue; }
        item.tent++; break;
      }
    }
  } finally { _filaRodando = false; renderTop(); }
  if (refazer) sincronizar(true); // volta ao que está no servidor
}
function aplicarResposta(r) {
  if (!r) return;
  if (r.col && r.item) mesclar(r.col, [r.item]);
  if (r.col && r.itens) mesclar(r.col, r.itens);
  if (r.feito) mesclar('feitos', [r.feito]);
  if (r.tarefa) mesclar('tarefas', [r.tarefa]);
  if (r.casa) S.casa = r.casa;
  reaplicarFila();
  salvarCache(); render(); redesenharSheet();
}

/* ============================== arquivos no aparelho ============================== */
/* O arquivo escolhido fica guardado no aparelho ('env:ID') até subir; quem abre um arquivo guarda uma cópia ('arq:ID')
   para ver sem internet. Cópias guardadas: até ~150 MB; as abertas há mais tempo saem primeiro (as importantes por último). */
const ARQ_LIMITE = 150 * 1024 * 1024;
const blobParaBase64 = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
function base64ParaBlob(b64, mime) { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: mime || 'application/octet-stream' }); }
async function dadosDoEnvio(d) {
  const g = await idb.get('env:' + d.item.id).catch(() => null);
  if (!g || !g.blob) return null;
  return { item: d.item, nome: g.nome, mime: g.blob.type || 'application/octet-stream', dados: await blobParaBase64(g.blob) };
}
async function guardarCopia(id, blob, nome) {
  try {
    await idb.set('arq:' + id, { blob, nome });
    const idx = ((await idb.get('arqIdx')) || []).filter(x => x.id !== id);
    idx.push({ id, tam: blob.size, t: Date.now() });
    let total = idx.reduce((a, x) => a + x.tam, 0);
    const fixo = x => { const a = S.d.arquivos.get(x.id); return a && a.fixo ? 1 : 0; };
    idx.sort((a, b) => fixo(a) - fixo(b) || a.t - b.t);
    while (total > ARQ_LIMITE && idx.length > 1) { const x = idx.shift(); total -= x.tam; await idb.del('arq:' + x.id); }
    await idb.set('arqIdx', idx);
  } catch (e) { /* sem espaço: só não guarda a cópia */ }
}
/** O arquivo para mostrar: do aparelho, se já tiver; senão, do servidor (e guarda uma cópia). */
async function pegarArquivo(id) {
  const c = await idb.get('arq:' + id).catch(() => null) || await idb.get('env:' + id).catch(() => null);
  if (c && c.blob) return c;
  const r = await api('baixarArquivo', { id }, { timeout: 120000 });
  const blob = base64ParaBlob(r.dados, r.mime);
  guardarCopia(id, blob, r.nome);
  return { blob, nome: r.nome };
}
async function temCopia(id) { const c = await idb.get('arq:' + id).catch(() => null) || await idb.get('env:' + id).catch(() => null); return !!(c && c.blob); }
/** Arquivos importantes ficam no aparelho para abrir sem internet (no consultório, na portaria…). */
let _guardando = false;
async function guardarImportantes() {
  if (_guardando || !navigator.onLine || !S.sessao) return;
  _guardando = true;
  try {
    for (const a of lista('arquivos').filter(x => x.fixo && x.drive && x.tipo === 'arquivo')) {
      if (await temCopia(a.id)) continue;
      try { await pegarArquivo(a.id); } catch (e) { break; }
    }
  } finally { _guardando = false; }
}

/* ============================== sincronização ============================== */
function mesclar(col, itens) {
  const m = S.d[col];
  (itens || []).forEach(x => { if (x.excluido) m.delete(x.id); else m.set(x.id, x); });
}
function aplicarSinc(r) {
  S.casa = r.casa || S.casa;
  if (r.pessoas) S.pessoas = r.pessoas;
  if (r.completo) S.d = novasColecoes();
  COLS.forEach(c => mesclar(c, r[c]));
  reaplicarFila();
  S.ultimaSinc = r.agora || S.ultimaSinc;
  salvarCache();
}
let _cacheT = null;
function salvarCache() {
  clearTimeout(_cacheT);
  _cacheT = setTimeout(() => {
    if (!S.sessao) return;
    const cols = {}; COLS.forEach(c => { cols[c] = lista(c).filter(x => !x.pend); });
    idb.set('cache', { casa: S.casa, pessoas: S.pessoas, eu: S.eu, cols, ultimaSinc: S.ultimaSinc }).catch(() => { });
  }, 300);
}
async function sincronizar(completo) {
  if (S.sincronizando || !S.sessao || !navigator.onLine) return;
  S.sincronizando = true;
  try {
    const r = await api('sync', { desde: completo ? 0 : Math.max(0, S.ultimaSinc - 5000) });
    aplicarSinc(r);
    render(); redesenharSheet();
    guardarImportantes();
  } catch (e) { /* tenta de novo no próximo ciclo */ }
  finally { S.sincronizando = false; renderTop(); }
}

/* ============================== login ============================== */
function entrarCom(r) {
  S.sessao = { token: r.token, eu: r.eu };
  S.eu = r.eu;
  lsSet('sessao', JSON.stringify(S.sessao));
  S.ultimaSinc = 0;
  aplicarSinc(r);
}
function sairLocal(msg) {
  S.sessao = null; S.eu = null; lsSet('sessao', null);
  idb.limpar().catch(() => { });
  S.fila = []; S.d = novasColecoes(); S.pessoas = []; S.casa = null;
  S.login = { modo: 'entrar', erro: msg || '' };
  closeSheet(); render(false);
}
