/* financas.js — as contas do dinheiro da casa: mês, contas a pagar, faturas, orçamento, metas e patrimônio.
   Só cálculo, nada de tela. Valores sempre em centavos.

   Regras (boas práticas de orçamento familiar):
   - Regime de competência: a despesa conta no mês em que aconteceu (compra parcelada: cada parcela no seu mês),
     não no mês em que a fatura é paga. Assim o orçamento mostra o gasto na hora.
   - Pagar a fatura não é despesa nova (as compras já foram contadas): é uma saída da conta que quita o cartão.
   - Investir não é despesa: é dinheiro que vai da conta para o patrimônio. Conta como "futuro" no 50/30/20.
   - Saldo de conta, investimento e dívida = último valor informado ("atualizar saldo") + movimentos depois dele. */
'use strict';

/* ============================== cadastros ============================== */
const FORMAS = [['pix', 'Pix'], ['debito', 'Débito'], ['cartao', 'Crédito'], ['dinheiro', 'Dinheiro'], ['boleto', 'Boleto'], ['auto', 'Débito automático']];
const formaNome = f => (FORMAS.find(x => x[0] === f) || [f, f || ''])[1];
const CLASSES = {
  conta: { n: 'Conta e dinheiro', ic: '🏦', g: 'contas' },
  reserva: { n: 'Reserva de emergência', ic: '🛟', g: 'invest' },
  rendafixa: { n: 'Renda fixa', ic: '📄', g: 'invest' },
  acoes: { n: 'Ações', ic: '📈', g: 'invest' },
  fiis: { n: 'Fundos imobiliários', ic: '🏢', g: 'invest' },
  fundos: { n: 'Fundos', ic: '🧺', g: 'invest' },
  exterior: { n: 'Exterior', ic: '🌎', g: 'invest' },
  previdencia: { n: 'Previdência', ic: '🧓', g: 'invest' },
  cripto: { n: 'Cripto', ic: '🪙', g: 'invest' },
  imovel: { n: 'Imóvel', ic: '🏡', g: 'bens' },
  veiculo: { n: 'Veículo', ic: '🚗', g: 'bens' },
  outrobem: { n: 'Outro bem', ic: '💎', g: 'bens' },
  financiamento: { n: 'Financiamento', ic: '🏠', g: 'dividas' },
  emprestimo: { n: 'Empréstimo', ic: '💸', g: 'dividas' },
  outradivida: { n: 'Outra dívida', ic: '📉', g: 'dividas' }
};
const GRUPOS_PAT = [['contas', 'Contas e dinheiro'], ['invest', 'Investimentos'], ['bens', 'Bens'], ['dividas', 'Dívidas']];
const classe = id => CLASSES[id] || CLASSES.outrobem;
const ehPassivo = p => classe(p.classe).g === 'dividas';
const patrimonio = () => lista('patrimonio').sort((a, b) => a.nome.localeCompare(b.nome));
const contasBancarias = () => patrimonio().filter(p => p.classe === 'conta' && p.ativo !== false);
const investimentos = () => patrimonio().filter(p => classe(p.classe).g === 'invest' && p.ativo !== false);
const dividas = () => patrimonio().filter(p => ehPassivo(p) && p.ativo !== false);
const cartoes = () => lista('cartoes').filter(c => c.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome));
const nomePat = id => { const p = S.d.patrimonio.get(id); return p ? p.nome : ''; };
const lancs = () => lista('lancamentos');
const recorrentes = () => lista('contas').sort((a, b) => (a.vence || 0) - (b.vence || 0));

