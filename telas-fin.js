/* telas-fin.js — Finanças: Resumo, Extrato, Contas, Cartões, Orçamento, Metas e Patrimônio, os painéis de cadastro e as ações.
   Carregado depois de acoes.js (acrescenta ações ao objeto A). As contas ficam em financas.js. */
'use strict';

const FIN_ABAS = [['resumo', 'Resumo'], ['analises', 'Análises'], ['extrato', 'Extrato'], ['contas', 'Contas'], ['cartoes', 'Cartões'], ['orcamento', 'Orçamento'], ['metas', 'Metas'], ['patrimonio', 'Patrimônio'], ['investimentos', 'Investimentos']];
const CORES_CARTAO = ['#5B3FA0', '#C62828', '#C8643C', '#2E6A57', '#1F2937', '#3B6EA5', '#B8860B'];
const statusTag = st => st === 'pago' ? `<span class="tag good">${ic('check', 12, 2.6)} pago</span>` : st === 'vencido' ? `<span class="tag bad">${ic('alert', 12, 2.4)} vencido</span>` : '';
const pctTxt = x => x == null ? '—' : Math.round(x * 100) + '%';
const opcConta = (vazio) => [...(vazio ? [['', vazio]] : []), ...contasBancarias().map(p => [p.id, `${esc(p.ic || classe(p.classe).ic)} ${esc(p.nome)}`])];

/* ============================== tela ============================== */
function scrFin() {
  const v = FIN_ABAS.some(a => a[0] === S.fv) ? S.fv : 'resumo';
  const comMes = ['resumo', 'analises', 'extrato', 'contas', 'orcamento'].includes(v) && !(v === 'extrato' && S.fExt === 'revisar'), atual = N_mes(hoje());
  return `<div class="between"><h1 class="display">Finanças</h1><button class="btn sm" data-a="novoLanc" data-tipo="saida">${ic('plus', 16, 2.4)} Lançar</button></div>
    <div class="chips scroll" role="tablist">${FIN_ABAS.map(([k, l]) => `<button class="chip ${v === k ? 'on' : ''}" role="tab" aria-selected="${v === k}" data-a="fv" data-v="${k}">${l}</button>`).join('')}</div>
    ${comMes ? `<div class="mesnav"><button class="x" data-a="mes" data-v="-1" aria-label="Mês anterior">${ic('chevl', 18)}</button><p class="h2" style="text-align:center;flex:1">${fmtMes(S.mes)}${S.mes !== atual ? ` <button class="link" data-a="mesHoje">voltar a ${MESES[+atual.slice(5) - 1]}</button>` : ''}</p><button class="x" data-a="mes" data-v="1" aria-label="Próximo mês">${ic('chev', 18)}</button></div>` : ''}
    ${{ resumo: finResumo, analises: finAnalises, extrato: finExtrato, contas: finContas, cartoes: finCartoes, orcamento: finOrcamento, metas: finMetas, patrimonio: finPatrimonio, investimentos: finInvestimentos }[v]()}`;
}

/* ---------- Resumo ---------- */
function passosIniciais() {
  return [
    ['Contas do banco com o saldo de hoje', contasBancarias().length > 0, 'pat', 'conta'],
    ['Cartões de crédito', cartoes().length > 0, 'cartao'],
    ['Salário e contas fixas', recorrentes().length > 0, 'conta'],
    ['Orçamento por categoria', categorias('saida').some(c => c.orc), 'orcamento'],
    ['A primeira meta da família', lista('metas').length > 0, 'meta']
  ];
}
function finResumo() {
  const ref = S.mes, atual = N_mes(hoje()), r = resumoMes(ref), prev = ref >= atual ? previsaoMes(ref) : null;
  const passos = passosIniciais(), faltam = passos.filter(p => !p[1]).length;
  const alertas = ref === atual ? alertasFinanceiros() : [];
  const meses = []; for (let i = 5; i >= 0; i--) meses.push(N_somaMes(ref, -i));
  const rs = meses.map(resumoMes), div = divisaoRenda(ref), met = metodo();
  const top = Object.entries(r.porCat).sort((a, b) => b[1] - a[1]).slice(0, 5), maxCat = top.length ? top[0][1] : 1;
  const ms = metas().slice(0, 3), pl = patrimonioEm(hoje()), plAnt = patrimonioEm(N_diaDoMes(N_somaMes(atual, -1), 31));
  const temPat = investimentos().length > 0, temAnt = inicioPatrimonio() && inicioPatrimonio() < atual + '-01';
  return `${COL_INI}<div class="panel hero"><p class="eb" style="color:inherit;opacity:.8">Saldo do mês</p><p class="saldo">${reais(r.saldo)}</p>
      <div class="grid3"><div class="stat"><span class="tiny muted">Receitas</span><b>${compacto(r.rec)}</b></div><div class="stat"><span class="tiny muted">Despesas</span><b>${compacto(r.desp)}</b></div><div class="stat"><span class="tiny muted">Investido</span><b>${compacto(r.inv)}</b></div></div>
      ${r.poupanca != null ? `<p class="small muted">${r.poupanca >= 0 ? `Sobrou ${pctTxt(r.poupanca)} da renda` : `Gastaram ${pctTxt(-r.poupanca)} a mais do que ganharam`}${r.inv > 0 ? ` · ${pctTxt(r.inv / r.rec)} foi investido` : ''}.</p>` : ''}
      ${prev && (prev.aPagar || prev.aReceber) ? `<p class="small muted">Até o fim do mês: faltam pagar <b>${reais(prev.aPagar)}</b>${prev.aReceber ? ` e receber <b>${reais(prev.aReceber)}</b>` : ''}. Saldo previsto: <b>${reais(prev.saldo)}</b>.</p>` : ''}</div>
    <div class="grid3"><button class="btn warm sm" data-a="novoLanc" data-tipo="saida">${ic('down', 15, 2.4)} Despesa</button><button class="btn sm" data-a="novoLanc" data-tipo="entrada">${ic('up', 15, 2.4)} Receita</button><button class="btn ghost sm" data-a="novoLanc" data-tipo="aporte">📈 Investir</button></div>
    ${faltam ? `<div class="panel soft"><div class="between"><p class="h3">Comece por aqui</p><span class="tiny muted">${passos.length - faltam} de ${passos.length}</span></div>
      <div class="stack" style="gap:2px">${passos.map(([t, ok, k, cl]) => `<button class="passo ${ok ? 'ok' : ''}" ${ok ? 'disabled' : `data-a="sheet" data-k="${k}"${cl ? ` data-v="${cl}"` : ''}`}><span class="ck sm ${ok ? 'on' : ''}">${ic('check', 14, 2.6)}</span><span>${t}</span>${ok ? '' : ic('chev', 16)}</button>`).join('')}</div></div>` : ''}
    ${(n => n ? `<div class="note"><span>${ic('flag', 16)}</span><span style="flex:1">${n} ${plu(n, 'despesa está', 'despesas estão')} sem categoria certa: o orçamento e as análises ficam mais fiéis depois de revisar.</span><button class="link" data-a="irRevisar">Revisar</button></div>` : '')(ref === atual ? lancs().filter(aRevisar).length : 0)}
    ${alertas.length ? `<div class="stack">${alertas.slice(0, 6).map(a => `<div class="note ${a.nivel === 'bad' ? 'bad' : a.nivel === 'warn' ? 'warn' : ''}"><span>${ic(a.nivel === 'info' ? 'flag' : 'alert', 16)}</span><span style="flex:1">${esc(a.txt)}</span>${a.acao ? `<button class="link" data-a="pagar" data-k="${a.acao.k}" data-id="${a.acao.id}" data-ref="${a.acao.ref || ''}">Pagar</button>` : a.meta ? `<button class="link" data-a="sheet" data-k="meta" data-id="${a.meta}">Ver</button>` : ''}</div>`).join('')}</div>` : ''}
    ${secao('Últimos 6 meses', `<button class="link" data-a="fv" data-v="analises">Análises</button>`)}<div class="panel">${grafColunas(meses, [{ nome: 'Receitas', cor: VIZ.rec, vals: rs.map(x => x.rec) }, { nome: 'Despesas', cor: VIZ.desp, vals: rs.map(x => x.desp) }, { nome: 'Investido', cor: VIZ.inv, vals: rs.map(x => x.inv) }], 'Receitas, despesas e investimentos dos últimos 6 meses')}</div>
    ${COL_MEIO}${secao('Para onde foi a renda', `<button class="link" data-a="fv" data-v="orcamento">Orçamento</button>`)}
    <div class="panel">${div.base ? grafPilha([{ nome: 'Essenciais', cor: VIZ.rec, v: div.essencial, pct: div.pct.essencial, meta: met.essencial }, { nome: 'Estilo de vida', cor: VIZ.desp, v: div.livre, pct: div.pct.livre, meta: met.livre }, { nome: 'Futuro (investimentos)', cor: VIZ.inv, v: div.futuro, pct: div.pct.futuro, meta: met.futuro }], div.base)
      + `<p class="tiny muted">Método ${met.essencial}/${met.livre}/${met.futuro}: até ${met.essencial}% da renda no essencial, ${met.livre}% no estilo de vida e pelo menos ${met.futuro}% para o futuro.</p>` : '<p class="small muted">Lance as receitas do mês para ver como a renda foi dividida.</p>'}</div>
    ${top.length ? secao('Maiores gastos', `<button class="link" data-a="fv" data-v="extrato">Extrato</button>`) + `<div class="panel">${top.map(([id, g]) => { const c = categoria(id); return `<button class="orc" data-a="fcat" data-v="${esc(id)}"><div class="between"><span><b>${esc(c.ic)} ${esc(c.nome)}</b></span><span class="num">${reais(g)}${r.desp ? ` <span class="tiny muted">${Math.round(g / r.desp * 100)}%</span>` : ''}</span></div>${bar(g, maxCat, 'var(--viz-2)')}</button>`; }).join('')}</div>` : ''}
    ${ms.length ? secao('Metas', `<button class="link" data-a="fv" data-v="metas">Ver todas</button>`) + `<div class="lst">${ms.map(linhaMeta).join('')}</div>` : ''}
    ${temPat ? secao('Patrimônio', `<button class="link" data-a="fv" data-v="patrimonio">Detalhes</button>`) + `<button class="panel" data-a="fv" data-v="patrimonio" style="border:0;text-align:left;cursor:pointer;color:inherit;font:inherit"><p class="saldo" style="font-size:28px">${reais(pl.liquido)}</p>${temAnt ? `<p class="small muted">${pl.liquido - plAnt.liquido >= 0 ? '▲' : '▼'} ${reais(Math.abs(pl.liquido - plAnt.liquido))} desde o fim do mês passado</p>` : '<p class="small muted">Soma dos investimentos.</p>'}</button>` : ''}${COL_FIM}`;
}

