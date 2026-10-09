/* telas.js — as cinco telas: Hoje, Casa (afazeres), Pendências, Finanças e Compras. */
'use strict';

const isoLocal = ts => ts ? N_iso(new Date(ts)) : '';
function saudacao() { const h = new Date().getHours(); return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; }
const secao = (titulo, extra = '') => `<div class="sec"><h2 class="h2">${titulo}</h2>${extra}</div>`;
const vazio = (em, txt) => `<div class="vazio"><span class="em">${em}</span><span>${txt}</span></div>`;

/* ============================== linhas ============================== */
function tagPrazo(iso) {
  const h = hoje(), n = N_diasEntre(h, iso);
  if (n < 0) return `<span class="tag bad">${n === -1 ? 'desde ontem' : `atrasado ${-n} dias`}</span>`;
  if (n === 0) return '<span class="tag good">hoje</span>';
  return `<span class="tag">${rotuloDia(iso)}</span>`;
}
function linhaAfazer(a) {
  const q = quemFaz(a), t = a.troca;
  const quem = q ? `${av(q, 16)} ${esc(q === S.eu ? 'Você' : primeiroNome(q))}` : 'Qualquer um';
  const troca = t && t.st === 'pedida' ? `<span class="tag warm">${ic('swap', 12, 2.2)} troca pedida</span>` : t && t.st === 'aceita' ? '<span class="tag warm">trocado</span>' : '';
  return `<div class="it${a.pend ? ' pend' : ''}"><span class="em-tile">${esc(a.ic || '🏠')}</span>
    <button class="main" data-a="sheet" data-k="afazer" data-id="${a.id}"><span class="t">${esc(a.nome)}</span><span class="s">${a.prox ? tagPrazo(a.prox) : ''}<span>${quem}</span>${troca}</span></button>
    <button class="ck" data-a="concluir" data-id="${a.id}" aria-label="Marcar ${esc(a.nome)} como feito">${ic('check', 18, 2.4)}</button></div>`;
}
function linhaFeito(f) {
  const a = S.d.afazeres.get(f.afazer);
  return `<div class="it feito${f.pend ? ' pend' : ''}"><span class="em-tile">${esc(a ? a.ic : '🏠')}</span>
    <div class="main"><span class="t">${esc(f.nome)}</span><span class="s">${av(f.quem, 16)} ${esc(nomeDe(f.quem))} · ${rotuloDia(f.dia)}${f.hora ? ' às ' + esc(f.hora) : ''}</span></div>
    ${f.quem === S.eu ? `<button class="mini" data-a="desfazer" data-id="${f.id}" aria-label="Desfazer">${ic('undo', 18)}</button>` : '<span></span>'}</div>`;
}
function linhaPend(p) {
  const h = hoje(), tags = [];
  if (p.feita) tags.push(`Feita por ${esc(nomeDe(p.feitaPor))} ${rotuloDia(isoLocal(p.feitaEm))}`);
  else {
    if (p.alta) tags.push('<span class="tag warm">importante</span>');
    if (p.prazo) tags.push(`<span class="tag ${p.prazo < h ? 'bad' : p.prazo === h ? 'warn' : ''}">${ic('cal', 12, 2.2)} ${p.prazo < h ? 'venceu ' : ''}${rotuloDia(p.prazo)}</span>`);
    tags.push(p.resp === 'ambos' || !p.resp ? '<span>Nós dois</span>' : `<span>${av(p.resp, 16)} ${esc(nomeDe(p.resp))}</span>`);
  }
  return `<div class="it${p.feita ? ' feito' : ''}${p.pend ? ' pend' : ''}"><button class="ck${p.feita ? ' on' : ''}" data-a="pendok" data-id="${p.id}" aria-label="${p.feita ? 'Reabrir' : 'Concluir'} ${esc(p.titulo)}">${ic('check', 18, 2.4)}</button>
    <button class="main" data-a="sheet" data-k="pend" data-id="${p.id}"><span class="t">${esc(p.titulo)}</span><span class="s">${tags.join('')}</span></button><span></span></div>`;
}
function linhaConta(c, ref) {
  const n = N_diasEntre(hoje(), c.venc);
  const st = c.pago ? `<span class="tag good">${ic('check', 12, 2.6)} paga</span>`
    : n < 0 ? `<span class="tag bad">venceu ${rotuloDia(c.venc)}</span>`
    : n === 0 ? '<span class="tag warn">vence hoje</span>'
    : `<span class="tag">vence ${n < 7 ? rotuloDia(c.venc) : 'dia ' + N_dataObj(c.venc).getDate()}</span>`;
  return `<div class="it${c.pend ? ' pend' : ''}"><span class="em-tile">${esc(categoria(c.cat).ic)}</span>
    <button class="main" data-a="sheet" data-k="conta" data-id="${c.id}"><span class="t">${esc(c.nome)}</span><span class="s">${st}${!c.pago && c.v ? `<span>${reais(c.v)}</span>` : ''}</span></button>
    ${c.pago ? `<span class="v">${reais(c.pago.v)}</span>` : `<button class="btn sm" data-a="pagar" data-id="${c.id}" data-ref="${ref}">Pagar</button>`}</div>`;
}
function linhaLanc(l) {
  const c = categoria(l.cat), ent = l.tipo === 'entrada';
  return `<button class="it${l.pend ? ' pend' : ''}" data-a="sheet" data-k="lanc" data-id="${l.id}"><span class="em-tile">${esc(c.ic)}</span>
    <span class="main"><span class="t">${esc(l.desc || c.nome)}</span><span class="s"><span>${av(l.por, 15)} ${[l.desc ? c.nome : '', l.forma].filter(Boolean).map(esc).join(' · ')}</span></span></span>
    <span class="v ${ent ? 'c-good' : ''}">${ent ? '+' : '−'} ${reais(l.v)}</span></button>`;
}
const listaOu = (itens, fn, vz) => itens.length ? `<div class="lst">${itens.map(fn).join('')}</div>` : vz || '';

