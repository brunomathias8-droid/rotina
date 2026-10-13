/* invest.js — Finanças › Investimentos: análise da carteira (rendimento, concentração, classes e alertas). */
'use strict';

const FGC_LIMITE = 25000000; // R$ 250 mil por CPF por instituição
/* O FGC cobre CDB, LCI, LCA, RDB, poupança e conta. Não cobre Tesouro, fundos, FIIs, ações, exterior, previdência nem cripto. */
const coberturaFgc = p => ['rendafixa', 'reserva'].includes(p.classe) && !/tesouro|deb[eê]nture|\bcri\b|\bcra\b/i.test(p.nome + ' ' + (p.inst || ''));
const instDe = p => String(p.inst || p.nome).trim();
const pctVar = x => (x >= 0 ? '+' : '−') + fmt(Math.abs(x) * 100, 1) + '%';
const ORD_INV = [['saldo', 'Maior saldo'], ['pct', 'Rendimento %'], ['rend', 'Rendimento R$'], ['nome', 'Nome']];

function posicoesInvest() {
  const h = hoje();
  return patrimonio().filter(p => classe(p.classe).g === 'invest' && p.ativo !== false).map(p => {
    const v = valorAtual(p), a = aplicadoEm(p, h), u = ultimaAtualizacao(p);
    return { p, v, a, r: v - a, pct: a > 0 ? (v - a) / a : null, u, dias: u ? N_diasEntre(u, h) : null, inst: instDe(p) };
  });
}
/* Total investido no fim de cada um dos últimos 12 meses */
function serieInvest(pos) {
  const ref = N_mes(hoje()), out = [];
  for (let i = 11; i >= 0; i--) { const m = N_somaMes(ref, -i), D = i ? N_diaDoMes(m, 31) : hoje(); out.push({ ref: m, v: pos.reduce((a, x) => a + valorEm(x.p, D), 0) }); }
  // Só desenha com saldos informados em pelo menos dois meses diferentes (senão a linha seria só a mesma posição repetida)
  const meses = new Set(pos.flatMap(x => (x.p.hist || []).map(h => h[0].slice(0, 7))));
  const ini = out.findIndex(x => x.v); return ini < 0 || meses.size < 2 ? [] : aparaSerie(out.slice(ini), pos.map(x => x.p));
}
function alertasInvest(pos, total) {
  const out = [], porInst = {};
  pos.filter(x => coberturaFgc(x.p)).forEach(x => { const k = normImp(x.inst); porInst[k] = porInst[k] || { nome: x.inst, v: 0 }; porInst[k].v += x.v; });
  Object.values(porInst).filter(i => i.v > FGC_LIMITE).sort((a, b) => b.v - a.v).forEach(i => out.push({ nivel: 'warn',
    txt: `<b>${esc(i.nome)}</b>: ${reais(i.v)} numa instituição só. O FGC garante até R$ 250 mil por CPF por instituição: se estiver no nome de uma pessoa só, ${reais(i.v - FGC_LIMITE)} ficam sem garantia. Dá para dividir entre os CPFs de vocês dois ou levar a diferença para outra instituição.` }));
  const zerados = pos.filter(x => x.v <= 0 && x.a > 0);
  if (zerados.length) out.push({ nivel: 'bad', txt: `<b>${zerados.map(x => esc(x.p.nome)).join(' e ')}</b> ${plu(zerados.length, 'está zerado', 'estão zerados')}, com ${reais(zerados.reduce((a, x) => a + x.a, 0))} aplicados. Se houver ressarcimento do FGC, registre como resgate (Aplicar / resgatar) quando o dinheiro cair.` });
  pos.filter(x => x.v > 0 && x.r < 0).forEach(x => out.push({ nivel: 'warn', txt: `<b>${esc(x.p.nome)}</b> está abaixo do aplicado: ${reais(x.r)} (${pctVar(x.pct)}).${x.p.classe === 'exterior' ? ' No exterior, o câmbio pesa.' : ''}` }));
  const maior = pos.slice().sort((a, b) => b.v - a.v)[0];
  if (maior && total && maior.v / total > .35) out.push({ nivel: 'info', txt: `<b>${esc(maior.inst)}</b> concentra ${Math.round(maior.v / total * 100)}% dos investimentos.` });
  const velhos = pos.filter(x => x.v > 0 && x.dias != null && x.dias > 35);
  if (velhos.length) out.push({ nivel: 'info', txt: `${velhos.length} ${plu(velhos.length, 'posição tem', 'posições têm')} saldo conferido há mais de um mês${velhos.length === pos.filter(x => x.v > 0).length && velhos[0].u ? ` (último: ${fmtCurta(velhos[0].u)})` : ''}. Atualize os saldos para o rendimento ficar fiel.` });
  return out;
}
function linhaPosicao(x, total) {
  const cl = classe(x.p.classe);
  return `<button class="it inv" data-a="sheet" data-k="pat" data-id="${x.p.id}"><span class="em-tile">${esc(x.p.ic || cl.ic)}</span>
    <span class="main"><span class="t">${esc(x.p.nome)}</span><span class="s"><span>${cl.n}</span>${total ? `<span>${fmt(x.v / total * 100, 1)}%</span>` : ''}<span>aplicado ${compacto(x.a)}</span>${x.dias != null && x.dias > 35 && x.v > 0 ? '<span class="tag warn">atualizar</span>' : ''}</span></span>
    <span class="stack" style="gap:2px;align-items:flex-end"><span class="v">${reais(x.v)}</span><span class="small ${x.r > 0 ? 'c-good' : x.r < 0 ? 'c-bad' : 'muted'}">${x.r >= 0 ? '+' : '−'}${reais(Math.abs(x.r))}${x.pct != null ? ` · ${pctVar(x.pct)}` : ''}</span></span></button>`;
}
function barras(lista, total, cor) {
  return lista.map(([nome, v, extra]) => `<div class="stack" style="gap:6px"><div class="between small"><span><b>${nome}</b></span><span class="num">${reais(v)} <span class="tiny muted">${fmt(v / total * 100, 1)}%</span>${extra || ''}</span></div>${bar(v, total, cor)}</div>`).join('');
}