/* ---------- Extrato ---------- */
const FILTROS_EXT = [['tudo', 'Tudo'], ['saida', 'Despesas'], ['entrada', 'Receitas'], ['cartao', 'Cartão'], ['invest', 'Investimentos'], ['pendente', 'A pagar'], ['revisar', 'Revisar']];
function iconeLanc(l) { return l.tipo === 'fatura' ? '💳' : l.tipo === 'aporte' || l.tipo === 'resgate' ? '📈' : l.tipo === 'transf' ? '🔁' : categoria(l.cat).ic; }
function tituloLanc(l) {
  if (l.desc) return l.desc;
  if (l.tipo === 'aporte') return 'Aporte em ' + (nomePat(l.destino) || 'investimento');
  if (l.tipo === 'resgate') return 'Resgate de ' + (nomePat(l.destino) || 'investimento');
  if (l.tipo === 'transf') return 'Transferência';
  if (l.tipo === 'fatura') return 'Pagamento de fatura';
  return categoria(l.cat).nome;
}
function linhaLanc(l) {
  const ent = l.tipo === 'entrada', k = l.cartao && S.d.cartoes.get(l.cartao), partes = [];
  if (l.tipo === 'saida' || l.tipo === 'entrada') { if (l.desc) partes.push(categoria(l.cat).nome); }
  if (l.forma === 'cartao' && k) partes.push(k.nome); else if (l.forma) partes.push(formaNome(l.forma));
  if (l.parc) partes.push(l.parc);
  if (l.tipo === 'aporte' || l.tipo === 'resgate' || l.tipo === 'transf') partes.push((l.tipo === 'resgate' ? 'para ' : 'de ') + (nomePat(l.carteira) || 'conta'));
  if (l.tipo === 'transf') partes.push('para ' + (nomePat(l.destino) || 'conta'));
  const valor = l.tipo === 'entrada' || l.tipo === 'resgate' ? `<span class="v c-good">+ ${reais(l.v)}</span>` : l.tipo === 'saida' ? `<span class="v">− ${reais(l.v)}</span>` : `<span class="v muted">${reais(l.v)}</span>`;
  const pend = (l.tipo === 'saida' || ent) && !l.pago && l.forma !== 'cartao';
  return `<button class="it${l.pend ? ' pend' : ''}" data-a="sheet" data-k="lanc" data-id="${l.id}"><span class="em-tile">${esc(iconeLanc(l))}</span>
    <span class="main"><span class="t">${esc(tituloLanc(l))}</span><span class="s"><span>${av(l.por, 15)} ${partes.map(esc).join(' · ')}</span>${pend ? `<span class="tag warn">${ent ? 'a receber' : 'a pagar'}</span>` : ''}</span></span>${valor}</button>`;
}
/* Fila Revisar: despesas sem categoria, agrupadas por loja. Um toque aplica a categoria a todas e ensina as próximas importações. */
function finRevisar() {
  const fila = filaRevisar(), dups = possiveisDuplicados(), cats = categorias('saida'), n = fila.reduce((a, g) => a + g.ls.length, 0);
  const grupoRev = g => {
    const sug = g.sug && categoria(g.sug), aberto = S.revAberto === g.k, meses = [...new Set(g.ls.map(l => mesCurto(N_mes(l.dia))))].slice(0, 4).join(', ');
    return `<div class="panel rev"><div class="between" style="align-items:flex-start;gap:10px"><span class="stack" style="gap:2px;min-width:0"><b class="t">${esc(g.nome)}</b><span class="tiny muted">${g.ls.length} ${plu(g.ls.length, 'lançamento')} · ${esc(meses)}${aConfirmar(g.ls[0]) ? ' · estava "a confirmar"' : ''}</span></span>
      <span class="v">${reais(g.v)}</span></div>
      ${aberto ? '' : `<div class="hrow" style="gap:8px;flex-wrap:wrap">${sug ? `<button class="btn sm" data-a="revOk" data-v="${esc(g.k)}" data-cat="${esc(g.sug)}">${ic('check', 14, 2.6)} ${esc(sug.ic)} ${esc(sug.nome)}</button>` : ''}<button class="btn ghost sm" data-a="revVer" data-v="${esc(g.k)}">${sug ? 'Outra' : 'Escolher categoria'}</button></div>`}
      ${aberto ? `<div class="chips">${cats.filter(c => c.id !== 'outros').map(c => `<button class="chip sm" data-a="revOk" data-v="${esc(g.k)}" data-cat="${esc(c.id)}">${esc(c.ic)} ${esc(c.nome)}</button>`).join('')}<button class="chip sm" data-a="revOk" data-v="${esc(g.k)}" data-cat="outros">📦 É outros mesmo</button><button class="chip sm" data-a="revVer" data-v="${esc(g.k)}">Fechar</button></div>` : ''}</div>`;
  };
  return `<p class="small muted">${n ? `${n} ${plu(n, 'despesa')} sem categoria certa, de ${fila.length} ${plu(fila.length, 'loja')}. A categoria escolhida vale para todas da loja e para as próximas faturas importadas.` : 'Tudo categorizado. 🎉'}</p>
    ${fila.map(grupoRev).join('')}
    ${dups.length ? secao('Possíveis repetidos', `<span class="tiny muted">${dups.length}</span>`) + `<p class="tiny muted">Mesmo dia, valor e loja. Pode ser uma fatura importada duas vezes, ou duas compras iguais de verdade.</p>` + dups.slice(0, 20).map(d => `<div class="panel rev"><div class="lst">${d.ls.map(linhaLanc).join('')}</div>
      <div class="grid2"><button class="btn ghost sm" data-a="dupOk" data-v="${esc(d.k)}">Não é repetido</button><button class="btn danger sm" data-a="dupTirar" data-id="${d.ls[d.ls.length - 1].id}">${ic('trash', 14)} Excluir um</button></div></div>`).join('') : ''}`;
}
const rotuloExt = (k, l) => k === 'revisar' ? (n => n ? `${l} <span class="tag warn" style="margin-left:2px">${n}</span>` : l)(lancs().filter(aRevisar).length) : l;
function finExtrato() {
  const f = S.fExt, q = S.busca.trim().toLowerCase();
  if (f === 'revisar') return `<div class="chips scroll">${FILTROS_EXT.map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-a="fext" data-v="${k}">${rotuloExt(k, l)}</button>`).join('')}</div>${finRevisar()}`;
  const todos = !!(S.buscaTodos && q);
  let ls = lancs().filter(l => todos || mesCaixa(l) === S.mes);
  if (f === 'saida' || f === 'entrada') ls = ls.filter(l => l.tipo === f);
  if (f === 'cartao') ls = ls.filter(l => l.forma === 'cartao' || l.tipo === 'fatura');
  if (f === 'invest') ls = ls.filter(l => ['aporte', 'resgate', 'transf'].includes(l.tipo));
  if (f === 'pendente') ls = ls.filter(l => !l.pago && l.forma !== 'cartao' && (l.tipo === 'saida' || l.tipo === 'entrada'));
  if (S.fCat) ls = ls.filter(l => l.cat === S.fCat);
  if (q) ls = ls.filter(l => (tituloLanc(l) + ' ' + categoria(l.cat).nome + ' ' + (l.nota || '') + ' ' + (l.proj || '') + ' ' + (l.reemb || '')).toLowerCase().includes(q));
  ls.sort((a, b) => b.dia.localeCompare(a.dia) || String(b.em).localeCompare(String(a.em)));
  const sai = ls.filter(l => l.tipo === 'saida').reduce((a, l) => a + l.v, 0), ent = ls.filter(l => l.tipo === 'entrada').reduce((a, l) => a + l.v, 0);
  const dias = [...new Set(ls.map(l => l.dia))];
  return `<div class="chips scroll">${FILTROS_EXT.map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-a="fext" data-v="${k}">${rotuloExt(k, l)}</button>`).join('')}</div>
    <input class="in" id="busca" data-i="busca" value="${esc(S.busca)}" placeholder="Buscar (ex.: farmácia, Netflix)" autocomplete="off" enterkeyhint="search">
    ${q ? `<button class="chip sm ${todos ? 'on' : ''}" data-a="buscaTodos" style="align-self:flex-start">${todos ? ic('check', 12, 2.6) + ' ' : ''}Buscar em todos os meses</button>` : ''}
    ${S.fCat ? `<button class="chip on" data-a="fcat" data-v="${esc(S.fCat)}" style="align-self:flex-start">${esc(categoria(S.fCat).ic)} ${esc(categoria(S.fCat).nome)} ${ic('x', 12, 2.6)}</button>` : ''}
    <div id="extlista" class="stack" style="gap:10px">${extratoLista(ls, dias, sai, ent)}</div>`;
}
function extratoLista(ls, dias, sai, ent) {
  const doCartao = ls.some(l => l.tipo === 'saida' && l.forma === 'cartao' && N_mes(l.dia) !== S.mes);
  return `<p class="small muted">${ls.length} ${plu(ls.length, 'lançamento')}${sai ? ` · saídas ${reais(sai)}` : ''}${ent ? ` · entradas ${reais(ent)}` : ''}</p>
    ${doCartao ? '<p class="tiny muted">Regime de caixa: as compras no cartão aparecem no mês em que a fatura vence, com a data da compra.</p>' : ''}
    ${dias.length ? dias.map(d => `<p class="dia-h">${rotuloDia(d) === fmtCurta(d) ? fmtData(d) : rotuloDia(d) + ' · ' + fmtCurta(d)}</p><div class="lst">${ls.filter(l => l.dia === d).map(linhaLanc).join('')}</div>`).join('') : `<div class="panel">${vazio('💸', 'Nenhum lançamento aqui.')}</div>`}`;
}

/* ---------- Contas (a pagar e a receber) ---------- */
const anexosAgenda = x => x.k === 'rec' ? anexosDe(`contas:${x.id}:${x.ref}`).length : x.k === 'lanc' ? anexosDe('lancamentos:' + x.id).length + (x.conta && x.ref ? anexosDe(`contas:${x.conta}:${x.ref}`).length : 0) : 0;
/* Dá para desmarcar o que saiu (ou entrou) de uma conta: não as compras no cartão nem os aportes */
function podeDespagar(x) {
  if (x.k === 'fatura') return x.fatura && x.fatura.pagamentos.length > 0;
  if (x.k === 'lanc') return true;
  const r = recorrentesMes(x.ref).find(c => c.id === x.id);
  return !!(r && r.lanc && r.lanc.pago && r.lanc.forma !== 'cartao' && ['saida', 'entrada'].includes(r.lanc.tipo));
}
function linhaAgenda(x) {
  const n = N_diasEntre(hoje(), x.venc), quando = x.status === 'pago' ? statusTag('pago') : x.status === 'vencido' ? (x.entrada ? `<span class="tag warn">esperado dia ${N_dataObj(x.venc).getDate()}</span>` : `<span class="tag bad">venceu ${rotuloDia(x.venc)}</span>`) : n === 0 ? '<span class="tag warn">vence hoje</span>' : `<span class="tag">${x.entrada ? 'dia' : 'vence'} ${n > 0 && n < 7 ? rotuloDia(x.venc) : fmtCurta(x.venc)}</span>`;
  const rot = x.k === 'fatura' ? (x.status === 'pago' ? 'Ver' : 'Pagar') : x.entrada ? 'Receber' : x.aporte ? 'Investir' : x.cartao ? 'Lançar' : 'Pagar';
  const abrir = x.k === 'fatura' ? `data-a="sheet" data-k="fatura" data-id="${x.id}" data-v="${x.ref}"` : x.k === 'rec' ? `data-a="sheet" data-k="conta" data-id="${x.id}" data-v="${x.ref || ''}"` : `data-a="sheet" data-k="lanc" data-id="${x.id}"`;
  return `<div class="it"><span class="em-tile">${esc(x.ic)}</span><button class="main" ${abrir}><span class="t">${esc(x.nome)}</span><span class="s">${quando}${x.cartao ? '<span>no cartão</span>' : ''}${anexosAgenda(x) ? `<span>📎 ${anexosAgenda(x)}</span>` : ''}</span></button>
    ${x.status === 'pago' ? `<span class="stack" style="gap:4px;align-items:flex-end"><span class="v ${x.entrada ? 'c-good' : ''}">${reais(x.v)}</span>${podeDespagar(x) ? `<button class="btn ghost sm" style="padding:6px 10px" data-a="despagar" data-k="${x.k}" data-id="${x.id}" data-ref="${x.ref || ''}">Não foi ${x.entrada ? 'recebido' : 'pago'}</button>` : ''}</span>` : `<span class="stack" style="gap:4px;align-items:flex-end"><span class="v ${x.entrada ? 'c-good' : ''}">${reais(x.resta != null ? x.resta : x.v)}</span><button class="btn sm ${x.entrada ? '' : 'warm'}" style="padding:7px 12px" data-a="pagar" data-k="${x.k}" data-id="${x.id}" data-ref="${x.ref || ''}">${rot}</button></span>`}</div>`;
}
function finContas() {
  const ag = agendaMes(S.mes), pagar = ag.filter(x => !x.entrada && x.status !== 'pago'), receber = ag.filter(x => x.entrada && x.status !== 'pago'), ok = ag.filter(x => x.status === 'pago');
  const soma = l => l.reduce((a, x) => a + (x.resta != null ? x.resta : x.v), 0), venc = pagar.filter(x => x.status === 'vencido');
  const recs = recorrentes();
  return `${COL_INI}<div class="grid3"><div class="stat"><span class="tiny muted">A pagar</span><b>${compacto(soma(pagar))}</b></div><div class="stat"><span class="tiny muted">A receber</span><b>${compacto(soma(receber))}</b></div><div class="stat"><span class="tiny muted">Pago</span><b>${compacto(ok.filter(x => !x.entrada).reduce((a, x) => a + x.v, 0))}</b></div></div>
    ${venc.length ? secao('Vencidas', `<span class="tag bad">${venc.length}</span>`) + listaOu(venc, linhaAgenda) : ''}
    ${secao('A pagar', `<span class="tiny muted">${pagar.length - venc.length}</span>`)}${listaOu(pagar.filter(x => x.status !== 'vencido'), linhaAgenda, `<div class="panel">${vazio('🎉', ag.length ? 'Nada mais a pagar neste mês.' : 'Cadastre as contas fixas para elas aparecerem aqui todo mês.')}</div>`)}
    ${receber.length ? secao('A receber') + listaOu(receber, linhaAgenda) : ''}
    ${ok.length ? `<details><summary>${secao('Pagas e recebidas', `<span class="tiny muted">${ok.length}</span>`)}</summary>${listaOu(ok, linhaAgenda)}</details>` : ''}
    ${COL_MEIO}${secao('Contas fixas e receitas', `<button class="link" data-a="sheet" data-k="conta">+ Nova</button>`)}
    ${listaOu(recs, c => `<button class="it${c.ativa === false ? ' feito' : ''}" data-a="sheet" data-k="conta" data-id="${c.id}"><span class="em-tile">${esc(c.tipo === 'aporte' ? '📈' : categoria(c.cat).ic)}</span><span class="main"><span class="t">${esc(c.nome)}</span><span class="s">${c.tipo === 'entrada' ? 'recebe' : c.tipo === 'aporte' ? 'investe' : 'vence'} todo dia ${c.vence || 1}${c.forma ? ' · ' + esc(c.forma === 'cartao' && S.d.cartoes.get(c.cartao) ? S.d.cartoes.get(c.cartao).nome : formaNome(c.forma)) : ''}${c.fim ? ' · até ' + fmtMesCurto(c.fim + '-01') : ''}${contaAuto(c) ? ' · automático' : ''}${c.ativa === false ? ' · pausada' : ''}</span></span><span class="v ${c.tipo === 'entrada' ? 'c-good' : ''}">${reais(c.v)}</span></button>`,
      `<div class="panel">${vazio('🧾', 'Salário, aluguel, luz, internet, escola, assinaturas… Cadastre uma vez e o app lembra todo mês.')}<button class="btn block" data-a="sheet" data-k="conta">Cadastrar conta fixa</button></div>`)}${COL_FIM}`;
}