/* ============================== o mês ============================== */
/** Mês em que o lançamento mexe no caixa (regime de caixa): compra no cartão conta no mês em que a fatura vence; o resto, na data. */
function mesCaixa(l) {
  const k = l.tipo === 'saida' && l.forma === 'cartao' && S.d.cartoes.get(l.cartao);
  return k ? N_faturaDe(k, l) : N_mes(l.dia);
}
/** Receitas, despesas e investimentos do mês "ref" (regime de caixa), com as despesas por categoria e por grupo do 50/30/20. */
function resumoMes(ref) {
  const r = { rec: 0, desp: 0, inv: 0, recPend: 0, despPend: 0, cartao: 0, porCat: {}, essencial: 0, livre: 0, n: 0 };
  lancs().forEach(l => {
    if (mesCaixa(l) !== ref) return;
    r.n++;
    if (l.tipo === 'entrada') { r.rec += l.v; if (!l.pago) r.recPend += l.v; }
    else if (l.tipo === 'saida') {
      r.desp += l.v; r.porCat[l.cat] = (r.porCat[l.cat] || 0) + l.v;
      if (l.forma === 'cartao') r.cartao += l.v; else if (!l.pago) r.despPend += l.v;
      if (categoria(l.cat).grupo === 'essencial') r.essencial += l.v; else r.livre += l.v;
    }
    else if (l.tipo === 'aporte') r.inv += l.v;
    else if (l.tipo === 'resgate') r.inv -= l.v;
  });
  r.saldo = r.rec - r.desp;
  r.poupanca = r.rec > 0 ? (r.rec - r.desp) / r.rec : null;
  return r;
}
/** Média mensal dos últimos n meses fechados (antes de "ref"). */
function mediaMeses(ref, n, fn) {
  let t = 0; for (let i = 1; i <= n; i++) t += fn(resumoMes(N_somaMes(ref, -i))); return Math.round(t / n);
}
const mesesComDados = () => [...new Set(lancs().map(mesCaixa))].sort();

/* ============================== contas fixas e agenda ============================== */
/** Contas fixas e receitas recorrentes valendo no mês "ref", com o lançamento que pagou cada uma. */
function recorrentesMes(ref) {
  const h = hoje(), feitos = new Map(lancs().filter(l => l.conta && l.ref === ref).map(l => [l.conta, l]));
  return recorrentes().filter(c => c.ativa !== false && (!c.fim || c.fim >= ref) && N_mes(isoLocal(c.em) || h) <= ref).map(c => {
    const venc = N_diaDoMes(ref, c.vence || 1), l = feitos.get(c.id) || null;
    const pago = !!l && (l.pago || l.forma === 'cartao' || l.tipo === 'aporte');
    return { ...c, venc, lanc: l, status: pago ? 'pago' : venc < h ? 'vencido' : 'pendente' };
  });
}
/**
 * Tudo o que entra e sai da conta no mês: contas fixas, lançamentos agendados (não pagos) e faturas de cartão.
 * Cada item: { k: 'rec' | 'lanc' | 'fatura', id, nome, ic, v, venc, entrada, status: 'pago' | 'pendente' | 'vencido' }.
 */
function agendaMes(ref) {
  const h = hoje(), out = [];
  recorrentesMes(ref).forEach(c => {
    if (c.forma === 'cartao' && c.tipo === 'saida' && c.status === 'pago') return; // assinatura no cartão: já está na fatura
    out.push({ k: 'rec', id: c.id, ref, nome: c.nome, ic: c.tipo === 'aporte' ? '📈' : categoria(c.cat).ic, v: c.lanc ? c.lanc.v : c.v, venc: c.venc, entrada: c.tipo === 'entrada', aporte: c.tipo === 'aporte', status: c.status, cartao: c.forma === 'cartao' });
  });
  lancs().forEach(l => {
    if (l.conta || l.pago || l.forma === 'cartao' || N_mes(l.dia) !== ref || (l.tipo !== 'saida' && l.tipo !== 'entrada')) return;
    out.push({ k: 'lanc', id: l.id, nome: l.desc || categoria(l.cat).nome, ic: categoria(l.cat).ic, v: l.v, venc: l.dia, entrada: l.tipo === 'entrada', status: l.dia < h ? 'vencido' : 'pendente' });
  });
  cartoes().forEach(k => {
    const f = fatura(k, ref);
    if (!f.total && !f.pago) return;
    out.push({ k: 'fatura', id: k.id, ref, nome: 'Fatura ' + k.nome, ic: '💳', v: f.total, resta: f.resta, venc: f.venc, entrada: false, status: f.status === 'paga' ? 'pago' : f.status === 'vencida' ? 'vencido' : 'pendente', fatura: f });
  });
  return out.sort((a, b) => a.venc.localeCompare(b.venc));
}
/** O que ainda vai acontecer no mês (para o saldo previsto). */
function previsaoMes(ref) {
  const ag = agendaMes(ref), pend = ag.filter(x => x.status !== 'pago');
  const r = resumoMes(ref), recFalta = pend.filter(x => x.entrada && x.k === 'rec').reduce((a, x) => a + x.v, 0);
  const despFalta = pend.filter(x => x.k === 'rec' && !x.entrada && !x.aporte).reduce((a, x) => a + x.v, 0);
  return { rec: r.rec + recFalta, desp: r.desp + despFalta, saldo: r.rec + recFalta - r.desp - despFalta,
    aPagar: pend.filter(x => !x.entrada).reduce((a, x) => a + (x.resta != null ? x.resta : x.v), 0), aReceber: pend.filter(x => x.entrada).reduce((a, x) => a + x.v, 0) };
}

