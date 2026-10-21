/* analises.js — Finanças › Análises: para onde o dinheiro vai e o que já está comprometido.
   Futuro comprometido (parcelas), fluxo dos próximos 6 meses, mês contra a média, gastos que se repetem,
   por cartão, viagens e projetos, e o que outras pessoas devem devolver. Só leitura: as contas vêm de financas.js. */
'use strict';

/* ============================== cálculos ============================== */
/** Faturas que vencem nos próximos n meses, por cartão (só o que já foi comprado: parcelas e compras lançadas). */
function futuroComprometido(n) {
  const ref = N_mes(hoje()), meses = [], ks = cartoes();
  for (let i = 1; i <= n; i++) meses.push(N_somaMes(ref, i));
  const series = ks.map((k, j) => ({ nome: k.nome, cor: k.cor || CORES_CARTAO[j % CORES_CARTAO.length], vals: meses.map(m => fatura(k, m).total) })).filter(s => s.vals.some(Boolean));
  const tot = meses.map((m, i) => series.reduce((a, s) => a + s.vals[i], 0));
  return { meses, series, tot };
}
/** Compras parceladas que ainda têm parcelas pela frente: quando terminam e quanto liberam por mês. */
function parceladasAbertas() {
  const atual = N_mes(hoje()), g = {};
  lancs().filter(l => l.grupo && l.tipo === 'saida' && l.forma === 'cartao').forEach(l => {
    const m = mesCaixa(l), x = g[l.grupo] = g[l.grupo] || { desc: l.desc || categoria(l.cat).nome, n: (l.parc || '').split('/')[1] || '', parcela: l.v, fim: m, falta: 0, restam: 0, cartao: l.cartao };
    if (m > x.fim) x.fim = m;
    if (m > atual) { x.falta += l.v; x.restam++; }
  });
  return Object.values(g).filter(x => x.restam > 0).sort((a, b) => a.fim.localeCompare(b.fim) || b.parcela - a.parcela);
}
/** Os próximos 6 meses: o que entra (receitas fixas e lançadas), o que sai (contas fixas, faturas, agendados) e o saldo. */
function fluxoProximos(n) {
  const ref = N_mes(hoje()), out = [];
  let acum = 0;
  for (let i = 0; i < n; i++) {
    const m = N_somaMes(ref, i), p = previsaoMes(m), inv = recorrentesMes(m).filter(c => c.tipo === 'aporte' && c.status !== 'pago').reduce((a, c) => a + c.v, 0) + Math.max(0, resumoMes(m).inv);
    acum += p.rec - p.desp - inv;
    out.push({ ref: m, rec: p.rec, desp: p.desp, inv, saldo: p.rec - p.desp - inv, acum });
  }
  return out;
}
/** Meses com dados antes de "ref" (até 3), para a média não ser puxada para baixo por meses em que o app nem existia. */
function mesesBase(ref, n = 3) {
  const ini = mesesComDados()[0]; if (!ini) return [];
  const out = []; for (let i = 1; i <= n; i++) { const m = N_somaMes(ref, -i); if (m >= ini && resumoMes(m).desp > 0) out.push(m); }
  return out;
}
/** Categoria por categoria: o mês "ref" contra a média dos meses anteriores com dados. */
function contraMedia(ref) {
  const base = mesesBase(ref); if (!base.length) return { base, itens: [] };
  const rs = base.map(resumoMes), r = resumoMes(ref), ids = new Set([...Object.keys(r.porCat), ...rs.flatMap(x => Object.keys(x.porCat))]);
  const itens = [...ids].map(id => { const media = Math.round(rs.reduce((a, x) => a + (x.porCat[id] || 0), 0) / rs.length), v = r.porCat[id] || 0; return { id, v, media, dif: v - media, pct: media ? (v - media) / media : null }; })
    .filter(x => x.v || x.media).filter(x => Math.abs(x.dif) >= 5000);
  return { base, itens: itens.sort((a, b) => b.dif - a.dif), total: r.desp, mediaTotal: Math.round(rs.reduce((a, x) => a + x.desp, 0) / rs.length) };
}
/** Lojas que cobram todo mês (assinaturas, seguros, anuidade): aparecem em 2 ou mais meses, fora das compras parceladas. */
function gastosQueSeRepetem() {
  const g = {};
  lancs().filter(l => l.tipo === 'saida' && !l.grupo && !l.conta && l.desc).forEach(l => {
    const k = lojaDe(l.desc); if (!k) return;
    const x = g[k] = g[k] || { k, nome: l.desc, cat: l.cat, meses: {}, n: 0 };
    const m = N_mes(l.dia); x.meses[m] = (x.meses[m] || 0) + l.v; x.n++;
  });
  const fixas = new Set(recorrentes().map(c => lojaDe(c.nome)));
  return Object.values(g).map(x => {
    const ms = Object.keys(x.meses).sort(), vals = ms.map(m => x.meses[m]), media = Math.round(vals.reduce((a, v) => a + v, 0) / vals.length);
    const parecidos = vals.every(v => Math.abs(v - media) <= Math.max(1500, media * .25)); // valor parecido todo mês: cara de assinatura
    return { ...x, ms, media, anual: media * 12, parecidos, ultimo: ms[ms.length - 1], negociar: /anuidade|tarifa|seguro|allianz|porto seguro|mensalidade|plano/i.test(x.nome) };
  }).filter(x => x.ms.length >= 2 && (x.parecidos || categoria(x.cat).id === 'assinaturas') && !fixas.has(x.k) && x.ultimo >= N_somaMes(N_mes(hoje()), -2))
    .sort((a, b) => b.anual - a.anual);
}
function porProjeto() {
  const g = {};
  lancs().filter(l => l.tipo === 'saida' && (l.proj || '').trim()).forEach(l => {
    const k = l.proj.trim(), x = g[k] = g[k] || { nome: k, v: 0, n: 0, ini: l.dia, fim: l.dia, cats: {} };
    x.v += l.v; x.n++; if (l.dia < x.ini) x.ini = l.dia; if (l.dia > x.fim) x.fim = l.dia; x.cats[l.cat] = (x.cats[l.cat] || 0) + l.v;
  });
  return Object.values(g).sort((a, b) => b.fim.localeCompare(a.fim));
}