/* ============================== Hoje ============================== */
function scrHoje() {
  const h = hoje(), o = outro(), afz = afazeres();
  const pedidas = afz.filter(a => a.troca && a.troca.st === 'pedida' && a.troca.para === S.eu);
  const recusadas = afz.filter(a => a.troca && a.troca.st === 'recusada' && a.troca.de === S.eu);
  const doDia = afz.filter(a => a.prox && a.prox <= h);
  const meus = doDia.filter(comigo), doOutro = o ? doDia.filter(a => quemFaz(a) === o.id) : [];
  const feitosHoje = lista('feitos').filter(f => f.dia === h).sort((a, b) => String(b.hora).localeCompare(String(a.hora)));
  const pend = pendAbertas().filter(p => p.prazo && p.prazo <= N_somaDias(h, 2) && (p.resp === 'ambos' || p.resp === S.eu || !p.resp));
  const ref = N_mes(h), contas = contasMes(ref).filter(c => !c.pago && c.venc <= N_somaDias(h, 5));
  const t = totaisMes(ref), comOrc = categorias('saida').filter(c => c.orc), orc = comOrc.reduce((a, c) => a + c.orc, 0);
  const gastoOrc = lancMes(ref).filter(l => l.tipo !== 'entrada' && comOrc.some(c => c.id === l.cat)).reduce((a, l) => a + l.v, 0);
  const nCompras = lista('compras').filter(c => !c.comprado).length;

  let resumo = meus.length ? `Você tem ${meus.length} ${plu(meus.length, 'afazer', 'afazeres')} hoje` : 'Nada da casa com você hoje';
  if (o) resumo += doOutro.length ? `; ${esc(primeiroNome(o.id))} tem ${doOutro.length}.` : '.';
  else resumo += '.';

  return `<div class="stack" style="gap:4px"><p class="eb">${fmtData(h)}</p><h1 class="display">${saudacao()}, ${esc(primeiroNome(S.eu))}.</h1><p class="muted">${resumo}</p></div>
    ${!o ? `<div class="note warn"><span>Falta chamar a outra pessoa da casa. <button class="link" data-a="convidar">Mandar o convite</button></span></div>` : ''}
    ${pedidas.map(a => `<div class="troca"><div class="between"><div class="stack" style="gap:2px"><p class="h3">${esc(primeiroNome(a.troca.de))} pediu para você fazer ${esc(a.ic || '')} ${esc(a.nome)}</p>
      <p class="small muted">${a.troca.motivo ? '“' + esc(a.troca.motivo) + '” · ' : ''}${rotuloDia(a.prox)}. No rodízio, a próxima vez fica com ${esc(primeiroNome(a.troca.de))}.</p></div>${av(a.troca.de, 32)}</div>
      <div class="hrow"><button class="btn sm" data-a="troca" data-op="aceitar" data-id="${a.id}">Aceitar</button><button class="btn ghost sm" data-a="troca" data-op="recusar" data-id="${a.id}">Recusar</button></div></div>`).join('')}
    ${recusadas.map(a => `<div class="note"><span>${esc(primeiroNome(a.troca.para))} recusou a troca de <b>${esc(a.nome)}</b>. Continua com você.</span><button class="link" data-a="troca" data-op="cancelar" data-id="${a.id}">Ok</button></div>`).join('')}

    ${secao('Afazeres de hoje', `<button class="link" data-a="tab" data-v="casa">Ver todos</button>`)}
    ${meus.length || feitosHoje.length ? `<div class="lst">${meus.map(linhaAfazer).join('')}${feitosHoje.map(linhaFeito).join('')}</div>` : `<div class="panel">${vazio('🌿', afz.length ? 'Nada pendente com você hoje.' : 'Cadastre os afazeres da casa para dividir com quem mora com você.')}${afz.length ? '' : '<button class="btn block" data-a="tab" data-v="casa">Montar os afazeres</button>'}</div>`}
    ${o && doOutro.length ? `<p class="small muted">Com ${esc(primeiroNome(o.id))} hoje: ${doOutro.map(a => esc(a.nome)).join(', ')}.</p>` : ''}

    ${pend.length ? secao('Pendências urgentes', `<button class="link" data-a="tab" data-v="pendencias">Ver todas</button>`) + listaOu(pend, linhaPend) : ''}
    ${contas.length ? secao('Contas a pagar') + listaOu(contas, c => linhaConta(c, ref)) : ''}

    <button class="panel" data-a="tab" data-v="financas" style="border:0;text-align:left;cursor:pointer;color:inherit;font:inherit">
      <div class="between"><p class="eb">${fmtMes(ref)} até agora</p><span class="muted">${ic('chev', 18)}</span></div>
      <div class="grid2"><div class="stat"><span class="tiny muted">Gastos</span><b>${reais(t.sai)}</b></div><div class="stat"><span class="tiny muted">Saldo</span><b class="${t.saldo < 0 ? 'c-bad' : ''}">${reais(t.saldo)}</b></div></div>
      ${orc ? `<div class="stack" style="gap:6px">${bar(gastoOrc, orc, gastoOrc > orc ? 'var(--bad)' : gastoOrc > orc * .85 ? 'var(--warn)' : 'var(--accent)')}<span class="tiny muted">${reais(gastoOrc)} de ${reais(orc)} nas categorias com orçamento</span></div>` : ''}
    </button>
    ${nCompras ? `<button class="panel soft" data-a="tab" data-v="compras" style="border:0;text-align:left;cursor:pointer;color:inherit;font:inherit;flex-direction:row;align-items:center"><span class="em-tile" style="background:var(--s1)">🛒</span><span style="flex:1"><b>${nCompras} ${plu(nCompras, 'item', 'itens')}</b> na lista de compras</span>${ic('chev', 18)}</button>` : ''}`;
}