/* ============================== cartões ============================== */
const ehCompraCartao = (l, k) => l.tipo === 'saida' && l.forma === 'cartao' && l.cartao === k.id;
/** A fatura "ref" (mês do vencimento) de um cartão. */
function fatura(k, ref) {
  const h = hoje(), compras = lancs().filter(l => ehCompraCartao(l, k) && N_faturaDe(k, l) === ref).sort((a, b) => b.dia.localeCompare(a.dia));
  // Pagamento de fatura marcado como "não pago" fica agendado: não abate a fatura até ser marcado como pago
  const todos = lancs().filter(l => l.tipo === 'fatura' && l.cartao === k.id && l.ref === ref), pagamentos = todos.filter(l => l.pago), agendados = todos.filter(l => !l.pago);
  const total = compras.reduce((a, l) => a + l.v, 0), pago = pagamentos.reduce((a, l) => a + l.v, 0);
  const fecha = N_fechamento(k, ref), venc = N_vencimento(k, ref), resta = Math.max(0, total - pago);
  const status = total > 0 && resta === 0 ? 'paga' : h < fecha ? 'aberta' : h > venc ? (resta ? 'vencida' : 'paga') : 'fechada';
  return { ref, compras, pagamentos, agendados, total, pago, resta, fecha, venc, status };
}
const faturaAtual = k => fatura(k, N_faturaRef(k, hoje()));
/** Fatura que precisa de atenção agora: a fechada ainda não paga ou, se não houver, a aberta. */
function faturaDaVez(k) {
  const atual = N_faturaRef(k, hoje()), ant = fatura(k, N_somaMes(atual, -1));
  return ant.resta > 0 ? ant : fatura(k, atual);
}
/** Limite usado: tudo o que foi comprado (inclusive parcelas futuras) menos o que já foi pago. */
function limiteUsado(k) {
  let c = 0, p = 0;
  lancs().forEach(l => { if (ehCompraCartao(l, k)) c += l.v; if (l.tipo === 'fatura' && l.cartao === k.id && l.pago) p += l.v; });
  return Math.max(0, c - p);
}
/** Parcelas já compradas que caem nas próximas faturas (compromisso futuro). */
function parcelasFuturas(k, n) {
  const ref0 = N_faturaRef(k, hoje()), out = [];
  for (let i = 1; i <= n; i++) { const ref = N_somaMes(ref0, i), f = fatura(k, ref); out.push({ ref, total: f.total }); }
  return out;
}
/** Total das faturas de todos os cartões que vencem no mês "ref". */
const faturasDoMes = ref => cartoes().reduce((a, k) => a + fatura(k, ref).total, 0);

/* ============================== patrimônio ============================== */
/** Movimentos que mudam o valor de um item depois do último saldo informado: [dia, criadoEm, delta]. */
function movimentos(id) {
  const out = [];
  lancs().forEach(l => {
    let d = 0;
    if (l.tipo === 'entrada' && l.carteira === id && l.pago) d = l.v;
    else if (l.tipo === 'saida' && l.forma !== 'cartao' && l.pago && l.carteira === id) d = -l.v;
    else if (l.tipo === 'fatura' && l.pago && l.carteira === id) d = -l.v;
    else if (l.tipo === 'aporte') d = l.carteira === id ? -l.v : l.destino === id ? l.v : 0;
    else if (l.tipo === 'resgate') d = l.carteira === id ? l.v : l.destino === id ? -l.v : 0;
    else if (l.tipo === 'transf') d = l.carteira === id ? -l.v : l.destino === id ? l.v : 0;
    if (l.tipo === 'saida' && l.destino === id) d -= l.v; // pagamento que abate uma dívida
    if (d) out.push([l.dia, l.em || '', d, l]);
  });
  return out;
}
/**
 * Quanto foi aplicado num investimento até o dia D (o custo, para calcular o rendimento): o total aplicado informado
 * (vale na data do primeiro saldo) + aportes − resgates lançados depois dela. Sem total informado, o primeiro saldo é a base.
 */