/* ---------- Cartões ---------- */
const STATUS_FATURA = { aberta: ['', 'aberta'], fechada: ['warn', 'fechada'], paga: ['good', 'paga'], vencida: ['bad', 'vencida'] };
/* Mês de vencimento mais comum entre as faturas "da vez" dos cartões */
function refFaturaDaVez() {
  const c = {}; cartoes().forEach(k => { const r = faturaDaVez(k).ref; c[r] = (c[r] || 0) + 1; });
  return Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || N_mes(hoje());
}
function finCartoes() {
  const ks = cartoes(), atual = N_mes(hoje());
  if (!ks.length) return `<div class="panel">${vazio('💳', 'Cadastre os cartões de crédito com o dia de fechamento e de vencimento. O app monta as faturas sozinho, inclusive das compras parceladas.')}<button class="btn block" data-a="sheet" data-k="cartao">Cadastrar cartão</button></div>`;
  // Mês das faturas (pelo vencimento). Sem escolha: o da fatura "da vez" (a fechada ainda não paga ou a aberta)
  const daVez = refFaturaDaVez(), ref = S.fatMes || daVez, doMes = faturasDoMes(ref);
  // Evolução: total das faturas de todos os cartões, 8 meses antes da fatura da vez até 3 depois (parcelas já lançadas)
  const meses = []; for (let i = -8; i <= 3; i++) meses.push(N_somaMes(daVez, i));
  if (!meses.includes(ref)) { const d = ref < meses[0] ? -1 : 1; while (!meses.includes(ref)) { if (d < 0) { meses.unshift(N_somaMes(meses[0], -1)); meses.pop(); } else { meses.push(N_somaMes(meses[meses.length - 1], 1)); meses.shift(); } } }
  const PAL = ['var(--viz-1)', 'var(--viz-2)', 'var(--viz-3)', 'var(--cor-c)', 'var(--cor-e)', 'var(--cor-g)'];
  const series = ks.map((k, i) => ({ nome: k.nome, cor: PAL[i % PAL.length], vals: meses.map(m => fatura(k, m).total) }));
  const passados = meses.filter(m => m <= daVez).map(m => series.reduce((a, s) => a + s.vals[meses.indexOf(m)], 0)).filter(v => v > 0).slice(-6);
  const media = passados.length ? Math.round(passados.reduce((a, v) => a + v, 0) / passados.length) : 0;
  const grafico = `<div class="panel graf-fat"><div class="between"><p class="eb">Faturas mês a mês · todos os cartões</p>${media ? `<span class="tiny muted">média ${compacto(media)}</span>` : ''}</div>
    ${grafEmpilhado(meses, series, { sel: ref, depoisDe: daVez, acao: 'fatMesIr', rotulo: 'Total das faturas por mês. Toque numa coluna para abrir o mês; os meses mais claros são parcelas que ainda vão vencer.', alt: 112 })}</div>`;
  return `<div class="cart-topo"><div class="stack" style="gap:10px"><div class="mesnav"><button class="x" data-a="fatMes" data-v="-1" aria-label="Faturas do mês anterior">${ic('chevl', 18)}</button>
      <p class="h2" style="text-align:center;flex:1">Faturas de ${fmtMes(ref).toLowerCase()}${ref !== daVez ? ` <button class="link" data-a="fatMesHoje">voltar à atual</button>` : ''}</p>
      <button class="x" data-a="fatMes" data-v="1" aria-label="Faturas do próximo mês">${ic('chev', 18)}</button></div>
    <p class="small muted">Total das faturas que vencem em ${MESES[+ref.slice(5) - 1]}${ref.slice(0, 4) !== atual.slice(0, 4) ? ' de ' + ref.slice(0, 4) : ''}: <b>${reais(doMes)}</b></p>
    <p class="tiny muted">Toque numa coluna do gráfico para abrir as faturas daquele mês. Os meses mais claros são parcelas que ainda vão vencer.</p></div>${grafico}</div>
    <div class="grade-cards">${ks.map(k => {
      const f = fatura(k, ref), usado = limiteUsado(k), st = STATUS_FATURA[f.status] || STATUS_FATURA.aberta, fut = parcelasFuturas(k, 3);
      return `<div class="panel cartao" style="--cc:${esc(k.cor || CORES_CARTAO[0])}">
        <button class="between" data-a="sheet" data-k="cartao" data-id="${k.id}" style="border:0;background:none;padding:0;color:inherit;font:inherit;cursor:pointer;text-align:left"><span class="hrow"><span class="cc-chip"></span><b>${esc(k.nome)}</b></span><span class="muted">${ic('edit', 16)}</span></button>
        <button class="fatbox" data-a="sheet" data-k="fatura" data-id="${k.id}" data-v="${f.ref}"><span class="between"><span class="small muted">Fatura de ${MESES[+f.ref.slice(5) - 1]}</span><span class="tag ${st[0]}">${st[1]}</span></span>
          <span class="saldo" style="font-size:28px">${reais(f.total)}</span>
          <span class="small muted">fecha ${fmtCurta(f.fecha)} · vence ${fmtCurta(f.venc)}${f.pago ? ` · pago ${reais(f.pago)}` : ''}</span></button>
        ${k.limite ? `<div class="stack" style="gap:6px">${bar(usado, k.limite, usado > k.limite * .9 ? 'var(--bad)' : usado > k.limite * .7 ? 'var(--warn)' : 'var(--accent)')}<span class="between tiny"><span class="muted">Limite usado ${reais(usado)}</span><span>Disponível <b>${reais(Math.max(0, k.limite - usado))}</b></span></span></div>` : ''}
        ${fut.some(x => x.total) ? `<p class="tiny muted">Já comprometido: ${fut.filter(x => x.total).map(x => `${mesCurto(x.ref)} ${reais(x.total)}`).join(' · ')}</p>` : ''}
        <div class="grid2"><button class="btn ghost sm" data-a="sheet" data-k="fatura" data-id="${k.id}" data-v="${f.ref}">Ver compras</button>${f.resta ? `<button class="btn sm warm" data-a="pagar" data-k="fatura" data-id="${k.id}" data-ref="${f.ref}">Pagar ${reais(f.resta)}</button>` : `<button class="btn ghost sm" data-a="novoLanc" data-tipo="saida" data-cartao="${k.id}">+ Compra</button>`}</div>
        <button class="btn ghost sm block" data-a="importarFatura" data-id="${k.id}">${ic('up', 15, 2.2)} Importar fatura (planilha do banco)</button>
        <p class="tiny muted">Melhor dia de compra: dia ${k.fecha}. Compras a partir dele só entram na fatura seguinte.</p></div>`;
    }).join('')}</div>
    <button class="btn ghost block" data-a="sheet" data-k="cartao">${ic('plus', 16, 2.4)} Novo cartão</button>`;
}

/* ---------- Orçamento ---------- */
function finOrcamento() {
  const ref = S.mes, r = resumoMes(ref), div = divisaoRenda(ref), met = metodo();
  const cats = categorias('saida'), com = cats.filter(c => c.orc), sem = cats.filter(c => !c.orc && r.porCat[c.id]);
  const totOrc = com.reduce((a, c) => a + c.orc, 0), totG = com.reduce((a, c) => a + (r.porCat[c.id] || 0), 0);
  const linha = c => {
    const g = r.porCat[c.id] || 0, med = mediaCategoria(ref, c.id), p = c.orc ? g / c.orc : 0;
    const cor = !c.orc ? 'var(--viz-2)' : p > 1 ? 'var(--bad)' : p > .85 ? 'var(--warn)' : 'var(--accent)';
    return `<button class="orc" data-a="fcat" data-v="${esc(c.id)}"><div class="between"><span><b>${esc(c.ic)} ${esc(c.nome)}</b></span><span class="num">${reais(g)}${c.orc ? ` <span class="tiny muted">de ${reais(c.orc)}</span>` : ''}</span></div>
      ${c.orc ? bar(g, c.orc, cor) : ''}<span class="between tiny muted"><span>${c.orc ? (p > 1 ? `${ic('alert', 12, 2.4)} passou ${reais(g - c.orc)}` : `restam ${reais(c.orc - g)}`) : 'sem orçamento'}</span><span>média 3 meses ${reais(med)}</span></span></button>`;
  };
  return `${COL_INI}<div class="panel">${div.base ? grafPilha([{ nome: 'Essenciais', cor: VIZ.rec, v: div.essencial, pct: div.pct.essencial, meta: met.essencial }, { nome: 'Estilo de vida', cor: VIZ.desp, v: div.livre, pct: div.pct.livre, meta: met.livre }, { nome: 'Futuro (investimentos)', cor: VIZ.inv, v: div.futuro, pct: div.pct.futuro, meta: met.futuro }], div.base) : '<p class="small muted">Sem receitas lançadas neste mês.</p>'}
      <p class="tiny muted">Renda do mês: ${reais(r.rec)}. Método ${met.essencial}/${met.livre}/${met.futuro} (essenciais / estilo de vida / futuro).</p></div>
    ${com.length ? `<div class="panel soft" style="padding:12px 14px"><div class="between"><span class="small">Gasto nas categorias com orçamento</span><b class="num">${reais(totG)} <span class="tiny muted">de ${reais(totOrc)}</span></b></div>${bar(totG, totOrc, totG > totOrc ? 'var(--bad)' : 'var(--accent)')}</div>` : ''}
    ${COL_MEIO}${secao('Por categoria', `<button class="link" data-a="sheet" data-k="orcamento">Editar</button>`)}
    <div class="panel">${com.length ? com.map(linha).join('') : `<div class="note"><span>Definam quanto querem gastar por mês em cada categoria. Dica: comecem pela média dos últimos 3 meses e cortem um pouco onde dá.</span></div><button class="btn block" data-a="sheet" data-k="orcamento">Definir orçamento</button>`}</div>
    ${sem.length ? secao('Gastos sem orçamento') + `<div class="panel">${sem.map(linha).join('')}</div>` : ''}${COL_FIM}`;
}

/* ---------- Metas ---------- */
const STATUS_META = { concluida: ['good', 'cumprida'], ok: ['', 'no caminho'], atencao: ['warn', 'atenção'] };
function linhaMeta(m) {
  const p = progressoMeta(m), st = STATUS_META[p.status];
  const val = `${compacto(p.atual)} <span class="tiny muted">${m.metrica === 'divida' ? 'devendo' : 'de ' + compacto(p.alvo)}</span>`;
  return `<button class="it" data-a="sheet" data-k="meta" data-id="${m.id}" style="grid-template-columns:auto minmax(0,1fr)"><span class="em-tile">${esc(m.ic || '🎯')}</span>
    <span class="main" style="gap:6px"><span class="between"><span class="t">${esc(m.nome)}</span><span class="tag ${st[0]}">${st[1]}</span></span>
    ${bar(p.pct, 1, p.cor || (p.status === 'atencao' ? 'var(--warn)' : 'var(--accent)'))}
    <span class="between small" style="align-items:flex-start"><span class="muted">${esc(p.linha)}</span><span class="num" style="white-space:nowrap;text-align:right">${val}</span></span></span></button>`;
}
function finMetas() {
  const ms = metas(), arq = lista('metas').filter(m => m.ativa === false);
  return `${COL_INI}${ms.length ? listaOu(ms, linhaMeta) : `<div class="panel soft"><p class="h3">Objetivos da família</p><p class="small muted">Metas claras e com prazo funcionam melhor. Escolha um modelo para começar:</p></div>`}
    ${COL_MEIO}${secao(ms.length ? 'Nova meta' : 'Modelos')}
    <div class="presets">${PRESETS_META.map(p => `<button class="preset" data-a="presetMeta" data-v="${p.k}"><span class="em">${p.ic}</span><b>${esc(p.t)}</b><span class="tiny muted">${esc(p.d)}</span></button>`).join('')}</div>
    ${arq.length ? `<details><summary>${secao('Arquivadas', `<span class="tiny muted">${arq.length}</span>`)}</summary>${listaOu(arq, linhaMeta)}</details>` : ''}${COL_FIM}`;
}