/* ============================== Casa (afazeres) ============================== */
const SUGESTOES = [
  { nome: 'Lavar a louça', ic: '🍽️', freq: 'dia', resp: 'rodizio' },
  { nome: 'Tirar o lixo', ic: '🗑️', freq: 'semana', dias: [1, 3, 5], resp: 'rodizio' },
  { nome: 'Lavar roupa', ic: '🧺', freq: 'semana', dias: [6], resp: 'rodizio' },
  { nome: 'Limpar o banheiro', ic: '🛁', freq: 'semana', dias: [6], resp: 'rodizio' },
  { nome: 'Aspirar e passar pano', ic: '🧹', freq: 'semana', dias: [0], resp: 'rodizio' },
  { nome: 'Trocar a roupa de cama', ic: '🛏️', freq: 'cada', n: 14, resp: 'rodizio' },
  { nome: 'Regar as plantas', ic: '🪴', freq: 'cada', n: 3, resp: 'ambos' },
  { nome: 'Fazer o mercado', ic: '🛒', freq: 'semana', dias: [6], resp: 'ambos' },
  { nome: 'Limpar a geladeira', ic: '🧊', freq: 'mes', dm: 1, resp: 'rodizio' }
];
function scrCasa() {
  const h = hoje(), todos = afazeres(), seg = N_segunda(h), f = S.fCasa;
  const afz = todos.filter(a => f === 'todos' ? true : f === 'eu' ? comigo(a) : quemFaz(a) === f);
  const grupos = [
    ['Atrasados', afz.filter(a => a.prox < h)],
    ['Hoje', afz.filter(a => a.prox === h)],
    ['Amanhã', afz.filter(a => a.prox === N_somaDias(h, 1))],
    ['Nos próximos dias', afz.filter(a => a.prox > N_somaDias(h, 1) && a.prox <= N_somaDias(h, 7))],
    ['Mais pra frente', afz.filter(a => a.prox > N_somaDias(h, 7))]
  ].filter(g => g[1].length);
  const semana = lista('feitos').filter(x => x.dia >= seg), total = semana.length;
  const recentes = lista('feitos').filter(x => x.dia >= N_somaDias(h, -6)).sort((a, b) => (b.dia + b.hora).localeCompare(a.dia + a.hora)).slice(0, 12);
  const usadas = new Set(todos.map(a => a.nome.toLowerCase()));
  const sug = SUGESTOES.map((s, i) => ({ ...s, i })).filter(s => !usadas.has(s.nome.toLowerCase()));

  return `<div class="between"><h1 class="display">Afazeres</h1><button class="btn sm" data-a="sheet" data-k="afazer">${ic('plus', 16, 2.4)} Novo</button></div>
    ${S.pessoas.length > 1 ? `<div class="panel"><div class="between"><p class="eb">Esta semana</p><span class="tiny muted">${total} ${plu(total, 'feito')}</span></div>
      <div class="grid2">${S.pessoas.slice(0, 4).map(p => { const n = semana.filter(x => x.quem === p.id).length; return `<div class="hrow" style="gap:10px">${av(p.id, 34)}<div><b class="num" style="font-size:20px;font-family:var(--fd)">${n}</b><p class="tiny muted">${esc(p.id === S.eu ? 'Você' : primeiroNome(p.id))}</p></div></div>`; }).join('')}</div>
      ${total ? `<div class="split">${S.pessoas.map(p => { const n = semana.filter(x => x.quem === p.id).length; return n ? `<i class="cor-${esc(p.cor)}" style="flex:${n}"></i>` : ''; }).join('')}</div>` : ''}</div>` : ''}
    ${todos.length ? `<div class="chips scroll">${[['todos', 'Todos'], ['eu', 'Comigo'], ...outros().map(p => [p.id, 'Com ' + primeiroNome(p.id)])].map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-a="filtro" data-k="fCasa" data-v="${k}">${esc(l)}</button>`).join('')}</div>` : ''}
    ${grupos.map(([t, l]) => secao(t, `<span class="tiny muted">${l.length}</span>`) + listaOu(l, linhaAfazer)).join('')}
    ${todos.length && !afz.length ? `<div class="panel">${vazio('🌿', 'Nada neste filtro.')}</div>` : ''}
    ${sug.length ? `<div class="panel soft"><p class="h3">${todos.length ? 'Mais ideias' : 'Comece com o básico'}</p><p class="small muted">Toque para adicionar. Depois dá para mudar dia, frequência e quem faz.</p>
      <div class="chips">${sug.map(s => `<button class="chip" data-a="sugestao" data-i="${s.i}">${s.ic} ${esc(s.nome)}</button>`).join('')}</div></div>` : ''}
    ${recentes.length ? secao('Feitos nos últimos dias') + listaOu(recentes, linhaFeito) : ''}`;
}

/* ============================== Pendências ============================== */
const pendAbertas = () => lista('pendencias').filter(p => !p.feita).sort((a, b) => (b.alta - a.alta) || (a.prazo || '9999').localeCompare(b.prazo || '9999') || String(a.em).localeCompare(String(b.em)));
function scrPend() {
  const h = hoje(), f = S.fPend;
  const filtro = p => f === 'todas' ? true : f === 'ambos' ? (p.resp === 'ambos' || !p.resp) : p.resp === f;
  const ab = pendAbertas().filter(filtro);
  const grupos = [
    ['Atrasadas', ab.filter(p => p.prazo && p.prazo < h)],
    ['Próximos 7 dias', ab.filter(p => p.prazo && p.prazo >= h && p.prazo <= N_somaDias(h, 7))],
    ['Mais adiante', ab.filter(p => p.prazo > N_somaDias(h, 7))],
    ['Sem prazo', ab.filter(p => !p.prazo)]
  ].filter(g => g[1].length);
  const feitas = lista('pendencias').filter(p => p.feita && filtro(p)).sort((a, b) => String(b.feitaEm).localeCompare(String(a.feitaEm))).slice(0, 30);
  const o = outros();
  return `<h1 class="display">Pendências</h1>
    <form data-f="pend" class="inrow"><input class="in" id="pendtxt" placeholder="O que precisa ser resolvido?" maxlength="120" autocomplete="off" enterkeyhint="done"><button class="btn" type="submit" aria-label="Adicionar">${ic('plus', 20, 2.4)}</button></form>
    <div class="chips scroll">${[['todas', 'Todas'], [S.eu, 'Minhas'], ...o.map(p => [p.id, 'De ' + primeiroNome(p.id)]), ['ambos', 'Nós dois']].map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-a="filtro" data-k="fPend" data-v="${k}">${esc(l)}</button>`).join('')}</div>
    ${grupos.map(([t, l]) => secao(t, `<span class="tiny muted">${l.length}</span>`) + listaOu(l, linhaPend)).join('')}
    ${!ab.length ? `<div class="panel">${vazio('✅', lista('pendencias').length ? 'Nada pendente por aqui.' : 'Anote o que precisa ser resolvido: pagar o IPTU, marcar o dentista, consertar o chuveiro…')}</div>` : ''}
    ${feitas.length ? `<details><summary>${secao('Concluídas', `<span class="tiny muted">${feitas.length}</span>`)}</summary>${listaOu(feitas, linhaPend)}</details>` : ''}`;
}

/* ============================== Finanças ============================== */
function scrFin() {
  const ref = S.mes, h = hoje(), atual = N_mes(h), t = totaisMes(ref), contas = contasMes(ref);
  const aPagar = contas.filter(c => !c.pago).reduce((a, c) => a + (c.v || 0), 0);
  const ls = lancMes(ref), porCat = {};
  ls.filter(l => l.tipo !== 'entrada').forEach(l => { porCat[l.cat] = (porCat[l.cat] || 0) + l.v; });
  const cats = categorias('saida').filter(c => c.orc || porCat[c.id]).sort((a, b) => (porCat[b.id] || 0) - (porCat[a.id] || 0));
  const semCat = Object.keys(porCat).filter(k => !categorias('saida').some(c => c.id === k));
  const temOrc = categorias('saida').some(c => c.orc);
  const vis = ls.filter(l => !S.fCat || l.cat === S.fCat).sort((a, b) => b.dia.localeCompare(a.dia) || String(b.em).localeCompare(String(a.em)));
  const dias = [...new Set(vis.map(l => l.dia))];
  const corOrc = (g, o) => g > o ? 'var(--bad)' : g > o * .85 ? 'var(--warn)' : 'var(--accent)';
  const orcLinha = c => { const g = porCat[c.id] || 0; return `<button class="orc ${S.fCat === c.id ? 'on' : ''}" data-a="fcat" data-v="${esc(c.id)}"><div class="between"><span class="t"><b>${esc(c.ic)} ${esc(c.nome)}</b></span><span class="num ${c.orc && g > c.orc ? 'c-bad' : 'muted'}">${reais(g)}${c.orc ? ` <span class="tiny">de ${reais(c.orc)}</span>` : ''}</span></div>${c.orc ? bar(g, c.orc, corOrc(g, c.orc)) : ''}</button>`; };

  return `<div class="mesnav"><button class="x" data-a="mes" data-v="-1" aria-label="Mês anterior">${ic('chevl', 18)}</button><h1 class="h1">${fmtMes(ref)}</h1><button class="x" data-a="mes" data-v="1" aria-label="Próximo mês" ${ref > atual ? 'disabled style="opacity:.3"' : ''}>${ic('chev', 18)}</button></div>
    <div class="panel hero"><p class="eb" style="color:inherit;opacity:.8">Saldo do mês</p><p class="saldo">${reais(t.saldo)}</p>
      <div class="grid2"><div class="stat"><span class="tiny muted">Entradas</span><b>${reais(t.ent)}</b></div><div class="stat"><span class="tiny muted">Saídas</span><b>${reais(t.sai)}</b></div></div>
      ${aPagar ? `<p class="small muted">Ainda faltam ${reais(aPagar)} em contas fixas. Saldo previsto: <b>${reais(t.saldo - aPagar)}</b>.</p>` : ''}</div>
    <div class="grid2"><button class="btn warm" data-a="novoLanc" data-tipo="saida">${ic('down', 16, 2.4)} Gasto</button><button class="btn" data-a="novoLanc" data-tipo="entrada">${ic('up', 16, 2.4)} Entrada</button></div>

    ${secao('Orçamento', `<button class="link" data-a="sheet" data-k="orcamento">${temOrc ? 'Editar' : 'Definir'}</button>`)}
    <div class="panel">${cats.length || semCat.length ? cats.map(orcLinha).join('') + semCat.map(k => orcLinha(categoria(k))).join('') : `<p class="small muted">Nenhum gasto neste mês ainda.</p>`}
      ${!temOrc ? `<div class="note"><span>Definam quanto querem gastar por categoria (mercado, delivery…) e o app avisa quando estiver chegando perto.</span></div>` : ''}</div>

    ${secao('Contas fixas', `<button class="link" data-a="sheet" data-k="conta">+ Nova</button>`)}
    ${listaOu(contas, c => linhaConta(c, ref), `<div class="panel">${vazio('🧾', 'Cadastre aluguel, luz, internet, escola… O app lembra antes de vencer.')}</div>`)}

    ${secao('Lançamentos', S.fCat ? `<button class="chip on" data-a="fcat" data-v="${esc(S.fCat)}">${esc(categoria(S.fCat).ic)} ${esc(categoria(S.fCat).nome)} ${ic('x', 12, 2.6)}</button>` : `<span class="tiny muted">${ls.length}</span>`)}
    ${dias.length ? dias.map(d => `<p class="dia-h">${rotuloDia(d) === fmtCurta(d) ? fmtData(d) : rotuloDia(d) + ' · ' + fmtCurta(d)}</p>${listaOu(vis.filter(l => l.dia === d), linhaLanc)}`).join('') : `<div class="panel">${vazio('💸', S.fCat ? 'Nada nessa categoria neste mês.' : 'Nenhum lançamento neste mês.')}</div>`}`;
}

/* ============================== Compras ============================== */
function historicoCompras() { try { return JSON.parse(lsGet('histCompras') || '[]'); } catch (e) { return []; } }
function lembrarCompra(nome) {
  const h = historicoCompras().filter(x => x.toLowerCase() !== nome.toLowerCase());
  h.unshift(nome); lsSet('histCompras', JSON.stringify(h.slice(0, 40)));
}
function linhaCompra(c) {
  return `<div class="it${c.comprado ? ' feito' : ''}${c.pend ? ' pend' : ''}"><button class="ck${c.comprado ? ' on' : ''}" data-a="comprado" data-id="${c.id}" aria-label="${c.comprado ? 'Desmarcar' : 'Marcar'} ${esc(c.item)}">${ic('check', 18, 2.4)}</button>
    <div class="main"><span class="t">${esc(c.item)}${c.qtd ? ` <span class="muted" style="font-weight:600">· ${esc(c.qtd)}</span>` : ''}</span>${c.comprado ? `<span class="s">${esc(nomeDe(c.compradoPor))} pegou</span>` : c.por && c.por !== S.eu ? `<span class="s">${av(c.por, 14)} ${esc(primeiroNome(c.por))} pediu</span>` : ''}</div>
    <button class="mini" data-a="rmCompra" data-id="${c.id}" aria-label="Tirar ${esc(c.item)} da lista">${ic('x', 18)}</button></div>`;
}
function scrCompras() {
  const todas = compras(), falta = todas.filter(c => !c.comprado), ok = todas.filter(c => c.comprado);
  const naLista = new Set(todas.map(c => c.item.toLowerCase()));
  const hist = historicoCompras().filter(x => !naLista.has(x.toLowerCase())).slice(0, 14);
  return `<div class="between"><h1 class="display">Compras</h1>${falta.length ? `<span class="tag">${falta.length} ${plu(falta.length, 'item', 'itens')}</span>` : ''}</div>
    <form data-f="compra" class="inrow"><input class="in" id="comptxt" placeholder="Ex.: 2 leite, pão, café" maxlength="200" autocomplete="off" enterkeyhint="done"><button class="btn" type="submit" aria-label="Adicionar">${ic('plus', 20, 2.4)}</button></form>
    ${hist.length ? `<div class="chips scroll">${hist.map(x => `<button class="chip" data-a="readd" data-v="${esc(x)}">+ ${esc(x)}</button>`).join('')}</div>` : ''}
    ${listaOu(falta, linhaCompra, `<div class="panel">${vazio('🛒', ok.length ? 'Tudo pego. Bom trabalho!' : 'A lista está vazia. Separe vários itens com vírgula.')}</div>`)}
    ${ok.length ? secao('No carrinho', `<span class="tiny muted">${ok.length}</span>`) + listaOu(ok, linhaCompra) +
      `<div class="grid2"><button class="btn ghost" data-a="gastoCompras">${ic('receipt', 16)} Lançar o gasto</button><button class="btn ghost" data-a="limparCompras">${ic('trash', 16)} Limpar</button></div>` : ''}`;
}