function aplicadoEm(p, D) {
  const hist = (p.hist || []).slice().sort((a, b) => a[0].localeCompare(b[0]));
  if (!hist.length) return 0;
  const base = hist[0][0];
  let v = p.aplicado ? p.aplicado : hist[0][1];
  lancs().forEach(l => {
    if (l.destino !== p.id || l.dia <= base || l.dia > D) return;
    if (l.tipo === 'aporte') v += l.v; else if (l.tipo === 'resgate') v -= l.v;
  });
  return v;
}
/** Valor de um item no fim do dia "D". Dívidas ficam positivas (o quanto se deve). */
function valorEm(p, D) {
  const hist = (p.hist || []).filter(x => x[0] <= D).sort((a, b) => a[0].localeCompare(b[0]) || String(a[2] || '').localeCompare(String(b[2] || '')));
  if (!hist.length) return 0;
  const base = hist[hist.length - 1];
  return movimentos(p.id).reduce((a, [dia, em, d]) => (dia > base[0] || (dia === base[0] && em > (base[2] || ''))) && dia <= D ? a + d : a, base[1]);
}
const valorAtual = p => valorEm(p, hoje());
const ultimaAtualizacao = p => ((p.hist || []).map(x => x[0]).sort().pop()) || '';
/**
 * Saldo devedor do cartão no dia D: compras feitas até D (com todas as parcelas, mesmo as que vencem depois) menos pagamentos até D.
 * Parcela futura já é dívida: o dinheiro está comprometido desde o dia da compra.
 */
function dividaCartaoEm(k, D) {
  const compraEm = {};
  lancs().forEach(l => { if (l.grupo && ehCompraCartao(l, k) && (!compraEm[l.grupo] || l.dia < compraEm[l.grupo])) compraEm[l.grupo] = l.dia; });
  let c = 0;
  lancs().forEach(l => {
    if (ehCompraCartao(l, k) && (l.grupo ? compraEm[l.grupo] : l.dia) <= D) c += l.v;
    if (l.tipo === 'fatura' && l.cartao === k.id && l.pago && l.dia <= D) c -= l.v;
  });
  return Math.max(0, c);
}
/** Situação no dia D por grupo. liquido = o patrimônio da família, que é só a soma dos investimentos. */
function patrimonioEm(D) {
  const r = { contas: 0, invest: 0, bens: 0, dividas: 0, cartoes: 0 };
  lista('patrimonio').filter(p => p.ativo !== false).forEach(p => { r[classe(p.classe).g] += valorEm(p, D); });
  r.cartoes = cartoes().reduce((a, k) => a + dividaCartaoEm(k, D), 0);
  r.ativos = r.contas + r.invest + r.bens; r.passivos = r.dividas + r.cartoes;
  // Patrimônio da família = só os investimentos. Conta corrente, saldo do mês, bens, dívidas e cartões ficam de fora:
  // ele só se move com rendimentos (saldo atualizado), renda passiva, aportes e resgates.
  r.liquido = r.invest;
  return r;
}
/** Patrimônio (investimentos) no fim de cada um dos últimos n meses (o mês atual vale até hoje). */
function seriePatrimonio(n) {
  const h = hoje(), ref = N_mes(h), out = [], ini = inicioPatrimonio();
  for (let i = n - 1; i >= 0; i--) {
    const m = N_somaMes(ref, -i); if (ini && m < N_mes(ini)) continue; // antes do primeiro registro não há o que mostrar
    out.push({ ref: m, v: patrimonioEm(i === 0 ? h : N_diaDoMes(m, 31)).liquido });
  }
  return aparaSerie(out, lista('patrimonio').filter(p => classe(p.classe).g === 'invest'));
}
/** Data do primeiro saldo informado (ou da primeira compra no cartão): o começo da história do patrimônio. */
function inicioPatrimonio() {
  const datas = lista('patrimonio').filter(p => classe(p.classe).g === 'invest').flatMap(p => (p.hist || []).map(x => x[0]));
  return datas.length ? datas.sort()[0] : '';
}
/** Último mês com saldo informado ou movimento: depois dele a linha seria só o mesmo valor repetido, então o gráfico para ali. */
function fimDaHistoria(ps) {
  const h = hoje(), datas = ps.flatMap(p => (p.hist || []).map(x => x[0]).concat(movimentos(p.id).map(x => x[0]))).filter(d => d && d <= h);
  return datas.length ? N_mes(datas.sort().pop()) : N_mes(h);
}
const aparaSerie = (serie, ps) => { const fim = fimDaHistoria(ps); return serie.filter(x => x.ref <= fim); };
/** Rendimento estimado de um investimento no mês: variação do valor menos o que entrou e saiu. */
function rendimentoMes(p, ref) {
  const fim = N_diaDoMes(ref, 31), ini = N_diaDoMes(N_somaMes(ref, -1), 31);
  if (!(p.hist || []).some(x => x[0] <= ini)) return null;
  // Renda passiva (receita que cai no investimento) é retorno: não sai do rendimento como aporte e resgate saem
  const fluxo = movimentos(p.id).filter(([d, , , l]) => d > ini && d <= fim && l.tipo !== 'entrada').reduce((a, x) => a + x[2], 0);
  return valorEm(p, fim) - valorEm(p, ini) - fluxo;
}