/* ---------- Patrimônio ---------- */
function linhaPat(p) {
  const v = valorAtual(p), u = ultimaAtualizacao(p), dias = u ? N_diasEntre(u, hoje()) : null;
  return `<button class="it" data-a="sheet" data-k="pat" data-id="${p.id}"><span class="em-tile">${esc(p.ic || classe(p.classe).ic)}</span>
    <span class="main"><span class="t">${esc(p.nome)}</span><span class="s">${esc([classe(p.classe).n, p.inst].filter(Boolean).join(' · '))}${dias != null && dias > 35 && p.classe !== 'conta' ? '<span class="tag warn">atualizar</span>' : ''}</span></span>
    <span class="v ${ehPassivo(p) ? 'c-bad' : ''}">${ehPassivo(p) ? '− ' : ''}${reais(v)}</span></button>`;
}
function finPatrimonio() {
  const h = hoje(), pl = patrimonioEm(h), ant = patrimonioEm(N_diaDoMes(N_somaMes(N_mes(h), -1), 31)), itens = patrimonio().filter(p => p.ativo !== false);
  const inv = itens.filter(p => classe(p.classe).g === 'invest'), fora = itens.filter(p => classe(p.classe).g !== 'invest');
  if (!inv.length) return `<div class="panel">${vazio('🏛️', 'Patrimônio é a soma dos investimentos da família. Ele só muda com rendimentos, renda passiva, aportes e resgates: conta corrente e o saldo do mês ficam de fora.')}<button class="btn block" data-a="sheet" data-k="pat" data-v="rendafixa">+ Investimento</button></div>${foraDoPatrimonio(fora, h)}`;
  const porClasse = {};
  inv.forEach(p => { porClasse[p.classe] = (porClasse[p.classe] || 0) + valorAtual(p); });
  const totInv = Object.values(porClasse).reduce((a, v) => a + v, 0), aloc = Object.entries(porClasse).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
  const aplic = inv.reduce((a, p) => a + aplicadoEm(p, h), 0), rend = totInv - aplic;
  const delta = pl.liquido - ant.liquido, serie = seriePatrimonio(12), temAnt = serie.length > 1;
  return `${COL_INI}<div class="panel hero"><p class="eb" style="color:inherit;opacity:.8">Patrimônio</p><p class="saldo">${reais(pl.liquido)}</p>
      ${temAnt ? `<p class="small muted">${delta >= 0 ? '▲' : '▼'} ${reais(Math.abs(delta))} desde o fim do mês passado</p>` : '<p class="small muted">Soma dos investimentos. Muda com rendimentos, renda passiva, aportes e resgates.</p>'}
      <div class="grid2"><div class="stat"><span class="tiny muted">Aplicado</span><b>${compacto(aplic)}</b></div><div class="stat"><span class="tiny muted">Rendimento bruto</span><b>${rend >= 0 ? '' : '−'}${compacto(Math.abs(rend))}</b></div></div></div>
    ${secao('Evolução')}<div class="panel">${temAnt ? grafLinha(serie, 'Patrimônio mês a mês') : '<p class="small muted">O gráfico mês a mês aparece quando houver saldos de pelo menos dois meses.</p>'}<p class="tiny muted">Atualize o saldo de cada investimento uma vez por mês para a linha ficar fiel.</p></div>
    ${aloc.length ? secao('Onde está investido', `<button class="link" data-a="fv" data-v="investimentos">Análise</button>`) + `<div class="panel">${aloc.map(([cl, v]) => `<div class="stack" style="gap:6px"><div class="between small"><span><b>${classe(cl).ic} ${classe(cl).n}</b></span><span class="num">${reais(v)} <span class="tiny muted">${Math.round(v / totInv * 100)}%</span></span></div>${bar(v, totInv, 'var(--viz-1)')}</div>`).join('')}</div>` : ''}
    ${COL_MEIO}${secao('Investimentos', `<span class="num small">${reais(pl.invest)}</span>`)}${listaOu(inv, linhaPat)}
    <div class="grid2"><button class="btn ghost sm" data-a="sheet" data-k="pat" data-v="rendafixa">+ Investimento</button><button class="btn ghost sm" data-a="novoLanc" data-tipo="aporte">Aplicar / resgatar</button></div>
    ${foraDoPatrimonio(fora, h)}${COL_FIM}`;
}
/* Contas correntes (usadas nos lançamentos), bens e dívidas: cadastrados, mas fora da soma do patrimônio */
function foraDoPatrimonio(fora, h) {
  const grupos = GRUPOS_PAT.filter(([g]) => g !== 'invest').map(([g, nome]) => [nome, fora.filter(p => classe(p.classe).g === g)]).filter(x => x[1].length);
  return `<details class="fora"><summary>${secao('Fora do patrimônio', `<span class="tiny muted">${fora.length}</span>`)}</summary>
    <p class="tiny muted">Conta corrente, bens e dívidas ficam cadastrados (as contas aparecem nos lançamentos), mas não entram na soma do patrimônio.</p>
    ${grupos.map(([nome, l]) => `<p class="dia-h">${nome}</p>` + listaOu(l, linhaPat)).join('')}
    <div class="grid2"><button class="btn ghost sm" data-a="sheet" data-k="pat" data-v="conta">+ Conta</button><button class="btn ghost sm" data-a="sheet" data-k="pat" data-v="imovel">+ Bem</button><button class="btn ghost sm" data-a="sheet" data-k="pat" data-v="financiamento">+ Dívida</button><span></span></div></details>`;
}

/* ============================== painéis ============================== */
const toggle = (k, on, rot, sub) => `<div class="between"><span><b>${rot}</b>${sub ? `<br><span class="small muted">${sub}</span>` : ''}</span><button class="tog ${on ? 'on' : ''}" data-a="f" data-k="${k}" data-v="${on ? '' : '1'}" aria-pressed="${!!on}" aria-label="${esc(rot)}"></button></div>`;
const escolhaMulti = (k, atual, opcoes) => `<div class="chips">${opcoes.map(([v, l]) => `<button class="chip ${(atual || []).includes(v) ? 'on' : ''}" data-a="fl" data-k="${k}" data-v="${esc(v)}">${l}</button>`).join('')}</div>`;
const valorInp = (k, val, extra = '') => `<input class="in big" id="f-${k}" data-i="${k}" value="${esc(val || '')}" inputmode="decimal" placeholder="R$ 0,00" autocomplete="off" aria-label="Valor" ${extra}>`;

/* ---------- lançamento ---------- */
function formLanc(l, pre) {
  const conta1 = (contasBancarias()[0] || {}).id || '', cart1 = lsGet('ultimoCartao') && S.d.cartoes.get(lsGet('ultimoCartao')) ? lsGet('ultimoCartao') : (cartoes()[0] || {}).id || '';
  if (l) return { tipo: l.tipo, v: reaisInput(l.v), desc: l.desc || '', cat: l.cat || '', dia: l.dia, forma: l.forma || '', carteira: l.carteira || '', cartao: l.cartao || '', parcelas: 1,
    pago: l.pago !== false, destino: l.destino || '', meta: l.meta || '', conta: l.conta || '', ref: l.ref || '', nota: l.nota || '', proj: l.proj || '', reemb: l.reemb || '', reembOk: !!l.reembOk };
  pre = pre || {};
  const tipo = pre.tipo || 'saida', dia = pre.dia || hoje(), cats = categorias(tipo === 'entrada' ? 'entrada' : 'saida');
  const forma = pre.forma || (pre.cartao ? 'cartao' : lsGet('ultimaForma') || 'pix');
  return { tipo, v: pre.v ? reaisInput(pre.v) : '', desc: pre.desc || '', cat: pre.cat || (tipo === 'saida' || tipo === 'entrada' ? (cats[0] || {}).id || '' : ''), dia,
    forma: forma === 'cartao' && !cartoes().length ? 'pix' : forma, carteira: pre.carteira || conta1, cartao: pre.cartao || cart1, parcelas: 1, pago: pre.pago != null ? pre.pago : dia <= hoje(),
    destino: pre.destino || (tipo === 'aporte' || tipo === 'resgate' ? (investimentos()[0] || {}).id || '' : ''), meta: pre.meta || '', conta: pre.conta || '', ref: pre.ref || '', nota: pre.nota || '', compra: pre.compra || '', proj: pre.proj || '', reemb: '', reembOk: false };
}
SH.lanc = s => {
  const l = s.id && S.d.lancamentos.get(s.id);
  if (s.id && !l) return sumiu('Lançamento');
  if (!s.f) s.f = formLanc(l, s.pre);
  const f = s.f, t = f.tipo, inv = t === 'aporte' || t === 'resgate', fixo = !!f.conta || t === 'fatura';
  const titulo = { saida: 'Despesa', entrada: 'Receita', aporte: 'Investimento', resgate: 'Resgate', transf: 'Transferência', fatura: 'Pagamento de fatura' }[t];
  const k = f.cartao && S.d.cartoes.get(f.cartao), conta = f.conta && S.d.contas.get(f.conta), contas = opcConta(), passivos = dividas();
  const n = Math.max(1, parseInt(f.parcelas, 10) || 1), v = lerReais(f.v);
  let corpo = '';
  if (t === 'saida') {
    corpo += campo('Descrição', inp('desc', f.desc, 'maxlength="120" placeholder="Ex.: feira do sábado, farmácia" autocomplete="off"'));
    corpo += grupo('Categoria', escolha('cat', f.cat, categorias('saida').map(c => [c.id, `${esc(c.ic)} ${esc(c.nome)}`])));
    corpo += grupo('Como pagou', escolha('forma', f.forma, FORMAS.filter(x => x[0] !== 'cartao' || cartoes().length).map(([a, b]) => [a, b])));
    if (f.forma === 'cartao') {
      corpo += cartoes().length > 1 ? grupo('Cartão', escolha('cartao', f.cartao, cartoes().map(c => [c.id, esc(c.nome)]))) : '';
      if (!l) corpo += grupo('Parcelas', `<div class="chips">${[1, 2, 3, 4, 5, 6, 8, 10, 12, 18, 24].map(x => `<button class="chip ${n === x ? 'on' : ''}" data-a="f" data-k="parcelas" data-v="${x}">${x === 1 ? 'À vista' : x + 'x'}</button>`).join('')}</div>`)
        + (n > 1 && v ? `<p class="small muted">${n}x de ${reais(Math.floor(v / n))}. Cada parcela entra no orçamento do seu mês e na fatura certa.</p>` : '');
      if (k && N_dataValida(f.dia)) { const ref = l && l.fat && l.cartao === k.id ? l.fat : N_faturaRef(k, f.dia); corpo += `<p class="small muted">Entra na fatura de ${MESES[+ref.slice(5) - 1]} (vence ${fmtCurta(N_vencimento(k, ref))}).</p>`; }
      if (l && l.parc) corpo += `<div class="note"><span>Parcela ${esc(l.parc)}. Mudanças aqui valem só para esta parcela.</span></div>`;
    } else {
      if (contas.length > 1) corpo += grupo('Saiu de qual conta', escolha('carteira', f.carteira, contas));
    }
    if (CAT_VAGA(f.cat) || !f.cat) { const sug = sugerirCat(f.desc, l && l.id); if (sug && sug !== f.cat) corpo += `<button class="chip sm" data-a="f" data-k="cat" data-v="${esc(sug)}" style="align-self:flex-start">Sugestão: ${esc(categoria(sug).ic)} ${esc(categoria(sug).nome)}</button>`; }
    corpo += `<details ${f.proj || f.reemb ? 'open' : ''}><summary class="small muted">Viagem, projeto ou reembolso</summary><div class="stack" style="margin-top:8px">
      ${campo('Viagem ou projeto (opcional)', inp('proj', f.proj, 'maxlength="40" placeholder="Ex.: Bruxelas 2026, Reforma da sala" autocomplete="off" list="dl-proj"'))}<datalist id="dl-proj">${projetos().map(x => `<option value="${esc(x)}">`).join('')}</datalist>
      ${campo('Alguém vai devolver? (opcional)', inp('reemb', f.reemb, 'maxlength="40" placeholder="Nome de quem deve" autocomplete="off" list="dl-reemb"'))}<datalist id="dl-reemb">${nomesReembolso().map(x => `<option value="${esc(x)}">`).join('')}</datalist>
      ${String(f.reemb || '').trim() ? toggle('reembOk', f.reembOk, 'Já devolveu', 'Enquanto não devolver, aparece em Análises › A receber') : ''}</div></details>`;
    if (f.cat === 'dividas' && passivos.length) corpo += grupo('Abate de qual dívida (opcional)', escolha('destino', f.destino, [['', 'Nenhuma'], ...passivos.map(p => [p.id, esc(p.nome)])]));
  } else if (t === 'entrada') {
    corpo += campo('Descrição', inp('desc', f.desc, 'maxlength="120" placeholder="Ex.: salário de outubro" autocomplete="off"'));
    corpo += grupo('Categoria', escolha('cat', f.cat, categorias('entrada').map(c => [c.id, `${esc(c.ic)} ${esc(c.nome)}`])));
    const destinosEnt = f.cat === 'rendimentos' ? [...contas, ...investimentos().map(p => [p.id, `${esc(p.ic || classe(p.classe).ic)} ${esc(p.nome)}`])] : contas;
    if (destinosEnt.length > 1) corpo += grupo(f.cat === 'rendimentos' ? 'Entrou onde' : 'Entrou em qual conta', escolha('carteira', f.carteira, destinosEnt));
    if (f.cat === 'rendimentos') corpo += '<p class="tiny muted">Renda passiva (dividendos, juros, aluguel de FII): escolha o investimento se o dinheiro ficou nele. Aí ela soma no patrimônio como rendimento.</p>';
  } else if (inv) {
    corpo += segm('tipo', t, [['aporte', 'Aplicar'], ['resgate', 'Resgatar']]);
    const invs = investimentos();
    corpo += invs.length ? grupo('Investimento', escolha('destino', f.destino, invs.map(p => [p.id, `${esc(p.ic || classe(p.classe).ic)} ${esc(p.nome)}`])))
      : `<div class="note warn"><span>Cadastre o investimento primeiro em Patrimônio (ex.: Tesouro Selic, CDB, ações).</span><button class="link" data-a="sheet" data-k="pat" data-v="rendafixa">Cadastrar</button></div>`;
    if (contas.length) corpo += grupo(t === 'aporte' ? 'Saiu de qual conta' : 'Voltou para qual conta', escolha('carteira', f.carteira, contas));
    if (metas().length) corpo += grupo('Conta para qual meta (opcional)', escolha('meta', f.meta, [['', 'Nenhuma'], ...metas().map(m => [m.id, `${esc(m.ic || '🎯')} ${esc(m.nome)}`])]));
    corpo += campo('Descrição (opcional)', inp('desc', f.desc, 'maxlength="120" autocomplete="off"'));
  } else if (t === 'transf') {
    if (contas.length < 2) corpo += `<div class="note warn"><span>Para transferir, cadastre pelo menos duas contas em Patrimônio.</span></div>`;
    corpo += grupo('De', escolha('carteira', f.carteira, contas)) + grupo('Para', escolha('destino', f.destino, contas));
    corpo += campo('Descrição (opcional)', inp('desc', f.desc, 'maxlength="120" autocomplete="off"'));
  } else if (t === 'fatura') {
    corpo += k ? `<div class="note"><span>Fatura de ${fmtMes(f.ref).toLowerCase()} do <b>${esc(k.nome)}</b>. Pagar a fatura não conta como despesa de novo: as compras já foram contadas.</span></div>` : '';
    if (contas.length) corpo += grupo('Saiu de qual conta', escolha('carteira', f.carteira, contas));
  }
  return `${head(l ? 'Editar' : 'Novo', titulo)}
    ${!l && !fixo && !s.pre?.travado ? segm('tipo', inv ? 'aporte' : t, [['saida', 'Despesa'], ['entrada', 'Receita'], ['aporte', 'Investir'], ['transf', 'Transferir']]) : ''}
    ${valorInp('v', f.v)}
    ${(t === 'saida' && f.forma !== 'cartao') || t === 'entrada' || t === 'fatura' ? `<div class="panel soft pagobox">${toggle('pago', f.pago, t === 'entrada' ? 'Já recebeu' : t === 'fatura' ? 'Já foi paga' : 'Já foi pago', f.pago ? 'Desligue se ainda não saiu da conta' : `Fica em "Contas › ${t === 'entrada' ? 'A receber' : 'A pagar'}" até você marcar`)}</div>` : ''}
    ${corpo}
    ${f.compra && S.d.compras.get(f.compra) ? `<div class="note"><span>🛍️ Ao salvar, <b>${esc(S.d.compras.get(f.compra).item)}</b> sai de Para comprar.</span></div>` : ''}
    ${conta ? `<div class="note"><span>${conta.tipo === 'entrada' ? 'Recebimento' : 'Pagamento'} de <b>${esc(conta.nome)}</b> referente a ${fmtMes(f.ref).toLowerCase()}.</span></div>` : ''}
    <div class="grid2">${campo('Data', inp('dia', f.dia, 'type="date"'))}<span></span></div>
    <details ${f.nota ? 'open' : ''}><summary class="small muted">Observação</summary>${area('nota', f.nota, 'maxlength="300" style="min-height:60px"')}</details>
    ${f.conta && f.ref && S.d.contas.get(f.conta) ? blocoAnexos('contas', f.conta, f.ref, `Boleto de ${fmtMes(f.ref).toLowerCase()}`) : ''}
    ${l ? `<details ${anexosDe('lancamentos:' + l.id).length ? 'open' : ''}><summary class="small muted">Comprovante, nota fiscal ou boleto${anexosDe('lancamentos:' + l.id).length ? ` (${anexosDe('lancamentos:' + l.id).length})` : ''}</summary>${blocoAnexos('lancamentos', l.id)}</details>` : ''}
    <button class="btn block ${t === 'saida' || t === 'fatura' ? 'warm' : ''}" data-a="salvarLanc">${!l && f.forma === 'cartao' && t === 'saida' && n > 1 ? `Lançar ${n} parcelas` : 'Salvar'}</button>
    ${l ? `<button class="btn danger block" data-a="excluirLanc" data-id="${l.id}">${ic('trash', 16)} Excluir${l.grupo ? '' : ' lançamento'}</button><p class="tiny muted">Lançado por ${l.por === S.eu ? 'você' : esc(nomeDe(l.por))}.</p>` : ''}`;
};