function finInvestimentos() {
  const pos = posicoesInvest();
  if (!pos.length) return `<div class="panel">${vazio('📈', 'Cadastre os investimentos (CDB, Tesouro, FIIs, ações, exterior) com o saldo de hoje e o total aplicado. Aqui aparecem rendimento, concentração e alertas.')}<button class="btn block" data-a="sheet" data-k="pat" data-v="rendafixa">+ Investimento</button></div>`;
  const total = pos.reduce((a, x) => a + x.v, 0), aplic = pos.reduce((a, x) => a + x.a, 0), rend = total - aplic;
  const porClasse = {}, porInst = {};
  pos.forEach(x => { porClasse[x.p.classe] = (porClasse[x.p.classe] || 0) + x.v; const k = normImp(x.inst); porInst[k] = porInst[k] || [x.inst, 0]; porInst[k][1] += x.v; });
  const classes = Object.entries(porClasse).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]).map(([k, v]) => [`${classe(k).ic} ${classe(k).n}`, v]);
  const insts = Object.values(porInst).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]);
  const top3 = insts.slice(0, 3).reduce((a, x) => a + x[1], 0);
  const garantido = pos.filter(x => coberturaFgc(x.p)).reduce((a, x) => a + x.v, 0);
  const ord = S.invOrd || 'saldo', ordenar = { saldo: (a, b) => b.v - a.v, pct: (a, b) => (b.pct ?? -9) - (a.pct ?? -9), rend: (a, b) => b.r - a.r, nome: (a, b) => a.p.nome.localeCompare(b.p.nome) }[ord];
  const lista = pos.slice().sort(ordenar), serie = serieInvest(pos), alertas = alertasInvest(pos, total);
  const ultima = pos.map(x => x.u).filter(Boolean).sort().pop();
  return `${COL_INI}<div class="panel hero"><p class="eb" style="color:inherit;opacity:.8">Total investido${ultima ? ` · saldos até ${fmtCurta(ultima)}` : ''}</p><p class="saldo">${reais(total)}</p>
      <p class="small" style="margin:0">${rend >= 0 ? '▲' : '▼'} <b>${reais(Math.abs(rend))}</b> de rendimento bruto${aplic ? ` (${pctVar(rend / aplic)})` : ''} sobre ${reais(aplic)} aplicados</p>
      <div class="grid3"><div class="stat"><span class="tiny muted">Posições</span><b>${pos.filter(x => x.v > 0).length}</b></div><div class="stat"><span class="tiny muted">Emissores</span><b>${insts.length}</b></div><div class="stat"><span class="tiny muted">Com FGC</span><b>${total ? Math.round(garantido / total * 100) : 0}%</b></div></div></div>
    ${alertas.length ? secao('Pontos de atenção', `<span class="tiny muted">${alertas.length}</span>`) + `<div class="stack">${alertas.map(a => `<div class="note ${a.nivel === 'info' ? '' : a.nivel}"><span>${ic(a.nivel === 'info' ? 'flag' : 'alert', 16)}</span><span style="flex:1">${a.txt}</span></div>`).join('')}</div>` : ''}
    ${secao('Por tipo de investimento')}<div class="panel">${barras(classes, total, 'var(--viz-1)')}</div>
    ${secao('Por emissor', `<span class="tiny muted">3 maiores: ${fmt(top3 / total * 100, 0)}%</span>`)}<div class="panel">${barras(insts.slice(0, 10).map(([n, v]) => [esc(n), v, coberturaFgc(pos.find(x => x.inst === n).p) && v > FGC_LIMITE ? ' <span class="tag warn">acima do FGC</span>' : '']), total, 'var(--viz-3)')}
      ${insts.length > 10 ? `<p class="tiny muted">E mais ${insts.length - 10}: ${reais(insts.slice(10).reduce((a, x) => a + x[1], 0))}</p>` : ''}</div>
    ${COL_MEIO}
    ${secao('Evolução')}<div class="panel">${serie.length > 1 ? grafLinha(serie, 'Total investido mês a mês', 'investido') : '<p class="small muted">O gráfico mês a mês aparece quando houver saldos de pelo menos dois meses. Atualize os saldos todo mês (Patrimônio › item › Atualizar saldo).</p>'}</div>
    ${secao('Posições', `<span class="tiny muted">${pos.length}</span>`)}
    <div class="chips scroll">${ORD_INV.map(([k, n]) => `<button class="chip ${ord === k ? 'on' : ''}" data-a="filtro" data-k="invOrd" data-v="${k}">${n}</button>`).join('')}</div>
    <div class="lst">${lista.map(x => linhaPosicao(x, total)).join('')}</div>
    <p class="tiny muted">Rendimento bruto = saldo − aplicado (aplicado informado no cadastro + aportes − resgates lançados depois). Antes de impostos.</p>
    <div class="grid2"><button class="btn ghost sm" data-a="sheet" data-k="pat" data-v="rendafixa">+ Investimento</button><button class="btn ghost sm" data-a="fv" data-v="patrimonio">Ver patrimônio</button></div>${COL_FIM}`;
}