/* ============================== orçamento ============================== */
const metodo = () => (S.casa && S.casa.metodo) || { essencial: 50, livre: 30, futuro: 20 };
/** Como a renda do mês foi dividida: % em essenciais, estilo de vida e futuro. */
function divisaoRenda(ref) {
  const r = resumoMes(ref), base = r.rec || 0, pct = v => base ? v / base * 100 : 0;
  return { base, essencial: r.essencial, livre: r.livre, futuro: Math.max(0, r.inv), pct: { essencial: pct(r.essencial), livre: pct(r.livre), futuro: pct(Math.max(0, r.inv)) } };
}
const mediaCategoria = (ref, cat, n = 3) => mediaMeses(ref, n, r => r.porCat[cat] || 0);
/** Categorias que passaram ou estão perto de passar do orçamento no mês. */
function alertasOrcamento(ref) {
  const r = resumoMes(ref), h = hoje(), fimMes = N_diaDoMes(ref, 31);
  const fracMes = ref === N_mes(h) ? (Number(h.slice(8)) / Number(fimMes.slice(8))) : 1;
  return categorias('saida').filter(c => c.orc).map(c => ({ c, g: r.porCat[c.id] || 0 }))
    .filter(x => x.g > x.c.orc || (x.g > x.c.orc * .85 && fracMes < .85))
    .map(x => ({ ...x, estourou: x.g > x.c.orc }));
}

/* ============================== metas ============================== */
const metas = () => lista('metas').filter(m => m.ativa !== false).sort((a, b) => String(a.em).localeCompare(String(b.em)));
const META_TIPOS = { juntar: 'Juntar um valor', mensal: 'Investir todo mês', reduzir: 'Reduzir' };
const METRICAS = { cartao: 'Fatura do cartão por mês', cat: 'Gasto de uma categoria por mês', divida: 'Saldo de dívidas' };
/** Aportes líquidos do mês que contam para a meta (se ela não tiver investimentos escolhidos, conta tudo). */
function aportesMeta(m, ref) {
  return lancs().reduce((a, l) => {
    if (N_mes(l.dia) !== ref || (l.tipo !== 'aporte' && l.tipo !== 'resgate')) return a;
    const conta = l.meta === m.id || (m.itens && m.itens.length ? m.itens.includes(l.destino) : m.tipo === 'mensal');
    return conta ? a + (l.tipo === 'aporte' ? l.v : -l.v) : a;
  }, 0);
}
/** Valor medido de uma meta "reduzir" num mês. */
function valorReduzir(m, ref) {
  // Soma das faturas que vencem no mês (todos os cartões): é o valor que se vê no banco e que sai da conta (regime de caixa, como o resumo).
  if (m.metrica === 'cartao') return faturasDoMes(ref);
  if (m.metrica === 'cat') return resumoMes(ref).porCat[m.cat] || 0;
  const fim = ref === N_mes(hoje()) ? hoje() : N_diaDoMes(ref, 31);
  return (m.itens || []).reduce((a, id) => { const p = S.d.patrimonio.get(id); return a + (p ? valorEm(p, fim) : 0); }, 0);
}
/**
 * Situação de uma meta: { atual, alvo, pct (0–1), status: 'concluida' | 'ok' | 'atencao', linha (texto), serie (últimos 6 meses) }.
 */