/* ---------- fatura ---------- */
SH.fatura = s => {
  const k = S.d.cartoes.get(s.id); if (!k) return sumiu('Fatura');
  const f = fatura(k, s.v), st = STATUS_FATURA[f.status] || STATUS_FATURA.aberta;
  return `${head(esc(k.nome), `Fatura de ${fmtMes(f.ref).toLowerCase()}`)}
    <div class="mesnav"><button class="x" data-a="fref" data-v="-1" aria-label="Fatura anterior">${ic('chevl', 18)}</button><span class="tag ${st[0]}">${st[1]}</span><button class="x" data-a="fref" data-v="1" aria-label="Próxima fatura">${ic('chev', 18)}</button></div>
    <div class="panel soft"><p class="saldo" style="font-size:30px">${reais(f.total)}</p><p class="small muted">Fecha ${fmtData(f.fecha)} · vence ${fmtData(f.venc)}</p>
      ${f.pago ? `<p class="small">Pago: <b>${reais(f.pago)}</b>${f.resta ? ` · falta ${reais(f.resta)}` : ''}</p>` : ''}</div>
    ${f.resta ? `<button class="btn warm block" data-a="pagar" data-k="fatura" data-id="${k.id}" data-ref="${f.ref}">Pagar ${reais(f.resta)}</button>` : ''}
    ${secao('Compras', `<button class="link" data-a="importarFatura" data-id="${k.id}" data-v="${f.ref}">Importar planilha</button>`)}${listaOu(f.compras, linhaLanc, '<p class="small muted">Nenhuma compra nesta fatura.</p>')}
    ${f.pagamentos.length ? secao('Pagamentos') + listaOu(f.pagamentos, linhaLanc) : ''}
    ${f.agendados.length ? secao('Pagamento agendado', '<span class="tag warn">ainda não pago</span>') + listaOu(f.agendados, linhaLanc) : ''}`;
};

/* ---------- cartão ---------- */
function formCartao(k) { return k ? { nome: k.nome, cor: k.cor || CORES_CARTAO[0], limite: reaisInput(k.limite), fecha: k.fecha || 1, vence: k.vence || 10, carteira: k.carteira || '', ativo: k.ativo !== false, nota: k.nota || '' }
  : { nome: '', cor: CORES_CARTAO[lista('cartoes').length % CORES_CARTAO.length], limite: '', fecha: '', vence: '', carteira: (contasBancarias()[0] || {}).id || '', ativo: true, nota: '' }; }
SH.cartao = s => {
  const k = s.id && S.d.cartoes.get(s.id);
  if (s.id && !k) return sumiu('Cartão');
  if (!s.f) s.f = formCartao(k);
  const f = s.f, fe = parseInt(f.fecha, 10), ve = parseInt(f.vence, 10);
  return `${head(k ? 'Editar cartão' : 'Novo cartão', k ? esc(k.nome) : 'Cartão de crédito')}
    ${campo('Nome', inp('nome', f.nome, 'maxlength="40" placeholder="Ex.: Nubank Bruno, Itaú Visa" autocomplete="off"'))}
    ${grupo('Cor', `<div class="chips">${CORES_CARTAO.map(c => `<button class="cor ${f.cor === c ? 'on' : ''}" style="background:${c}" data-a="f" data-k="cor" data-v="${c}" aria-label="Cor ${c}"></button>`).join('')}</div>`)}
    ${campo('Limite', inp('limite', f.limite, 'inputmode="decimal" placeholder="R$ 0,00" autocomplete="off"'))}
    <div class="grid2">${campo('Fecha todo dia', inp('fecha', f.fecha, 'type="number" min="1" max="31" inputmode="numeric" placeholder="Ex.: 3"'))}${campo('Vence todo dia', inp('vence', f.vence, 'type="number" min="1" max="31" inputmode="numeric" placeholder="Ex.: 10"'))}</div>
    ${fe && ve ? `<p class="small muted">Compras até o dia ${fe - 1 || 'anterior ao fechamento'} entram na fatura que vence no dia ${ve}${ve > fe ? ' do mesmo mês' : ' do mês seguinte'}. O melhor dia para comprar é o dia ${fe}.</p>` : '<p class="small muted">Os dois dias estão na fatura ou no app do banco.</p>'}
    ${contasBancarias().length ? grupo('A fatura é paga pela conta', escolha('carteira', f.carteira, opcConta())) : ''}
    ${k ? toggle('ativo', f.ativo, 'Em uso', 'Desligue se cancelou o cartão') : ''}
    <button class="btn block" data-a="salvarCartao">Salvar</button>
    ${k ? `<button class="btn danger block" data-a="excluir" data-col="cartoes" data-id="${k.id}">${ic('trash', 16)} Excluir cartão</button>` : ''}`;
};

/* ---------- conta fixa e receita recorrente ---------- */
function formConta(c) {
  if (c) return { tipo: c.tipo || 'saida', nome: c.nome, v: reaisInput(c.v), vence: c.vence || 10, cat: c.cat || '', forma: c.forma || '', cartao: c.cartao || '', carteira: c.carteira || '', destino: c.destino || '', meta: c.meta || '', ativa: c.ativa !== false, fim: c.fim || '', nota: c.nota || '', auto: !!c.auto, autoDesde: c.autoDesde || '' };
  return { tipo: 'saida', nome: '', v: '', vence: 10, cat: 'contas', forma: 'boleto', cartao: (cartoes()[0] || {}).id || '', carteira: (contasBancarias()[0] || {}).id || '', destino: (investimentos()[0] || {}).id || '', meta: '', ativa: true, fim: '', nota: '', auto: false, autoDesde: '' };
}
SH.conta = s => {
  const c = s.id && S.d.contas.get(s.id);
  if (s.id && !c) return sumiu('Conta fixa');
  if (!s.f) s.f = formConta(c);
  const f = s.f, t = f.tipo, pags = c ? lancs().filter(l => l.conta === c.id).sort((a, b) => b.dia.localeCompare(a.dia)).slice(0, 8) : [];
  return `${head(c ? 'Editar' : 'Novo', t === 'entrada' ? 'Receita fixa' : t === 'aporte' ? 'Aporte todo mês' : 'Conta fixa')}
    ${segm('tipo', t, [['saida', 'Conta a pagar'], ['entrada', 'Receita'], ['aporte', 'Aporte']])}
    ${campo('Nome', inp('nome', f.nome, `maxlength="60" placeholder="${t === 'entrada' ? 'Ex.: Salário Ana' : t === 'aporte' ? 'Ex.: Tesouro todo mês' : 'Ex.: Aluguel, luz, Netflix'}" autocomplete="off"`))}
    <div class="grid2">${campo(t === 'saida' ? 'Valor de sempre' : 'Valor', inp('v', f.v, 'inputmode="decimal" placeholder="R$ 0,00" autocomplete="off"'))}${campo(t === 'saida' ? 'Vence todo dia' : 'Todo dia', inp('vence', f.vence, 'type="number" min="1" max="31" inputmode="numeric"'))}</div>
    ${t !== 'aporte' ? grupo('Categoria', escolha('cat', f.cat, categorias(t).map(x => [x.id, `${esc(x.ic)} ${esc(x.nome)}`]))) : ''}
    ${t === 'saida' ? grupo('Como paga', escolha('forma', f.forma, [['boleto', 'Boleto'], ['pix', 'Pix'], ['auto', 'Débito automático'], ...(cartoes().length ? [['cartao', 'Cartão de crédito']] : [])])) : ''}
    ${t === 'saida' && f.forma === 'cartao' && cartoes().length > 1 ? grupo('Cartão', escolha('cartao', f.cartao, cartoes().map(x => [x.id, esc(x.nome)]))) : ''}
    ${t === 'aporte' ? (investimentos().length ? grupo('Investimento', escolha('destino', f.destino, investimentos().map(p => [p.id, esc(p.nome)]))) : '<div class="note warn"><span>Cadastre o investimento em Patrimônio.</span></div>') : ''}
    ${t === 'aporte' && metas().length ? grupo('Meta (opcional)', escolha('meta', f.meta, [['', 'Nenhuma'], ...metas().map(m => [m.id, esc(m.nome)])])) : ''}
    ${f.forma !== 'cartao' && contasBancarias().length > 1 ? grupo(t === 'entrada' ? 'Entra na conta' : 'Sai da conta', escolha('carteira', f.carteira, opcConta())) : ''}
    ${t === 'entrada' || (t === 'saida' && f.forma === 'auto') ? toggle('auto', f.auto, t === 'entrada' ? 'Cai sozinho no dia' : 'Lançar sozinho no dia', t === 'entrada' ? 'No dia, o app marca como recebido. Se não cair, toque em "Não foi recebido".' : 'Débito automático: no dia, o app marca como pago.') : ''}
    ${campo('Termina em (opcional)', inp('fim', f.fim, 'type="month" placeholder="AAAA-MM"'))}
    ${c ? toggle('ativa', f.ativa, 'Ativa', 'Desligue se a conta acabou') : ''}
    ${campo('Observação', area('nota', f.nota, 'maxlength="300" placeholder="Código de cliente, débito automático…" style="min-height:60px"'))}
    <button class="btn block" data-a="salvarConta">Salvar</button>
    ${c ? blocoAnexos('contas', c.id, s.v || S.mes, `${t === 'entrada' ? 'Comprovante' : t === 'aporte' ? 'Comprovante' : 'Boleto'} de ${fmtMes(s.v || S.mes).toLowerCase()}`, t === 'saida' ? 'Anexe o boleto ou a fatura deste mês: fica junto quando for pagar.' : '')
      + blocoAnexos('contas', c.id, '', 'Documentos da conta', 'Contrato, código do cliente, segunda via: o que vale para todos os meses.')
      : '<p class="tiny muted">Depois de salvar, dá para anexar o boleto de cada mês e o contrato.</p>'}
    ${pags.length ? secao('Histórico') + listaOu(pags, linhaLanc) : ''}
    ${c ? `<button class="btn danger block" data-a="excluir" data-col="contas" data-id="${c.id}">${ic('trash', 16)} Excluir</button>` : ''}`;
};