/* ============================== tela ============================== */
function finAnalises() {
  const ref = S.mes, fut = futuroComprometido(12), abertas = parceladasAbertas(), fluxo = fluxoProximos(6), cm = contraMedia(ref);
  const rep = gastosQueSeRepetem(), projs = porProjeto(), deve = aReceberDeTerceiros();
  const faltaParc = abertas.reduce((a, x) => a + x.falta, 0);
  // Mês em que mais dinheiro "libera": a maior queda das faturas já comprometidas
  let libera = null; fut.tot.forEach((v, i) => { if (i && fut.tot[i - 1] - v > (libera ? libera.v : 0)) libera = { ref: fut.meses[i], v: fut.tot[i - 1] - v }; });
  const cartMes = cartoes().map((k, j) => ({ k, cor: k.cor || CORES_CARTAO[j % CORES_CARTAO.length], v: fatura(k, ref).total })).filter(x => x.v).sort((a, b) => b.v - a.v), totCart = cartMes.reduce((a, x) => a + x.v, 0);
  const r = resumoMes(ref), foraCartao = r.desp - r.cartao;
  const subiu = cm.itens.filter(x => x.dif > 0).slice(0, 5), caiu = cm.itens.filter(x => x.dif < 0).sort((a, b) => a.dif - b.dif).slice(0, 3);
  const linhaCm = x => { const c = categoria(x.id); return `<button class="orc" data-a="fcat" data-v="${esc(x.id)}"><div class="between"><span><b>${esc(c.ic)} ${esc(c.nome)}</b></span><span class="num">${reais(x.v)} <span class="tiny ${x.dif > 0 ? 'c-bad' : 'c-good'}">${x.dif > 0 ? '▲' : '▼'} ${x.pct != null ? Math.round(Math.abs(x.pct) * 100) + '%' : 'novo'}</span></span></div><span class="tiny muted">média ${reais(x.media)} · ${x.dif > 0 ? '+' : '−'}${reais(Math.abs(x.dif))}</span></button>`; };

  return `${COL_INI}
    ${secao('Futuro comprometido', faltaParc ? `<span class="tiny muted">${reais(faltaParc)} em parcelas</span>` : '')}
    <div class="panel">${fut.series.length ? grafEmpilhado(fut.meses, fut.series, { rotulo: 'Faturas já comprometidas nos próximos 12 meses' })
      + `<p class="small muted" style="margin:0">O que já está comprado e vai cair nas próximas faturas${fut.tot[0] ? `: <b>${reais(fut.tot[0])}</b> em ${MESES[+fut.meses[0].slice(5) - 1]}` : ''}.${libera && libera.v >= 10000 ? ` Em <b>${MESES[+libera.ref.slice(5) - 1]}</b> libera ${reais(libera.v)} por mês.` : ''}</p>`
      : '<p class="small muted" style="margin:0">Nenhuma parcela pela frente. Compras parceladas no cartão aparecem aqui, mês a mês.</p>'}</div>
    ${abertas.length ? `<details class="panel" style="padding:14px 16px"><summary class="between"><b>Quando cada parcelamento acaba</b><span class="tiny muted">${abertas.length}</span></summary><div class="lst" style="margin-top:8px">${abertas.slice(0, 40).map(x => `<div class="it"><span class="em-tile">💳</span><span class="main"><span class="t">${esc(x.desc)}</span><span class="s"><span>${x.n ? x.n + 'x de ' : ''}${reais(x.parcela)}</span><span>faltam ${x.restam}</span></span></span><span class="stack" style="gap:2px;align-items:flex-end"><span class="v">${reais(x.falta)}</span><span class="tiny muted">acaba ${fmtMesCurto(x.fim + '-01')}</span></span></div>`).join('')}</div></details>` : ''}

    ${secao('Próximos 6 meses')}
    <div class="panel">${grafColunas(fluxo.map(x => x.ref), [{ nome: 'Entra', cor: VIZ.rec, vals: fluxo.map(x => x.rec) }, { nome: 'Sai', cor: VIZ.desp, vals: fluxo.map(x => x.desp + x.inv) }], 'Entradas e saídas previstas para os próximos 6 meses')}
      <div class="lst">${fluxo.map(x => `<div class="it"><span class="main"><span class="t">${fmtMes(x.ref)}</span><span class="s"><span>entra ${compacto(x.rec)} · sai ${compacto(x.desp + x.inv)}</span></span></span><span class="stack" style="gap:2px;align-items:flex-end"><span class="v ${x.saldo < 0 ? 'c-bad' : 'c-good'}">${x.saldo < 0 ? '−' : '+'}${reais(Math.abs(x.saldo))}</span><span class="tiny muted">acumulado ${x.acum < 0 ? '−' : ''}${compacto(Math.abs(x.acum))}</span></span></div>`).join('')}</div>
      <p class="tiny muted" style="margin:0">Receitas e contas fixas cadastradas, faturas já comprometidas e lançamentos agendados. Gastos do dia a dia que ainda não aconteceram não entram: deixe uma folga.</p></div>

    ${secao(`${fmtMes(ref)} contra a média`, cm.base.length ? `<span class="tiny muted">${cm.base.length} ${plu(cm.base.length, 'mês', 'meses')} antes</span>` : '')}
    <div class="panel">${!cm.base.length ? '<p class="small muted" style="margin:0">A comparação aparece quando houver pelo menos um mês inteiro antes deste.</p>'
      : `<p class="small" style="margin:0">Despesas: <b>${reais(cm.total)}</b> · média ${reais(cm.mediaTotal)} <span class="${cm.total > cm.mediaTotal ? 'c-bad' : 'c-good'}">(${cm.total > cm.mediaTotal ? '+' : '−'}${reais(Math.abs(cm.total - cm.mediaTotal))})</span></p>
        ${subiu.length ? `<p class="eb" style="margin:6px 0 0">Subiu</p>${subiu.map(linhaCm).join('')}` : ''}${caiu.length ? `<p class="eb" style="margin:6px 0 0">Caiu</p>${caiu.map(linhaCm).join('')}` : ''}
        ${!subiu.length && !caiu.length ? '<p class="small muted" style="margin:0">Tudo perto da média.</p>' : ''}`}</div>
    ${COL_MEIO}
    ${deve.length ? secao('A receber de outras pessoas', `<span class="tiny muted">${reais(deve.reduce((a, x) => a + x.v, 0))}</span>`) + `<div class="lst">${deve.map(x => `<div class="it"><span class="em-tile">🤝</span><span class="main"><span class="t">${esc(x.nome)}</span><span class="s"><span>${x.ls.length} ${plu(x.ls.length, 'gasto')}: ${esc(x.ls.slice(0, 3).map(l => tituloLanc(l)).join(', '))}${x.ls.length > 3 ? '…' : ''}</span></span></span><span class="stack" style="gap:4px;align-items:flex-end"><span class="v">${reais(x.v)}</span><button class="btn sm" style="padding:6px 10px" data-a="devolveu" data-v="${esc(x.nome)}">Devolveu</button></span></div>`).join('')}</div>` : ''}

    ${secao('Por cartão', `<span class="tiny muted">faturas de ${MESES[+ref.slice(5) - 1]}</span>`)}
    <div class="panel">${cartMes.length ? cartMes.map(x => `<button class="orc" data-a="sheet" data-k="fatura" data-id="${x.k.id}" data-v="${ref}"><div class="between"><span><b>${esc(x.k.nome)}</b></span><span class="num">${reais(x.v)} <span class="tiny muted">${Math.round(x.v / totCart * 100)}%</span></span></div>${bar(x.v, cartMes[0].v, x.cor)}</button>`).join('')
      + `<p class="tiny muted" style="margin:0">No cartão: ${reais(r.cartao)}${foraCartao > 0 ? ` · fora do cartão (Pix, boleto, débito): ${reais(foraCartao)}` : ''}.</p>` : '<p class="small muted" style="margin:0">Nenhuma fatura neste mês.</p>'}</div>

    ${secao('Gastos que se repetem', rep.length ? `<span class="tiny muted">${reais(rep.reduce((a, x) => a + x.anual, 0))} por ano</span>` : '')}
    <div class="panel">${rep.length ? `<div class="lst">${rep.slice(0, 12).map(x => `<button class="it" data-a="buscaExt" data-v="${esc(x.nome)}"><span class="em-tile">${esc(categoria(x.cat).ic)}</span><span class="main"><span class="t">${esc(x.nome)}</span><span class="s"><span>${reais(x.media)} por mês · ${x.ms.length} meses</span>${x.negociar ? '<span class="tag warn">dá para negociar</span>' : ''}</span></span><span class="stack" style="gap:2px;align-items:flex-end"><span class="v">${compacto(x.anual)}</span><span class="tiny muted">por ano</span></span></button>`).join('')}</div>
      <p class="tiny muted" style="margin:0">Cobranças com valor parecido em meses seguidos, fora das contas fixas e das compras parceladas. Vale olhar uma vez por ano: o que não usam, cancelem; anuidade e seguro, negociem.</p>`
      : '<p class="small muted" style="margin:0">Assinaturas, seguros e anuidades aparecem aqui quando houver dois meses ou mais de faturas.</p>'}</div>

    ${secao('Viagens e projetos')}
    ${projs.length ? `<div class="lst">${projs.map(x => { const top = Object.entries(x.cats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, v]) => `${categoria(id).ic} ${compacto(v)}`).join(' · '); return `<button class="it" data-a="buscaExt" data-v="${esc(x.nome)}"><span class="em-tile">✈️</span><span class="main"><span class="t">${esc(x.nome)}</span><span class="s"><span>${x.n} ${plu(x.n, 'gasto')} · ${fmtCurta(x.ini)}${x.fim !== x.ini ? ' a ' + fmtCurta(x.fim) : ''}</span><span>${esc(top)}</span></span></span><span class="v">${reais(x.v)}</span></button>`; }).join('')}</div>`
      : '<div class="panel"><p class="small muted" style="margin:0">Marque os gastos de uma viagem ou reforma (no lançamento, em "Viagem, projeto ou reembolso") para ver quanto custou no total, mesmo espalhado por vários cartões e meses.</p></div>'}
    ${COL_FIM}`;
}

Object.assign(A, {
  // Busca no Extrato em todos os meses do texto (loja ou projeto)
  buscaExt: d => { S.fv = 'extrato'; S.fExt = 'tudo'; S.fCat = null; S.busca = d.v; S.buscaTodos = true; render(false); },
  devolveu: d => {
    const g = aReceberDeTerceiros().find(x => x.nome === d.v); if (!g) return;
    if (!confirm(`${g.nome} devolveu ${reais(g.v)}?`)) return;
    enfileirar('lote', { col: 'lancamentos', itens: g.ls.map(l => ({ id: l.id, reembOk: true })) });
    const cat = (categorias('entrada').find(c => /reembols/i.test(c.id + c.nome)) || {}).id;
    toast(`Marcado: ${g.nome} devolveu.`, 6000, { rot: 'Lançar a entrada', fn: () => openSheet({ k: 'lanc', pre: { tipo: 'entrada', v: g.v, desc: 'Reembolso de ' + g.nome, cat: cat || '', dia: hoje(), pago: true } }) });
  }
});