function progressoMeta(m) {
  const h = hoje(), ref = N_mes(h), alvo = m.alvo || 0;
  if (m.tipo === 'mensal') {
    const serie = []; for (let i = 5; i >= 0; i--) { const r = N_somaMes(ref, -i); serie.push({ ref: r, v: aportesMeta(m, r) }); }
    const atual = serie[5].v, seguidos = (() => { let n = 0; for (let i = 4; i >= 0 && serie[i].v >= alvo; i--) n++; return n; })();
    const diaMes = Number(h.slice(8));
    return { atual, alvo, pct: alvo ? clamp(atual / alvo, 0, 1) : 0, serie, seguidos,
      status: atual >= alvo ? 'concluida' : diaMes >= 20 ? 'atencao' : 'ok',
      linha: atual >= alvo ? `Meta do mês cumprida${seguidos ? ` · ${seguidos + 1} meses seguidos` : ''}` : `Faltam ${reais(alvo - atual)} este mês` };
  }
  if (m.tipo === 'reduzir') {
    const serie = []; for (let i = 5; i >= 0; i--) { const r = N_somaMes(ref, -i); serie.push({ ref: r, v: valorReduzir(m, r) }); }
    const atual = serie[5].v;
    if (m.metrica === 'divida') {
      const base = Math.max(m.base || 0, alvo + 1), pct = clamp((base - atual) / (base - alvo), 0, 1);
      return { atual, alvo, pct, serie, status: atual <= alvo ? 'concluida' : 'ok', linha: atual <= alvo ? 'Dívida quitada' : `Ainda deve ${reais(atual)}` };
    }
    const ant = serie[4].v;
    // Barra = quanto do limite já foi usado: cheia e vermelha quando passa
    return { atual, alvo, pct: alvo ? clamp(atual / alvo, 0, 1) : 0, cor: atual > alvo ? 'var(--bad)' : alvo && atual > alvo * .85 ? 'var(--warn)' : 'var(--accent)', serie, anterior: ant,
      status: atual <= alvo ? (ant <= alvo ? 'concluida' : 'ok') : 'atencao',
      linha: atual <= alvo ? `Dentro do limite: ${reais(atual)} de ${reais(alvo)}` : `Passou ${reais(atual - alvo)} do limite` };
  }
  // juntar
  const atual = m.itens && m.itens.length
    ? m.itens.reduce((a, id) => { const p = S.d.patrimonio.get(id); return a + (p ? valorAtual(p) : 0); }, 0)
    : lancs().reduce((a, l) => l.meta === m.id ? a + (l.tipo === 'aporte' ? l.v : l.tipo === 'resgate' ? -l.v : 0) : a, 0);
  const pct = alvo ? clamp(atual / alvo, 0, 1) : 0;
  if (atual >= alvo) return { atual, alvo, pct: 1, status: 'concluida', linha: 'Meta alcançada' };
  if (!m.prazo) return { atual, alvo, pct, status: 'ok', linha: `Faltam ${reais(alvo - atual)}` };
  const meses = Math.max(1, (Number(m.prazo.slice(0, 4)) - Number(ref.slice(0, 4))) * 12 + Number(m.prazo.slice(5, 7)) - Number(ref.slice(5, 7)));
  const ini = m.inicio || isoLocal(m.em) || h, total = Math.max(1, N_diasEntre(ini, m.prazo)), esperado = clamp(N_diasEntre(ini, h) / total, 0, 1);
  return { atual, alvo, pct, porMes: Math.ceil((alvo - atual) / meses), meses,
    status: m.prazo < h ? 'atencao' : pct + .05 >= esperado ? 'ok' : 'atencao',
    linha: m.prazo < h ? 'O prazo passou' : `Guardar ${reais(Math.ceil((alvo - atual) / meses))} por mês até ${fmtMesCurto(m.prazo)}` };
}
const fmtMesCurto = iso => MESES[+iso.slice(5, 7) - 1].slice(0, 3) + '/' + iso.slice(2, 4);

/** Reserva de emergência sugerida: 6 meses das despesas essenciais (média dos últimos 3 meses). */
const reservaSugerida = () => 6 * mediaMeses(N_mes(hoje()), 3, r => r.essencial);