/* ---------- patrimônio ---------- */
function formPat(p, cl) {
  if (p) return { modo: 'editar', nome: p.nome, classe: p.classe, inst: p.inst || '', taxa: p.taxa != null ? String(p.taxa).replace('.', ',') : '', ativo: p.ativo !== false, nota: p.nota || '', ic: p.ic || '', aplicado: reaisInput(p.aplicado) };
  return { modo: 'novo', nome: '', classe: cl || 'conta', inst: '', saldo: '', dia: hoje(), taxa: '', ativo: true, nota: '', ic: '', aplicado: '' };
}
SH.pat = s => {
  const p = s.id && S.d.patrimonio.get(s.id);
  if (s.id && !p) return sumiu('Patrimônio');
  if (!p && !s.f) s.f = formPat(null, s.v);
  if (p && !s.f) return verPat(p);
  const f = s.f;
  if (f.modo === 'saldo') return `${head(esc(p.nome), 'Atualizar saldo')}
    <p class="small muted">Confira no app do banco ou da corretora e digite o valor de hoje. O app passa a contar a partir dele.</p>
    ${valorInp('saldo', f.saldo)}<div class="grid2">${campo('Data', inp('dia', f.dia, 'type="date"'))}<span></span></div>
    <button class="btn block" data-a="salvarSaldo">Salvar saldo</button>`;
  const g = classe(f.classe).g, grupoAtual = GRUPOS_PAT.find(x => x[0] === g);
  const classes = Object.entries(CLASSES).filter(([, c]) => c.g === g);
  return `${head(p ? 'Editar' : 'Novo', grupoAtual[1].replace(/s$/, '').replace('Conta e dinheiro', 'Conta'))}
    ${!p ? segm('grupo', g, GRUPOS_PAT.map(([k, n]) => [k, n.split(' ')[0]])) : ''}
    ${classes.length > 1 ? grupo('Tipo', escolha('classe', f.classe, classes.map(([k, c]) => [k, `${c.ic} ${c.n}`]))) : ''}
    ${campo('Nome', inp('nome', f.nome, `maxlength="60" placeholder="${{ contas: 'Ex.: Conta conjunta Itaú, Carteira', invest: 'Ex.: Tesouro Selic, CDB Inter', bens: 'Ex.: Apartamento, Carro', dividas: 'Ex.: Financiamento do apê' }[g]}" autocomplete="off"`))}
    ${campo('Instituição (opcional)', inp('inst', f.inst, 'maxlength="60" placeholder="Banco, corretora…" autocomplete="off"'))}
    ${!p ? `${grupo(g === 'dividas' ? 'Quanto deve hoje' : g === 'bens' ? 'Quanto vale hoje' : 'Saldo de hoje', valorInp('saldo', f.saldo))}` : ''}
    ${g === 'invest' ? campo(p ? 'Total aplicado até o primeiro saldo (opcional)' : 'Quanto foi aplicado ao todo (opcional)', inp('aplicado', f.aplicado, 'inputmode="decimal" placeholder="R$ 0,00" autocomplete="off"')) + '<p class="tiny muted">Para calcular o rendimento. Aportes e resgates lançados depois somam sozinhos.</p>' : ''}
    ${g === 'dividas' ? campo('Juros ao mês, % (opcional)', inp('taxa', f.taxa, 'inputmode="decimal" placeholder="Ex.: 0,9"')) : ''}
    ${p ? toggle('ativo', f.ativo, 'Ativo', 'Desligue se vendeu, resgatou tudo ou quitou') : ''}
    ${campo('Observação', area('nota', f.nota, 'maxlength="300" style="min-height:60px"'))}
    <button class="btn block" data-a="salvarPat">Salvar</button>
    ${p ? `<button class="btn danger block" data-a="excluir" data-col="patrimonio" data-id="${p.id}">${ic('trash', 16)} Excluir</button>` : ''}`;
};
function verPat(p) {
  const v = valorAtual(p), g = classe(p.classe).g, u = ultimaAtualizacao(p), ref = N_mes(hoje());
  const serie = []; for (let i = 11; i >= 0; i--) { const m = N_somaMes(ref, -i); serie.push({ ref: m, v: valorEm(p, i ? N_diaDoMes(m, 31) : hoje()) }); }
  serie.splice(0, serie.length, ...aparaSerie(serie, [p]));
  const comHist = serie.filter(x => x.v).length > 1;
  const movs = movimentos(p.id).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 8).map(x => x[3]);
  const rend = g === 'invest' ? [1, 2, 3].map(i => { const m = N_somaMes(ref, -i); return [m, rendimentoMes(p, m)]; }).filter(x => x[1] != null) : [];
  return `${head(esc(classe(p.classe).n), `${esc(p.ic || classe(p.classe).ic)} ${esc(p.nome)}`)}
    <div class="panel soft"><p class="saldo" style="font-size:30px">${g === 'dividas' ? '− ' : ''}${reais(v)}</p>
      <p class="small muted">${[p.inst, u ? 'saldo conferido em ' + fmtCurta(u) : ''].filter(Boolean).map(esc).join(' · ')}${p.taxa ? ` · juros ${fmt(p.taxa, 2)}% ao mês` : ''}</p></div>
    ${g === 'invest' && (p.hist || []).length ? (() => { const a = aplicadoEm(p, hoje()), r = v - a; return `<div class="grid2"><div class="stat"><span class="tiny muted">Aplicado</span><b>${reais(a)}</b></div><div class="stat"><span class="tiny muted">Rendimento bruto</span><b class="${r < 0 ? 'c-bad' : 'c-good'}">${r >= 0 ? '+' : '−'}${reais(Math.abs(r))}${a > 0 ? ` <span class="tiny">${pctVar(r / a)}</span>` : ''}</b></div></div>`; })() : ''}
    <div class="grid2"><button class="btn sm" data-a="saldoPat">Atualizar saldo</button>
      ${g === 'invest' ? `<button class="btn ghost sm" data-a="novoLanc" data-tipo="aporte" data-destino="${p.id}">Aplicar / resgatar</button>` : g === 'contas' ? `<button class="btn ghost sm" data-a="novoLanc" data-tipo="transf" data-carteira="${p.id}">Transferir</button>` : g === 'dividas' ? `<button class="btn ghost sm" data-a="novoLanc" data-tipo="saida" data-cat="dividas" data-destino="${p.id}">Registrar pagamento</button>` : '<span></span>'}</div>
    ${comHist ? grafLinha(serie, 'Valor mês a mês', 'valor') : ''}
    ${rend.length ? `<p class="small muted">Rendimento estimado: ${rend.map(([m, r]) => `${mesCurto(m)} ${r >= 0 ? '+' : '−'}${reais(Math.abs(r))}`).join(' · ')}</p>` : ''}
    ${movs.length ? secao('Movimentos') + listaOu(movs, linhaLanc) : ''}
    ${p.nota ? `<p class="small">${esc(p.nota)}</p>` : ''}
    <div class="between">${criadoPor(p)}<button class="btn ghost sm" data-a="editarPat">${ic('edit', 16)} Editar</button></div>`;
}

/* ---------- metas ---------- */
const PRESETS_META = [
  { k: 'reserva', ic: '🛟', t: 'Reserva de emergência', d: '6 meses de despesas essenciais guardados' },
  { k: 'investir', ic: '📈', t: 'Investir todo mês', d: 'Um valor fixo por mês, sem falhar' },
  { k: 'cartao', ic: '💳', t: 'Reduzir o cartão', d: 'Limite para o que vai no crédito por mês' },
  { k: 'divida', ic: '🏦', t: 'Quitar uma dívida', d: 'Acompanhar o saldo devedor até zerar' },
  { k: 'categoria', ic: '🍔', t: 'Gastar menos em algo', d: 'Delivery, compras, lazer…' },
  { k: 'sonho', ic: '✈️', t: 'Juntar para um sonho', d: 'Viagem, carro, reforma, com prazo' }
];
function presetMeta(k) {
  const h = hoje(), ref = N_mes(h), daqui = n => N_diaDoMes(N_somaMes(ref, n), 28);
  const reservas = investimentos().filter(p => p.classe === 'reserva').map(p => p.id);
  const fat3 = [1, 2, 3].reduce((a, i) => a + faturasDoMes(N_somaMes(ref, -i)), 0) / 3;
  const delivery = mediaCategoria(ref, 'delivery'), divs = dividas();
  const base = { nome: '', ic: '🎯', tipo: 'juntar', alvo: '', prazo: '', itens: [], metrica: '', cat: '', nota: '' };
  const m = {
    reserva: { nome: 'Reserva de emergência', ic: '🛟', tipo: 'juntar', alvo: reaisInput(reservaSugerida()), prazo: daqui(12), itens: reservas },
    investir: { nome: 'Investir todo mês', ic: '📈', tipo: 'mensal' },
    cartao: { nome: 'Gastar menos no cartão', ic: '💳', tipo: 'reduzir', metrica: 'cartao', alvo: fat3 ? reaisInput(Math.round(fat3 * .8 / 1000) * 1000) : '' },
    divida: { nome: divs.length === 1 ? 'Quitar ' + divs[0].nome : 'Quitar as dívidas', ic: '🏦', tipo: 'reduzir', metrica: 'divida', alvo: '0', itens: divs.map(p => p.id) },
    categoria: { nome: 'Gastar menos com delivery', ic: '🍔', tipo: 'reduzir', metrica: 'cat', cat: 'delivery', alvo: delivery ? reaisInput(Math.round(delivery * .7 / 1000) * 1000) : '' },
    sonho: { nome: '', ic: '✈️', tipo: 'juntar', prazo: daqui(12) }
  }[k] || {};
  return { ...base, ...m };
}
function formMeta(m) { return { nome: m.nome, ic: m.ic || '🎯', tipo: m.tipo, alvo: reaisInput(m.alvo) || (m.tipo === 'reduzir' && m.metrica === 'divida' ? '0' : ''), prazo: m.prazo || '', itens: m.itens || [], metrica: m.metrica || '', cat: m.cat || '', nota: m.nota || '' }; }
const EMOJIS_META = ['🎯', '🛟', '📈', '💳', '🏦', '✈️', '🏠', '🚗', '🎓', '👶', '💍', '🏖️', '🛠️', '🍔', '💰', '🌱'];
SH.meta = s => {
  const m = s.id && S.d.metas.get(s.id);
  if (s.id && !m) return sumiu('Meta');
  if (m && !s.f) return verMeta(m);
  if (!s.f) return `${head('Nova meta', 'Qual é o objetivo?')}<div class="presets">${PRESETS_META.map(p => `<button class="preset" data-a="presetMeta" data-v="${p.k}"><span class="em">${p.ic}</span><b>${esc(p.t)}</b><span class="tiny muted">${esc(p.d)}</span></button>`).join('')}</div>`;
  const f = s.f, t = f.tipo;
  const rotAlvo = t === 'mensal' ? 'Quanto investir por mês' : t === 'juntar' ? 'Quanto juntar' : f.metrica === 'divida' ? 'Chegar a dever (0 = quitar)' : 'Limite por mês';
  return `${head(m ? 'Editar meta' : 'Nova meta', esc(f.nome) || 'Objetivo da família')}
    ${campo('Nome', inp('nome', f.nome, 'maxlength="60" placeholder="Ex.: Viagem para o Chile" autocomplete="off"'))}
    ${grupo('Ícone', `<div class="emojis">${EMOJIS_META.map(e => `<button class="${f.ic === e ? 'on' : ''}" data-a="f" data-k="ic" data-v="${e}">${e}</button>`).join('')}</div>`)}
    ${segm('tipo', t, [['juntar', 'Juntar'], ['mensal', 'Todo mês'], ['reduzir', 'Reduzir']])}
    ${t === 'reduzir' ? grupo('O que reduzir', escolha('metrica', f.metrica, Object.entries(METRICAS).map(([k, n]) => [k, n]))) : ''}
    ${t === 'reduzir' && f.metrica === 'cat' ? grupo('Categoria', escolha('cat', f.cat, categorias('saida').map(c => [c.id, `${esc(c.ic)} ${esc(c.nome)}`]))) : ''}
    ${grupo(rotAlvo, valorInp('alvo', f.alvo))}
    ${t === 'juntar' ? campo('Até quando', inp('prazo', f.prazo, 'type="date"')) : ''}
    ${t === 'juntar' && f.alvo && f.prazo ? (() => { const meses = Math.max(1, N_diasEntre(hoje(), f.prazo) / 30.4); return `<p class="small muted">≈ ${reais(Math.ceil(lerReais(f.alvo) / meses))} por mês.</p>`; })() : ''}
    ${t === 'juntar' || t === 'mensal' ? (investimentos().length ? grupo(t === 'juntar' ? 'Onde o dinheiro está guardado' : 'Contar aportes em (vazio = todos)', escolhaMulti('itens', f.itens, investimentos().map(p => [p.id, esc(p.nome)]))) + (t === 'juntar' ? '<p class="tiny muted">O progresso é o saldo desses investimentos. Sem nenhum escolhido, contam os aportes ligados a esta meta.</p>' : '') : '<p class="tiny muted">Dica: cadastre os investimentos em Patrimônio para o progresso ser automático.</p>') : ''}
    ${t === 'reduzir' && f.metrica === 'divida' ? (dividas().length ? grupo('Quais dívidas', escolhaMulti('itens', f.itens, dividas().map(p => [p.id, esc(p.nome)]))) : '<div class="note warn"><span>Cadastre a dívida em Patrimônio › Dívida.</span></div>') : ''}
    ${campo('Por que essa meta importa (opcional)', area('nota', f.nota, 'maxlength="300" placeholder="Lembrar o motivo ajuda a manter o foco" style="min-height:60px"'))}
    <button class="btn block" data-a="salvarMeta">Salvar meta</button>
    ${m ? `<button class="btn ghost block" data-a="arquivarMeta" data-id="${m.id}">${m.ativa === false ? 'Reativar' : 'Arquivar'}</button><button class="btn danger block" data-a="excluir" data-col="metas" data-id="${m.id}">${ic('trash', 16)} Excluir meta</button>` : ''}`;
};
/* Meta do cartão: quais faturas entram na conta deste mês */
function faturasDaMeta() {
  const ref = N_mes(hoje()), fs = cartoes().map(k => ({ k, f: fatura(k, ref) })).filter(x => x.f.total);
  return `<div class="panel"><p class="small muted" style="margin:0">Soma das faturas que vencem em ${MESES[+ref.slice(5) - 1]}, de todos os cartões:</p>
    ${fs.length ? `<div class="lst">${fs.map(({ k, f }) => `<button class="it" data-a="sheet" data-k="fatura" data-id="${k.id}" data-v="${f.ref}"><span class="em-tile">💳</span><span class="main"><span class="t">${esc(k.nome)}</span><span class="s">vence ${fmtCurta(f.venc)} · ${STATUS_FATURA[f.status] ? STATUS_FATURA[f.status][1] : ''}</span></span><span class="v">${reais(f.total)}</span></button>`).join('')}</div>` : '<p class="small muted" style="margin:0">Nenhuma fatura vence este mês.</p>'}</div>`;
}
function verMeta(m) {
  const p = progressoMeta(m), st = STATUS_META[p.status];
  const desc = m.tipo === 'mensal' ? `Investir ${reais(m.alvo)} por mês` : m.tipo === 'juntar' ? `Juntar ${reais(m.alvo)}${m.prazo ? ' até ' + fmtCurta(m.prazo) + '/' + m.prazo.slice(2, 4) : ''}` : m.metrica === 'divida' ? 'Quitar dívida' : `${METRICAS[m.metrica] || 'Gasto'}: até ${reais(m.alvo)}${m.metrica === 'cat' ? ' em ' + categoria(m.cat).nome : ''}`;
  return `${head(esc(desc), `${esc(m.ic || '🎯')} ${esc(m.nome)}`)}
    <div class="panel soft"><div class="between"><p class="saldo" style="font-size:30px">${m.tipo === 'juntar' || m.tipo === 'mensal' ? Math.round(p.pct * 100) + '%' : reais(p.atual)}</p><span class="tag ${st[0]}">${st[1]}</span></div>
      ${bar(p.pct, 1, p.cor || (p.status === 'atencao' ? 'var(--warn)' : 'var(--accent)'))}<p class="small">${esc(p.linha)}</p>
      ${m.tipo !== 'reduzir' || m.metrica === 'divida' ? `<p class="small muted">${reais(p.atual)} ${m.metrica === 'divida' ? 'de saldo devedor' : 'de ' + reais(p.alvo)}</p>` : ''}</div>
    ${m.metrica === 'cartao' ? faturasDaMeta() : ''}
    ${p.serie ? `<div class="panel"><p class="small muted">Últimos 6 meses ${m.tipo === 'mensal' ? '(investido no mês)' : ''}</p>${grafMini(p.serie, m.alvo, v => m.tipo === 'mensal' ? v >= m.alvo : v <= m.alvo)}</div>` : ''}
    ${m.tipo === 'juntar' || m.tipo === 'mensal' ? `<button class="btn block" data-a="novoLanc" data-tipo="aporte" data-meta="${m.id}"${m.itens && m.itens[0] ? ` data-destino="${m.itens[0]}"` : ''}>📈 Registrar aporte</button>` : ''}
    ${m.nota ? `<div class="note"><span>“${esc(m.nota)}”</span></div>` : ''}
    <div class="between">${criadoPor(m)}<button class="btn ghost sm" data-a="editarMeta">${ic('edit', 16)} Editar</button></div>`;
}