/* ============================== alertas ============================== */
/** Avisos do momento, do mais urgente ao menos: { nivel: 'bad' | 'warn' | 'info', txt, acao? }. */
function alertasFinanceiros() {
  const h = hoje(), ref = N_mes(h), out = [];
  agendaMes(ref).concat(agendaMes(N_somaMes(ref, 1))).forEach(x => {
    if (x.entrada || x.status === 'pago') return;
    const n = N_diasEntre(h, x.venc);
    if (x.status === 'vencido') out.push({ nivel: 'bad', txt: `${x.nome} venceu ${rotuloDia(x.venc)}`, acao: x });
    else if (n <= 3) out.push({ nivel: 'warn', txt: `${x.nome} vence ${rotuloDia(x.venc)} · ${reais(x.resta != null ? x.resta : x.v)}`, acao: x });
  });
  alertasOrcamento(ref).forEach(({ c, g, estourou }) => out.push({ nivel: estourou ? 'bad' : 'warn', txt: estourou ? `${c.nome} passou ${reais(g - c.orc)} do orçamento` : `${c.nome} já usou ${Math.round(g / c.orc * 100)}% do orçamento` }));
  metas().forEach(m => { const p = progressoMeta(m); if (p.status === 'atencao') out.push({ nivel: 'info', txt: `${m.nome}: ${p.linha.toLowerCase()}`, meta: m.id }); });
  const velhos = investimentos().filter(p => { const u = ultimaAtualizacao(p); return u && N_diasEntre(u, h) > 35; });
  if (velhos.length) out.push({ nivel: 'info', txt: `Atualize o saldo de ${velhos.length === 1 ? velhos[0].nome : velhos.length + ' investimentos'} (mais de um mês sem conferir)` });
  return out;
}