/* ---------- orçamento e categorias ---------- */
SH.orcamento = s => {
  const ref = N_mes(hoje());
  if (!s.f) s.f = { cats: categorias().map(c => ({ ...c, orcTxt: reaisInput(c.orc) })), met: { ...metodo() }, nic: '📦', nnome: '', ntipo: 'saida', ngrupo: 'livre' };
  const f = s.f, total = f.cats.filter(c => c.tipo === 'saida').reduce((a, c) => a + lerReais(c.orcTxt), 0);
  const renda = mediaMeses(ref, 3, r => r.rec), somaMet = (+f.met.essencial || 0) + (+f.met.livre || 0) + (+f.met.futuro || 0);
  const linha = (c, i) => c.tipo === 'saida' ? `<div class="orc-ed">
      <span class="em-c">${esc(c.ic)}</span><input class="in" data-i="cnome:${i}" value="${esc(c.nome)}" maxlength="30" aria-label="Nome da categoria">
      <input class="in num" data-i="corc:${i}" value="${esc(c.orcTxt)}" inputmode="decimal" placeholder="sem limite" aria-label="Orçamento de ${esc(c.nome)}" style="text-align:right">
      <button class="mini" data-a="rmCat" data-i="${i}" aria-label="Remover ${esc(c.nome)}">${ic('trash', 16)}</button>
      <span></span><button class="chip sm ${c.grupo === 'essencial' ? 'on' : ''}" data-a="fgrupo" data-i="${i}">${c.grupo === 'essencial' ? 'Essencial' : 'Estilo de vida'}</button><span class="tiny muted" style="text-align:right">média ${compacto(mediaCategoria(ref, c.id))}</span><span></span></div>`
    : `<div class="orc-ed ent"><span class="em-c">${esc(c.ic)}</span><input class="in" data-i="cnome:${i}" value="${esc(c.nome)}" maxlength="30" aria-label="Nome da categoria"><button class="mini" data-a="rmCat" data-i="${i}" aria-label="Remover ${esc(c.nome)}">${ic('trash', 16)}</button></div>`;
  return `${head('Finanças', 'Orçamento do mês')}
    ${grupo('Divisão da renda (%)', `<div class="grid3">${[['essencial', 'Essenciais'], ['livre', 'Estilo de vida'], ['futuro', 'Futuro']].map(([k, n]) => `<label class="lab"><span class="tiny">${n}</span><input class="in num" data-i="met:${k}" value="${esc(f.met[k])}" type="number" min="0" max="100" inputmode="numeric"></label>`).join('')}</div>`)}
    ${somaMet !== 100 ? `<p class="small c-bad">As três partes somam ${somaMet}%. Precisam somar 100%.</p>` : '<p class="tiny muted">Referência clássica: 50/30/20. Quem quer acelerar uma meta costuma usar algo como 50/20/30.</p>'}
    ${renda ? `<p class="small muted">Renda média dos últimos 3 meses: ${reais(renda)}. Total orçado: <b>${reais(total)}</b> (${Math.round(total / renda * 100)}% da renda).</p>` : `<p class="small muted">Total orçado: <b>${reais(total)}</b> por mês.</p>`}
    <button class="btn ghost sm" data-a="usarMedia" style="align-self:flex-start">Preencher os vazios com a média de 3 meses</button>
    <div class="stack">${f.cats.map(linha).join('')}</div>
    ${secao('Categorias de receita')}<div class="stack">${f.cats.map((c, i) => c.tipo === 'entrada' ? linha(c, i) : '').join('')}</div>
    ${secao('Nova categoria')}
    <div class="emojis">${EMOJIS_CAT.map(e => `<button class="${f.nic === e ? 'on' : ''}" data-a="f" data-k="nic" data-v="${e}">${e}</button>`).join('')}</div>
    ${segm('ntipo', f.ntipo, [['saida', 'Despesa'], ['entrada', 'Receita']])}
    ${f.ntipo === 'saida' ? segm('ngrupo', f.ngrupo, [['essencial', 'Essencial'], ['livre', 'Estilo de vida']]) : ''}
    <div class="inrow">${inp('nnome', f.nnome, 'maxlength="30" placeholder="Nome (ex.: Farmácia)" autocomplete="off"')}<button class="btn ghost" data-a="addCat">Adicionar</button></div>
    <button class="btn block" data-a="salvarOrc">Salvar</button>`;
};