/* ============================== categorias aprendidas ============================== */
/** Chave da loja: "PG *HEALTH CENTER LTDA 03/10" → "health center ltda". Igual para o mesmo estabelecimento em faturas diferentes. */
function lojaDe(desc) {
  const t = String(desc || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/^(pg|mp|pag|ec|sumup|picpay|pp|iz|sq|dl|ebn|htm|pagseguro|mercadopago)\s*\*\s*/, '')
    .replace(/\d+\s*\/\s*\d+/g, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  return t.split(' ').slice(0, 3).join(' ');
}
const regrasCat = () => (S.casa && S.casa.regras) || {};
const CAT_VAGA = id => !id || id === 'outros' || !categorias().some(c => c.id === id);
const aConfirmar = l => /categoria a confirmar/i.test(l.nota || '');
/** Lançamento que precisa de uma olhada: despesa sem categoria (ou "outros") ou marcada como "categoria a confirmar". */
// "É outros mesmo" fica guardado como regra da loja = outros: aí não volta para a fila
const aRevisar = l => l.tipo === 'saida' && ((CAT_VAGA(l.cat) && !(l.cat === 'outros' && regrasCat()[lojaDe(l.desc)] === 'outros')) || aConfirmar(l));
/** Categoria provável de uma despesa: regra da casa, depois o que vocês mais usaram para a mesma loja. Vazio se não souber. */
function sugerirCat(desc, ignorar) {
  const k = lojaDe(desc); if (!k) return '';
  const r = regrasCat()[k]; if (r && !CAT_VAGA(r)) return r;
  const n = {};
  lancs().forEach(l => { if (l.tipo === 'saida' && l.id !== ignorar && !CAT_VAGA(l.cat) && !aConfirmar(l) && lojaDe(l.desc) === k) n[l.cat] = (n[l.cat] || 0) + 1; });
  return Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}
/** Grupos da fila Revisar: uma linha por loja, com todos os lançamentos dela e a sugestão. */
function filaRevisar() {
  const g = new Map();
  lancs().filter(aRevisar).sort((a, b) => b.dia.localeCompare(a.dia)).forEach(l => {
    const k = lojaDe(l.desc) || l.id;
    if (!g.has(k)) g.set(k, { k, nome: l.desc || 'Sem descrição', ls: [], v: 0 });
    const x = g.get(k); x.ls.push(l); x.v += l.v;
  });
  return [...g.values()].map(x => ({ ...x, sug: sugerirCat(x.ls[0].desc) || (typeof pistaCat === 'function' ? pistaCat(x.ls[0].desc) : '') })).sort((a, b) => b.ls.length - a.ls.length || b.v - a.v);
}
/** Aplica a categoria a todos os lançamentos da mesma loja que estão para revisar e guarda a regra para as próximas importações. */
function categorizarLoja(desc, cat, alemDe) {
  const k = lojaDe(desc), ls = lancs().filter(l => l.tipo === 'saida' && (l.id === alemDe || (k && aRevisar(l) && lojaDe(l.desc) === k)));
  const itens = ls.map(l => ({ id: l.id, cat, nota: aConfirmar(l) ? String(l.nota).replace(/;?\s*categoria a confirmar/i, '').trim() : l.nota || '' }));
  for (let i = 0; i < itens.length; i += 60) { const p = itens.slice(i, i + 60); if (p.length === 1) enfileirar('salvar', { col: 'lancamentos', item: p[0] }); else enfileirar('lote', { col: 'lancamentos', itens: p }); }
  if (k && regrasCat()[k] !== cat) enfileirar('casa', { regras: { [k]: cat } });
  return itens.length;
}

/* ============================== duplicados ============================== */
/** Possíveis lançamentos repetidos (mesmo dia, valor, loja e cartão, de compras diferentes): sinal de fatura importada duas vezes. */
function possiveisDuplicados() {
  let ign = []; try { ign = JSON.parse(lsGet('dupOk') || '[]'); } catch (e) { /* vazio */ }
  const m = new Map(), out = [];
  lancs().filter(l => l.tipo === 'saida').forEach(l => {
    const k = [l.dia, l.v, lojaDe(l.desc), l.cartao || l.carteira || '', l.parc || ''].join('|');
    if (!m.has(k)) m.set(k, []); m.get(k).push(l);
  });
  m.forEach((ls, k) => { if (ls.length > 1 && !ign.includes(k) && !(ls[0].grupo && ls.every(l => l.grupo === ls[0].grupo))) out.push({ k, ls }); });
  return out.sort((a, b) => b.ls[0].dia.localeCompare(a.ls[0].dia));
}

/* ============================== lançamentos automáticos ============================== */
/** Contas fixas que entram sozinhas no dia: receitas e débito automático. Cartão fica de fora (já vem na fatura). */
const contaAuto = c => c.auto && c.ativa !== false && (c.tipo === 'entrada' || (c.tipo === 'saida' && c.forma === 'auto'));
const idAuto = (c, ref) => ('au' + c.id + ref.replace('-', '')).slice(0, 40);
/** Depois de sincronizar: lança como recebido/pago o que venceu neste mês e no anterior (a partir do mês em que ligou). Mesmo ID nos dois aparelhos: não duplica. */
function lancarAutomaticos() {
  if (!S.sessao) return;
  const h = hoje(), atual = N_mes(h), novos = [];
  let tentados = []; try { tentados = JSON.parse(lsGet('autoFeitos') || '[]'); } catch (e) { /* vazio */ }
  recorrentes().filter(contaAuto).forEach(c => {
    [N_somaMes(atual, -1), atual].forEach(ref => {
      if (c.autoDesde && ref < c.autoDesde) return;
      if (c.fim && ref > c.fim) return;
      const venc = N_diaDoMes(ref, c.vence || 1), id = idAuto(c, ref);
      if (venc > h || tentados.includes(id) || S.d.lancamentos.has(id) || lancs().some(l => l.conta === c.id && l.ref === ref)) return;
      novos.push({ id, tipo: c.tipo, v: c.v, dia: venc, desc: c.nome, cat: c.cat, forma: c.tipo === 'saida' ? 'auto' : '', cartao: '', carteira: c.carteira || (contasBancarias()[0] || {}).id || '',
        pago: true, destino: '', meta: '', conta: c.id, ref, nota: 'Lançado sozinho no dia' });
      tentados.push(id);
    });
  });
  if (!novos.length) return;
  lsSet('autoFeitos', JSON.stringify(tentados.slice(-200)));
  if (novos.length === 1) enfileirar('salvar', { col: 'lancamentos', item: novos[0] }); else enfileirar('lote', { col: 'lancamentos', itens: novos });
}

/* ============================== reembolsos e projetos ============================== */
/** Despesas pagas por vocês que outra pessoa vai devolver, por pessoa. */
function aReceberDeTerceiros() {
  const g = {};
  lancs().filter(l => l.tipo === 'saida' && l.reemb && !l.reembOk).forEach(l => { const k = l.reemb.trim(); g[k] = g[k] || { nome: k, ls: [], v: 0 }; g[k].ls.push(l); g[k].v += l.v; });
  return Object.values(g).sort((a, b) => b.v - a.v);
}
const projetos = () => [...new Set(lancs().map(l => (l.proj || '').trim()).filter(Boolean))].sort();
const nomesReembolso = () => [...new Set(lancs().map(l => (l.reemb || '').trim()).filter(Boolean))].sort();