/* ============================== ações ============================== */
/* Para comprar › Comprei: o item fica como comprado, ligado ao lançamento */
function marcarComprado(id, lanc) { if (S.d.compras.get(id)) enfileirar('salvar', { col: 'compras', item: { id, comprado: true, compradoPor: S.eu, compradoEm: new Date().toISOString(), lanc } }); }
function lancarLote(itens) { if (itens.length === 1) enfileirar('salvar', { col: 'lancamentos', item: itens[0] }); else enfileirar('lote', { col: 'lancamentos', itens }); }
Object.assign(A, {
  fv: d => { S.fv = d.v; if (d.v !== 'extrato') S.fCat = null; esconderDica(); render(false); },
  mes: d => { S.mes = N_somaMes(S.mes, +d.v); render(); },
  mesHoje: () => { S.mes = N_mes(hoje()); render(); },
  fcat: d => { S.fCat = S.fCat === d.v ? null : d.v; S.fv = 'extrato'; S.fExt = 'tudo'; render(false); },
  fext: d => { S.fExt = d.v; render(); },
  buscaTodos: () => { S.buscaTodos = !S.buscaTodos; render(); },
  irRevisar: () => { S.fv = 'extrato'; S.fExt = 'revisar'; S.fCat = null; render(false); },
  revVer: d => { S.revAberto = S.revAberto === d.v ? null : d.v; render(); },
  revOk: d => {
    const g = filaRevisar().find(x => x.k === d.v); if (!g) return;
    S.revAberto = null;
    const n = categorizarLoja(g.ls[0].desc, d.cat, lojaDe(g.ls[0].desc) ? null : g.ls[0].id), c = categoria(d.cat);
    toast(`${n} ${plu(n, 'lançamento')} de ${g.nome} em ${c.ic} ${c.nome}.`);
  },
  dupOk: d => { let l = []; try { l = JSON.parse(lsGet('dupOk') || '[]'); } catch (e) { /* vazio */ } lsSet('dupOk', JSON.stringify([...l, d.v].slice(-300))); render(); },
  dupTirar: d => { const l = S.d.lancamentos.get(d.id); if (!l || !confirm(`Excluir este lançamento repetido (${tituloLanc(l)}, ${reais(l.v)})?`)) return; enfileirar('excluir', { col: 'lancamentos', id: l.id }); toast('Excluído.'); },
  fl: d => { const f = S.sheet.f, l = f[d.k] || []; f[d.k] = l.includes(d.v) ? l.filter(x => x !== d.v) : [...l, d.v]; renderSheet(); },
  fatMes: d => { S.fatMes = N_somaMes(S.fatMes || refFaturaDaVez(), +d.v); render(); },
  fatMesIr: d => { S.fatMes = d.v === refFaturaDaVez() ? null : d.v; render(); },
  fatMesHoje: () => { S.fatMes = null; render(); },
  fref: d => { S.sheet.v = N_somaMes(S.sheet.v, +d.v); renderSheet(); },
  novoLanc: d => {
    const pre = { tipo: d.tipo, dia: S.tab === 'financas' && S.mes !== N_mes(hoje()) ? S.mes + '-01' : hoje() };
    ['cartao', 'destino', 'carteira', 'meta', 'cat'].forEach(k => { if (d[k]) pre[k] = d[k]; });
    if (d.tipo === 'transf' && d.carteira) pre.destino = (contasBancarias().find(p => p.id !== d.carteira) || {}).id || '';
    if (d.cartao) pre.forma = 'cartao';
    openSheet({ k: 'lanc', pre }); setTimeout(() => focar('f-v'), 280);
  },
  // "Não foi pago": volta para A pagar (ou A receber), com Desfazer
  despagar: d => {
    const ref = d.ref || N_mes(hoje()), ls = [];
    if (d.k === 'lanc') ls.push(S.d.lancamentos.get(d.id));
    if (d.k === 'fatura') { const k = S.d.cartoes.get(d.id); if (k) ls.push(...fatura(k, ref).pagamentos); }
    if (d.k === 'rec') { const r = recorrentesMes(ref).find(x => x.id === d.id); if (r && r.lanc) ls.push(r.lanc); }
    const alvo = ls.filter(l => l && l.pago && l.forma !== 'cartao' && ['saida', 'entrada', 'fatura'].includes(l.tipo));
    if (!alvo.length) { toast('Aqui não dá para desmarcar: abra o lançamento para editar.'); return; }
    alvo.forEach(l => enfileirar('salvar', { col: 'lancamentos', item: { id: l.id, pago: false } }));
    const ent = alvo[0].tipo === 'entrada';
    toast(`Marcado como não ${ent ? 'recebido' : 'pago'}: volta para "${ent ? 'A receber' : 'A pagar'}".`, 4500, { rot: 'Desfazer', fn: () => alvo.forEach(l => enfileirar('salvar', { col: 'lancamentos', item: { id: l.id, pago: true } })) });
  },
  pagar: d => {
    const ref = d.ref || N_mes(hoje()), h = hoje();
    if (d.k === 'lanc') {
      const l = S.d.lancamentos.get(d.id); if (!l) return;
      enfileirar('salvar', { col: 'lancamentos', item: { id: l.id, pago: true, dia: l.dia > h ? h : l.dia } });
      toast(`${tituloLanc(l)}: ${l.tipo === 'entrada' ? 'recebido' : 'pago'}.`, 3500, { rot: 'Desfazer', fn: () => enfileirar('salvar', { col: 'lancamentos', item: { id: l.id, pago: false, dia: l.dia } }) });
      return;
    }
    if (d.k === 'fatura') {
      const k = S.d.cartoes.get(d.id); if (!k) return;
      const f = fatura(k, ref);
      if (f.agendados.length) { f.agendados.forEach(l => A.pagar({ k: 'lanc', id: l.id })); return; }
      openSheet({ k: 'lanc', pre: { tipo: 'fatura', v: f.resta, cartao: k.id, ref, carteira: k.carteira || (contasBancarias()[0] || {}).id || '', desc: 'Fatura ' + k.nome, dia: h, pago: true, travado: true } });
      return;
    }
    const c = S.d.contas.get(d.id); if (!c) return;
    const r = recorrentesMes(ref).find(x => x.id === c.id);
    if (r && r.lanc && !r.lanc.pago) { A.pagar({ k: 'lanc', id: r.lanc.id }); return; }
    const venc = N_diaDoMes(ref, c.vence || 1);
    openSheet({ k: 'lanc', pre: { tipo: c.tipo === 'aporte' ? 'aporte' : c.tipo, v: c.v, desc: c.nome, cat: c.cat, forma: c.tipo === 'saida' ? c.forma || 'boleto' : '', cartao: c.cartao,
      carteira: c.carteira || (contasBancarias()[0] || {}).id || '', destino: c.destino, meta: c.meta, conta: c.id, ref, dia: ref === N_mes(h) ? h : venc, pago: true } });
  },
  salvarLanc: () => {
    const s = S.sheet, f = s.f, v = lerReais(f.v), t = f.tipo, antigo = s.id && S.d.lancamentos.get(s.id);
    if (v <= 0) { toast('Digite o valor.'); focar('f-v'); return; }
    if (!N_dataValida(f.dia)) { toast('Escolha a data.'); return; }
    if ((t === 'saida' || t === 'entrada') && !f.cat) { toast('Escolha a categoria.'); return; }
    if (t === 'saida' && f.forma === 'cartao' && !f.cartao) { toast('Escolha o cartão.'); return; }
    if ((t === 'aporte' || t === 'resgate') && !f.destino) { toast('Escolha o investimento.'); return; }
    if (t === 'transf' && (!f.carteira || !f.destino || f.carteira === f.destino)) { toast('Escolha duas contas diferentes.'); return; }
    const cartao = t === 'saida' && f.forma === 'cartao';
    const base = { tipo: t, v, dia: f.dia, desc: String(f.desc || '').trim(), nota: String(f.nota || '').trim(),
      cat: t === 'saida' || t === 'entrada' ? f.cat : '', forma: t === 'saida' ? f.forma : '', cartao: cartao || t === 'fatura' ? f.cartao : '',
      carteira: cartao ? '' : f.carteira || '', pago: cartao || ['aporte', 'resgate', 'transf'].includes(t) ? true : !!f.pago,
      destino: ['aporte', 'resgate', 'transf'].includes(t) || (t === 'saida' && f.cat === 'dividas') ? f.destino || '' : '', meta: t === 'aporte' || t === 'resgate' ? f.meta || '' : '',
      conta: f.conta || '', ref: f.conta || t === 'fatura' ? f.ref : '',
      proj: t === 'saida' ? String(f.proj || '').trim() : '', reemb: t === 'saida' ? String(f.reemb || '').trim() : '', reembOk: t === 'saida' && String(f.reemb || '').trim() ? !!f.reembOk : false };
    // Trocou a categoria de uma loja: a nota "categoria a confirmar" sai e o app aprende para as próximas
    const trocouCat = t === 'saida' && antigo && antigo.cat !== base.cat && !CAT_VAGA(base.cat);
    if (trocouCat && aConfirmar(antigo)) base.nota = base.nota.replace(/;?\s*categoria a confirmar/i, '').trim();
    const n = Math.max(1, Math.min(72, parseInt(f.parcelas, 10) || 1));
    if (cartao) lsSet('ultimoCartao', f.cartao);
    if (t === 'saida') lsSet('ultimaForma', f.forma);
    closeSheet();
    if (!antigo && cartao && n > 1) {
      const grupo = uidNovo(), datas = N_datasParcelas(f.dia, n), vals = N_valoresParcelas(v, n);
      const ls = datas.map((d, i) => ({ ...base, id: uidNovo(), dia: d, v: vals[i], parc: `${i + 1}/${n}`, grupo }));
      lancarLote(ls); if (f.compra) marcarComprado(f.compra, ls[0].id);
      toast(`Compra em ${n}x de ${reais(vals[1])} lançada.`);
    } else {
      const novo = { ...base, id: s.id || uidNovo() };
      lancarLote([novo]); if (f.compra && !antigo) marcarComprado(f.compra, novo.id);
      toast(antigo ? 'Lançamento atualizado.' : `${{ saida: 'Despesa de X lançada', entrada: 'Receita de X lançada', aporte: 'Aporte de X registrado', resgate: 'Resgate de X registrado', transf: 'Transferência de X registrada', fatura: 'Pagamento de X registrado' }[t].replace('X', reais(v))}.`);
    }
    if (trocouCat) {
      const k = lojaDe(base.desc), outros = k ? lancs().filter(l => l.id !== antigo.id && aRevisar(l) && lojaDe(l.desc) === k).length : 0;
      if (outros) toast(`Usar ${categoria(base.cat).nome} nas outras ${outros} de ${base.desc}?`, 7000, { rot: 'Aplicar', fn: () => categorizarLoja(base.desc, base.cat) });
      else if (k && regrasCat()[k] !== base.cat) enfileirar('casa', { regras: { [k]: base.cat } });
    }
    if (S.tab === 'financas' && N_mes(f.dia) !== S.mes && S.fv !== 'cartoes' && S.fv !== 'patrimonio' && S.fv !== 'metas') { S.mes = N_mes(f.dia); render(false); }
  },
  excluirLanc: d => {
    const l = S.d.lancamentos.get(d.id); if (!l) return;
    let ids = [l.id];
    if (l.grupo) {
      const todas = lancs().filter(x => x.grupo === l.grupo).map(x => x.id);
      if (todas.length > 1 && confirm(`Esta compra tem ${todas.length} parcelas. Excluir todas?\n(Cancelar = escolher só esta)`)) ids = todas;
      else if (!confirm('Excluir só esta parcela?')) return;
    } else if (!confirm('Excluir este lançamento? Some para os dois.')) return;
    closeSheet(); enfileirar('excluir', ids.length > 1 ? { col: 'lancamentos', ids } : { col: 'lancamentos', id: ids[0] });
    toast(ids.length > 1 ? `${ids.length} parcelas excluídas.` : 'Excluído.');
  },
  salvarCartao: () => {
    const s = S.sheet, f = s.f, nome = f.nome.trim(), fe = parseInt(f.fecha, 10), ve = parseInt(f.vence, 10);
    if (!nome) { toast('Dê um nome ao cartão.'); focar('f-nome'); return; }
    if (!(fe >= 1 && fe <= 31 && ve >= 1 && ve <= 31)) { toast('Preencha os dias de fechamento e vencimento.'); focar('f-fecha'); return; }
    const item = { id: s.id || uidNovo(), nome, cor: f.cor, limite: lerReais(f.limite), fecha: fe, vence: ve, carteira: f.carteira || '', ativo: s.id ? !!f.ativo : true, nota: String(f.nota || '').trim() };
    closeSheet(); enfileirar('salvar', { col: 'cartoes', item }); toast(s.id ? 'Cartão atualizado.' : `${nome} cadastrado.`);
  },
  salvarConta: () => {
    const s = S.sheet, f = s.f, nome = f.nome.trim(), t = f.tipo;
    if (!nome) { toast('Dê um nome.'); focar('f-nome'); return; }
    if (t === 'aporte' && !f.destino) { toast('Escolha o investimento (cadastre em Patrimônio).'); return; }
    const item = { id: s.id || uidNovo(), tipo: t, nome, v: lerReais(f.v), vence: clamp(parseInt(f.vence, 10) || 1, 1, 31), cat: t === 'aporte' ? '' : f.cat || (categorias(t)[0] || {}).id || '',
      forma: t === 'saida' ? f.forma : '', cartao: t === 'saida' && f.forma === 'cartao' ? f.cartao : '', carteira: f.carteira || '', destino: t === 'aporte' ? f.destino : '', meta: t === 'aporte' ? f.meta || '' : '',
      ativa: s.id ? !!f.ativa : true, fim: /^\d{4}-\d{2}$/.test(f.fim) ? f.fim : '', nota: String(f.nota || '').trim() };
    item.auto = !!f.auto && (t === 'entrada' || (t === 'saida' && item.forma === 'auto'));
    // A partir de quando lançar sozinho: do mês em que ligou (não preenche o passado)
    item.autoDesde = item.auto ? (f.autoDesde || N_mes(hoje())) : '';
    closeSheet(); enfileirar('salvar', { col: 'contas', item }); if (item.auto) lancarAutomaticos();
    toast(s.id ? 'Atualizado.' : `${nome} cadastrado. Aparece em Contas todo mês, dia ${item.vence}.`);
  },
  saldoPat: () => { S.sheet.f = { modo: 'saldo', saldo: '', dia: hoje() }; renderSheet(); setTimeout(() => focar('f-saldo'), 100); },
  editarPat: () => { S.sheet.f = formPat(S.d.patrimonio.get(S.sheet.id)); renderSheet(); },
  salvarSaldo: () => {
    const s = S.sheet, f = s.f, p = S.d.patrimonio.get(s.id); if (!p) return;
    if (!String(f.saldo).trim()) { toast('Digite o saldo.'); focar('f-saldo'); return; }
    if (!N_dataValida(f.dia)) { toast('Escolha a data.'); return; }
    const hist = [...(p.hist || []), [f.dia, lerReais(f.saldo), new Date().toISOString()]].slice(-120);
    s.f = null; enfileirar('salvar', { col: 'patrimonio', item: { id: p.id, hist } }); renderSheet(); toast('Saldo atualizado.');
  },
  salvarPat: () => {
    const s = S.sheet, f = s.f, nome = f.nome.trim();
    if (!nome) { toast('Dê um nome.'); focar('f-nome'); return; }
    const item = { id: s.id || uidNovo(), nome, classe: f.classe, nat: classe(f.classe).g === 'dividas' ? 'passivo' : 'ativo', inst: String(f.inst || '').trim(),
      taxa: f.taxa ? parseFloat(String(f.taxa).replace(',', '.')) || '' : '', ativo: s.id ? !!f.ativo : true, nota: String(f.nota || '').trim() };
    if (classe(f.classe).g === 'invest') item.aplicado = lerReais(f.aplicado || '');
    if (!s.id) item.hist = [[hoje(), lerReais(f.saldo), new Date().toISOString()]];
    closeSheet(); enfileirar('salvar', { col: 'patrimonio', item }); toast(s.id ? 'Atualizado.' : `${nome} cadastrado.`);
  },
  presetMeta: d => { openSheet({ k: 'meta', f: presetMeta(d.v) }); },
  editarMeta: () => { S.sheet.f = formMeta(S.d.metas.get(S.sheet.id)); renderSheet(); },
  salvarMeta: () => {
    const s = S.sheet, f = s.f, nome = f.nome.trim(), alvo = lerReais(f.alvo);
    if (!nome) { toast('Dê um nome à meta.'); focar('f-nome'); return; }
    if (f.tipo === 'reduzir' && !f.metrica) { toast('Escolha o que reduzir.'); return; }
    if (!alvo && !(f.tipo === 'reduzir' && f.metrica === 'divida')) { toast('Digite o valor da meta.'); focar('f-alvo'); return; }
    if (f.tipo === 'juntar' && f.prazo && !N_dataValida(f.prazo)) { toast('Data inválida.'); return; }
    const item = { id: s.id || uidNovo(), nome, ic: f.ic, tipo: f.tipo, alvo, prazo: f.tipo === 'juntar' ? f.prazo : '', itens: f.itens || [],
      metrica: f.tipo === 'reduzir' ? f.metrica : '', cat: f.metrica === 'cat' ? f.cat : '', nota: String(f.nota || '').trim(), ativa: true };
    if (!s.id) { item.inicio = hoje(); if (item.metrica === 'divida') item.base = valorReduzir(item, N_mes(hoje())); }
    closeSheet(); enfileirar('salvar', { col: 'metas', item }); S.tab = 'financas'; S.fv = 'metas'; render(false);
    toast(s.id ? 'Meta atualizada.' : 'Meta criada. Bora!');
  },
  arquivarMeta: d => { const m = S.d.metas.get(d.id); if (!m) return; closeSheet(); enfileirar('salvar', { col: 'metas', item: { id: m.id, ativa: m.ativa === false } }); toast(m.ativa === false ? 'Meta reativada.' : 'Meta arquivada.'); },
  fgrupo: d => { const c = S.sheet.f.cats[+d.i]; c.grupo = c.grupo === 'essencial' ? 'livre' : 'essencial'; renderSheet(); },
  usarMedia: () => {
    const ref = N_mes(hoje()); let n = 0;
    S.sheet.f.cats.forEach(c => { if (c.tipo === 'saida' && !lerReais(c.orcTxt)) { const m = mediaCategoria(ref, c.id); if (m) { c.orcTxt = reaisInput(Math.ceil(m / 1000) * 1000); n++; } } });
    renderSheet(); toast(n ? `${n} ${plu(n, 'categoria preenchida', 'categorias preenchidas')} com a média.` : 'Ainda não há gastos suficientes para calcular a média.');
  },
  addCat: () => {
    const f = S.sheet.f, nome = String(f.nnome || '').trim();
    if (!nome) { toast('Dê um nome à categoria.'); focar('f-nnome'); return; }
    const id = nome.normalize('NFD').replace(/[^A-Za-z0-9]/g, '').toLowerCase().slice(0, 12) + uidNovo().slice(-4);
    f.cats.push({ id, nome, ic: f.nic, tipo: f.ntipo, grupo: f.ntipo === 'saida' ? f.ngrupo : undefined, orc: 0, orcTxt: '' });
    f.nnome = ''; renderSheet();
  },
  rmCat: d => {
    const f = S.sheet.f, c = f.cats[+d.i]; if (!c) return;
    if (f.cats.filter(x => x.tipo === c.tipo).length < 2) { toast('Precisa ficar pelo menos uma categoria.'); return; }
    const usos = lancs().filter(l => l.cat === c.id).length;
    if (usos && !confirm(`${c.nome} tem ${usos} ${plu(usos, 'lançamento')}. Eles vão aparecer como "Sem categoria". Remover mesmo assim?`)) return;
    f.cats.splice(+d.i, 1); renderSheet();
  },
  salvarOrc: () => {
    const f = S.sheet.f, met = { essencial: +f.met.essencial || 0, livre: +f.met.livre || 0, futuro: +f.met.futuro || 0 };
    if (met.essencial + met.livre + met.futuro !== 100) { toast('A divisão da renda precisa somar 100%.'); return; }
    const cats = f.cats.map(c => ({ id: c.id, nome: String(c.nome || '').trim() || 'Sem nome', ic: c.ic, tipo: c.tipo, ...(c.tipo === 'saida' ? { grupo: c.grupo === 'essencial' ? 'essencial' : 'livre' } : {}), orc: c.tipo === 'saida' ? lerReais(c.orcTxt) : 0 }));
    closeSheet(); enfileirar('casa', { categorias: cats, metodo: met }); toast('Orçamento salvo.');
  }
});
