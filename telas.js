/* telas.js — as cinco telas: Hoje, Casa (afazeres), Pendências, Finanças e Compras. */
'use strict';

function saudacao() { const h = new Date().getHours(); return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; }
const secao = (titulo, extra = '') => `<div class="sec"><h2 class="h2">${titulo}</h2>${extra}</div>`;
const vazio = (em, txt) => `<div class="vazio"><span class="em">${em}</span><span>${txt}</span></div>`;

/* ============================== linhas ============================== */
function tagPrazo(iso, unica) {
  const h = hoje(), n = N_diasEntre(h, iso);
  if (n < 0) return `<span class="tag bad">${n === -1 ? (unica ? 'venceu ontem' : 'desde ontem') : `atrasada ${-n} dias`}</span>`;
  if (n === 0) return '<span class="tag good">hoje</span>';
  return `<span class="tag">${rotuloDia(iso)}</span>`;
}
function quemTxt(t) {
  const q = quemFaz(t);
  if (!q) return '<span>Nós dois</span>';
  return `<span>${av(q, 16)} ${esc(q === S.eu ? 'Você' : primeiroNome(q))}${t.resp === 'rodizio' ? ' <span class="muted">(vez)</span>' : ''}</span>`;
}
function linhaTarefa(t) {
  const tr = t.troca, it = t.itens || [], tags = [];
  if (t.feita) tags.push(`Feita por ${esc(nomeDe(t.feitaPor))} ${rotuloDia(isoLocal(t.feitaEm))}`);
  else {
    if (t.alta) tags.push('<span class="tag warm">importante</span>');
    if (t.prox) tags.push(tagPrazo(t.prox, !t.freq));
    if (t.freq) tags.push(`<span class="tag">${ic('repeat', 12, 2.2)} ${esc(freqTexto(t))}</span>`);
    tags.push(quemTxt(t));
    if (it.length) tags.push(`<span class="tag">${ic('check', 12, 2.4)} ${it.filter(x => x.ok).length}/${it.length}</span>`);
    const na = lista('arquivos').filter(x => x.liga === 'tarefas:' + t.id).length;
    if (na) tags.push(`<span>📎 ${na}</span>`);
    if (tr && tr.st === 'pedida') tags.push(`<span class="tag warm">${ic('swap', 12, 2.2)} troca pedida</span>`);
    if (tr && tr.st === 'aceita') tags.push('<span class="tag warm">trocada</span>');
  }
  const icone = t.ic || (t.area && AREAS[t.area] ? AREAS[t.area][0] : '');
  return `<div class="it${t.feita ? ' feito' : ''}${t.pend ? ' pend' : ''}"><button class="ck${t.feita ? ' on' : ''}" data-a="${t.feita ? 'reabrir' : 'concluir'}" data-id="${t.id}" aria-label="${t.feita ? 'Reabrir' : 'Concluir'} ${esc(t.titulo)}">${ic('check', 18, 2.4)}</button>
    <button class="main" data-a="sheet" data-k="tarefa" data-id="${t.id}"><span class="t">${icone ? esc(icone) + ' ' : ''}${esc(t.titulo)}</span><span class="s">${tags.join('')}</span></button><span></span></div>`;
}
function linhaFeito(f) {
  const a = S.d.tarefas.get(f.afazer), icone = a ? a.ic || (a.area && AREAS[a.area] ? AREAS[a.area][0] : '✔️') : '✔️';
  return `<div class="it feito${f.pend ? ' pend' : ''}"><span class="em-tile">${esc(icone)}</span>
    <div class="main"><span class="t">${esc(f.nome)}</span><span class="s">${av(f.quem, 16)} ${esc(nomeDe(f.quem))} ${f.pulou ? 'pulou esta vez' : ''} · ${rotuloDia(f.dia)}${f.hora ? ' às ' + esc(f.hora) : ''}${!f.pulou ? ` · ${f.peso || 2} ${plu(f.peso || 2, 'pt', 'pts')}` : ''}</span></div>
    ${f.quem === S.eu ? `<button class="mini" data-a="desfazer" data-id="${f.id}" aria-label="Desfazer">${ic('undo', 18)}</button>` : '<span></span>'}</div>`;
}
const listaOu = (itens, fn, vz) => itens.length ? `<div class="lst">${itens.map(fn).join('')}</div>` : vz || '';
function blocoTrocas() {
  const ts = abertas(), pedidas = ts.filter(a => a.troca && a.troca.st === 'pedida' && a.troca.para === S.eu), recusadas = ts.filter(a => a.troca && a.troca.st === 'recusada' && a.troca.de === S.eu);
  return pedidas.map(a => `<div class="troca"><div class="between"><div class="stack" style="gap:2px"><p class="h3">${esc(primeiroNome(a.troca.de))} pediu para você fazer ${esc(a.ic || '')} ${esc(a.titulo)}</p>
      <p class="small muted">${a.troca.motivo ? '“' + esc(a.troca.motivo) + '” · ' : ''}${a.prox ? rotuloDia(a.prox) + '. ' : ''}${a.resp === 'rodizio' ? `No revezamento, a próxima vez fica com ${esc(primeiroNome(a.troca.de))}.` : ''}</p></div>${av(a.troca.de, 32)}</div>
      <div class="hrow"><button class="btn sm" data-a="troca" data-op="aceitar" data-id="${a.id}">Aceitar</button><button class="btn ghost sm" data-a="troca" data-op="recusar" data-id="${a.id}">Recusar</button></div></div>`).join('')
    + recusadas.map(a => `<div class="note"><span>${esc(primeiroNome(a.troca.para))} recusou a troca de <b>${esc(a.titulo)}</b>. Continua com você.</span><button class="link" data-a="troca" data-op="cancelar" data-id="${a.id}">Ok</button></div>`).join('');
}

/* ============================== Hoje ============================== */
function scrHoje() {
  const h = hoje(), o = outro(), amanha = N_somaDias(h, 1);
  const evHoje = eventosDoDia(h), evAmanha = eventosDoDia(amanha).slice(0, 3);
  const minhas = abertas().filter(t => comigo(t) && t.prox && t.prox <= h), doOutro = o ? abertas().filter(t => quemFaz(t) === o.id && t.prox && t.prox <= h) : [];
  const feitosHoje = lista('feitos').filter(f => f.dia === h && f.quem === S.eu).sort((a, b) => String(b.hora).localeCompare(String(a.hora)));
  const ref = N_mes(h), limite = N_somaDias(h, 5);
  const contas = agendaMes(ref).concat(agendaMes(N_somaMes(ref, 1))).filter(x => !x.entrada && x.status !== 'pago' && x.venc <= limite);
  const t = resumoMes(ref), comOrc = categorias('saida').filter(c => c.orc), orc = comOrc.reduce((a, c) => a + c.orc, 0);
  const gastoOrc = comOrc.reduce((a, c) => a + (t.porCat[c.id] || 0), 0);
  const docs = lista('arquivos').filter(a => a.validade && N_diasEntre(h, a.validade) <= 30).sort((a, b) => a.validade.localeCompare(b.validade));
  const ms = metas().slice(0, 2), nCompras = lista('compras').filter(c => !c.comprado).length;
  const partes = [];
  if (evHoje.length) partes.push(`${evHoje.length} ${plu(evHoje.length, 'compromisso')}`);
  partes.push(minhas.length ? `${minhas.length} ${plu(minhas.length, 'tarefa')} com você` : 'nenhuma tarefa sua');
  return `<div class="stack" style="gap:4px"><p class="eb">${fmtData(h)}</p><h1 class="display">${saudacao()}, ${esc(primeiroNome(S.eu))}.</h1><p class="muted">Hoje: ${partes.join(' e ')}${o && doOutro.length ? `. ${esc(primeiroNome(o.id))} tem ${doOutro.length}` : ''}.</p></div>
    ${!o ? `<div class="note warn"><span>Falta chamar a outra pessoa da casa. <button class="link" data-a="convidar">Mandar o convite</button></span></div>` : ''}
    ${COL_INI}${blocoTrocas()}
    ${secao('Agenda de hoje', `<button class="link" data-a="tab" data-v="agenda">Ver agenda</button>`)}
    ${evHoje.length ? listaOu(evHoje, x => linhaEvento(x.e, x.dia)) : `<div class="panel" style="padding:12px 14px;flex-direction:row;align-items:center;justify-content:space-between"><span class="small muted">Nada marcado para hoje.</span><button class="btn ghost sm" data-a="novoEvento">${ic('plus', 15, 2.4)} Marcar</button></div>`}
    ${evAmanha.length ? `<p class="dia-h">Amanhã</p>` + listaOu(evAmanha, x => linhaEvento(x.e, x.dia)) : ''}
    ${secao('Tarefas de hoje', `<button class="link" data-a="tab" data-v="tarefas">Ver todas</button>`)}
    ${minhas.length || feitosHoje.length ? `<div class="lst">${minhas.map(linhaTarefa).join('')}${feitosHoje.map(linhaFeito).join('')}</div>` : `<div class="panel">${vazio('🌿', lista('tarefas').length ? 'Nada pendente com você hoje.' : 'Anote o que precisa ser feito: tarefas únicas ("renovar o seguro") e as que repetem ("lavar a louça", revezando).')}${lista('tarefas').length ? '' : '<button class="btn block" data-a="tab" data-v="tarefas">Montar as tarefas</button>'}</div>`}
    ${o && doOutro.length ? `<p class="small muted">Com ${esc(primeiroNome(o.id))} hoje: ${doOutro.map(a => esc(a.titulo)).join(', ')}.</p>` : ''}
    ${COL_MEIO}
    ${docs.length ? secao('Documentos vencendo', `<button class="link" data-a="tab" data-v="arquivos">Ver arquivos</button>`) + listaOu(docs, a => linhaArquivo(a)) : ''}
    ${contas.length ? secao('Contas a pagar', `<button class="link" data-a="irFin" data-v="contas">Ver todas</button>`) + listaOu(contas, linhaAgenda) : ''}
    <button class="panel" data-a="irFin" data-v="resumo" style="border:0;text-align:left;cursor:pointer;color:inherit;font:inherit">
      <div class="between"><p class="eb">${fmtMes(ref)} até agora</p><span class="muted">${ic('chev', 18)}</span></div>
      <div class="grid2"><div class="stat"><span class="tiny muted">Despesas</span><b>${reais(t.desp)}</b></div><div class="stat"><span class="tiny muted">Saldo do mês</span><b class="${t.saldo < 0 ? 'c-bad' : ''}">${reais(t.saldo)}</b></div></div>
      ${orc ? `<div class="stack" style="gap:6px">${bar(gastoOrc, orc, gastoOrc > orc ? 'var(--bad)' : gastoOrc > orc * .85 ? 'var(--warn)' : 'var(--accent)')}<span class="tiny muted">${reais(gastoOrc)} de ${reais(orc)} nas categorias com orçamento</span></div>` : ''}
    </button>
    ${ms.length ? `<div class="lst">${ms.map(linhaMeta).join('')}</div>` : ''}
    ${nCompras ? `<button class="panel soft" data-a="tab" data-v="compras" style="border:0;text-align:left;cursor:pointer;color:inherit;font:inherit;flex-direction:row;align-items:center"><span class="em-tile" style="background:var(--s1)">🛒</span><span style="flex:1"><b>${nCompras} ${plu(nCompras, 'item', 'itens')}</b> na lista de compras</span>${ic('chev', 18)}</button>` : ''}${COL_FIM}`;
}

/* ============================== Tarefas ============================== */
const AREAS = { casa: ['🏠', 'Casa'], saude: ['🩺', 'Saúde'], docs: ['📄', 'Documentos'], carro: ['🚗', 'Carro'], dinheiro: ['💰', 'Finanças'], filhos: ['👶', 'Filhos'], pets: ['🐾', 'Pets'], trabalho: ['💼', 'Trabalho'], outros: ['📌', 'Outros'] };
const PESOS = [[1, 'Leve'], [2, 'Médio'], [3, 'Pesado']];
/* Ideias para a rotina da casa: começam revezando entre vocês dois */
const SUGESTOES = [
  { titulo: 'Lavar a louça', ic: '🍽️', freq: 'dia', resp: 'rodizio', peso: 2 },
  { titulo: 'Tirar o lixo', ic: '🗑️', freq: 'semana', dias: [1, 3, 5], resp: 'rodizio', peso: 1 },
  { titulo: 'Lavar roupa', ic: '🧺', freq: 'semana', dias: [6], resp: 'rodizio', peso: 2 },
  { titulo: 'Limpar o banheiro', ic: '🛁', freq: 'semana', dias: [6], resp: 'rodizio', peso: 3 },
  { titulo: 'Aspirar e passar pano', ic: '🧹', freq: 'semana', dias: [0], resp: 'rodizio', peso: 3 },
  { titulo: 'Trocar a roupa de cama', ic: '🛏️', freq: 'cada', n: 14, resp: 'rodizio', peso: 2 },
  { titulo: 'Regar as plantas', ic: '🪴', freq: 'cada', n: 3, resp: 'ambos', peso: 1 },
  { titulo: 'Fazer o mercado', ic: '🛒', freq: 'semana', dias: [6], resp: 'ambos', peso: 3 },
  { titulo: 'Limpar a geladeira', ic: '🧊', freq: 'mes', dm: 1, resp: 'rodizio', peso: 2 },
  { titulo: 'Pagar as contas da semana', ic: '💡', freq: 'semana', dias: [1], resp: 'rodizio', peso: 1 }
];
function filtroTarefa(f) {
  if (f === 'casa') return t => !!t.freq;
  if (f === 'ambos') return t => !quemFaz(t);
  if (f === 'todas') return () => true;
  return t => quemFaz(t) === f;
}
function scrTarefas() {
  const h = hoje(), f = S.fTar, filtro = filtroTarefa(f), ab = abertas().filter(filtro);
  const grupos = [
    ['Atrasadas', ab.filter(t => t.prox && t.prox < h)],
    ['Hoje', ab.filter(t => t.prox === h)],
    ['Amanhã', ab.filter(t => t.prox === N_somaDias(h, 1))],
    ['Próximos 7 dias', ab.filter(t => t.prox > N_somaDias(h, 1) && t.prox <= N_somaDias(h, 7))],
    ['Mais adiante', ab.filter(t => t.prox > N_somaDias(h, 7))],
    ['Sem data', ab.filter(t => !t.prox)]
  ].filter(g => g[1].length);
  const feitas = lista('tarefas').filter(t => t.feita && filtro(t)).sort((a, b) => String(b.feitaEm).localeCompare(String(a.feitaEm))).slice(0, 30);
  const desde = S.placar === 'mes' ? N_mes(h) + '-01' : N_segunda(h);
  const doPeriodo = lista('feitos').filter(x => x.dia >= desde && !x.pulou), pts = id => doPeriodo.filter(x => x.quem === id).reduce((a, x) => a + (x.peso || 2), 0);
  const total = doPeriodo.reduce((a, x) => a + (x.peso || 2), 0);
  const recentes = lista('feitos').filter(x => x.dia >= N_somaDias(h, -6)).sort((a, b) => (b.dia + b.hora).localeCompare(a.dia + a.hora)).slice(0, 12);
  const usadas = new Set(lista('tarefas').map(t => t.titulo.toLowerCase()));
  const sug = SUGESTOES.map((x, i) => ({ ...x, i })).filter(x => !usadas.has(x.titulo.toLowerCase()));
  const temRotina = lista('tarefas').some(t => t.freq);
  const chips = [['todas', 'Todas'], [S.eu, 'Minhas'], ...outros().map(p => [p.id, 'De ' + primeiroNome(p.id)]), ['ambos', 'Nós dois'], ['casa', '🔁 Rotina da casa']];
  const placar = S.pessoas.length > 1 ? `<div class="panel"><div class="between"><div class="seg" style="flex:1;max-width:220px">${[['semana', 'Esta semana'], ['mes', 'Este mês']].map(([k, l]) => `<button class="${S.placar === k ? 'on' : ''}" data-a="filtro" data-k="placar" data-v="${k}">${l}</button>`).join('')}</div><span class="tiny muted">${total} ${plu(total, 'ponto')}</span></div>
      <div class="grid2">${S.pessoas.slice(0, 4).map(p => `<div class="hrow" style="gap:10px">${av(p.id, 34)}<div><b class="num" style="font-size:20px;font-family:var(--fd)">${pts(p.id)}</b><p class="tiny muted">${esc(p.id === S.eu ? 'Você' : primeiroNome(p.id))} · ${doPeriodo.filter(x => x.quem === p.id).length} ${plu(doPeriodo.filter(x => x.quem === p.id).length, 'feita')}</p></div></div>`).join('')}</div>
      ${total ? `<div class="split">${S.pessoas.map(p => pts(p.id) ? `<i class="cor-${esc(p.cor)}" style="flex:${pts(p.id)}"></i>` : '').join('')}</div>` : ''}
      <p class="tiny muted">Equilíbrio da casa: cada tarefa concluída vale pelo esforço (leve 1, médio 2, pesado 3).</p></div>` : '';
  return `<div class="between"><h1 class="display">Tarefas</h1><button class="btn sm" data-a="sheet" data-k="tarefa">${ic('plus', 16, 2.4)} Nova</button></div>
    <form data-f="tarefa" class="inrow"><input class="in" id="tartxt" placeholder="O que precisa ser feito?" maxlength="120" autocomplete="off" enterkeyhint="done"><button class="btn" type="submit" aria-label="Adicionar">${ic('plus', 20, 2.4)}</button></form>
    <div class="chips scroll">${chips.map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-a="filtro" data-k="fTar" data-v="${k}">${esc(l)}</button>`).join('')}</div>
    ${COL_INI}${blocoTrocas()}
    ${grupos.map(([t, l]) => secao(t, `<span class="tiny muted">${l.length}</span>`) + listaOu(l, linhaTarefa)).join('')}
    ${!ab.length ? `<div class="panel">${vazio('✅', lista('tarefas').length ? 'Nada pendente aqui.' : 'Tarefas únicas ("marcar o dentista") e as que repetem ("lavar a louça", revezando). Tudo num lugar só.')}</div>` : ''}
    ${feitas.length ? `<details><summary>${secao('Concluídas', `<span class="tiny muted">${feitas.length}</span>`)}</summary>${listaOu(feitas, linhaTarefa)}</details>` : ''}
    ${COL_MEIO}${placar}
    ${sug.length && (f === 'casa' || !temRotina) ? `<div class="panel soft"><p class="h3">Rotina da casa: ideias</p><p class="small muted">Toque para adicionar. Começam revezando entre vocês; depois dá para mudar dia, frequência e quem faz.</p>
      <div class="chips">${sug.map(x => `<button class="chip" data-a="sugestao" data-i="${x.i}">${x.ic} ${esc(x.titulo)}</button>`).join('')}</div></div>` : ''}
    ${recentes.length ? secao('Feitas nos últimos dias') + listaOu(recentes, linhaFeito) : ''}${COL_FIM}`;
}

/* ============================== Compras ============================== */
const SETORES = [['horti', '🥬', 'Hortifrúti'], ['padaria', '🥖', 'Padaria'], ['acougue', '🥩', 'Açougue e peixaria'], ['frios', '🧀', 'Frios e laticínios'],
  ['mercearia', '🍝', 'Mercearia'], ['bebidas', '🥤', 'Bebidas'], ['congelados', '🧊', 'Congelados'], ['limpeza', '🧽', 'Limpeza'], ['higiene', '🧴', 'Higiene'],
  ['pet', '🐾', 'Pet'], ['bebe', '👶', 'Bebê'], ['outros', '🛒', 'Outros']];
const PALAVRAS_SETOR = [
  [/leite condensado|creme de leite|leite de coco|leite em po/, 'mercearia'], [/agua sanitaria|papel toalha|saco de lixo|sabao|detergente|amaciante|desinfetante|esponja|vassoura|multiuso|alvejante|lustra|limpa|rodo|pano de chao|lava.?roupa/, 'limpeza'],
  [/papel higienico|creme dental|pasta de dente|escova de dente|fio dental|sabonete|shampoo|xampu|condicionador|desodorante|absorvente|algodao|cotonete|protetor solar|hidratante|barbeador/, 'higiene'],
  [/fralda|lenco umedecido|pomada|mamadeira/, 'bebe'], [/racao|areia|petisco|sache/, 'pet'],
  [/sorvete|congelad|nuggets|lasanha|polpa|hamburguer|batata palito/, 'congelados'],
  [/agua|refrigerante|refri|suco|cerveja|vinho|energetico|kombucha|agua de coco/, 'bebidas'],
  [/pao|bisnaguinha|bolo|torrada|broa|croissant|sonho/, 'padaria'],
  [/carne|frango|peixe|linguica|bife|picanha|alcatra|patinho|moida|costela|salmao|tilapia|camarao|file|coxa|sobrecoxa|peito de frango|acem|musculo|porco|lombo/, 'acougue'],
  [/leite|queijo|iogurte|manteiga|requeijao|presunto|mortadela|peito de peru|nata|bacon|salame|margarina|ricota/, 'frios'],
  [/banana|maca|laranja|limao|tomate|alface|cebola|alho|batata|cenoura|abacate|mamao|uva|morango|fruta|verdura|legume|pepino|abobrinha|brocolis|couve|manga|melancia|melao|pera|kiwi|cheiro.verde|salsa|coentro|pimentao|beterraba|mandioca|inhame|ovo|rucula|espinafre|abacaxi|maracuja|gengibre/, 'horti'],
  [/arroz|feijao|macarrao|acucar|sal|oleo|azeite|cafe|farinha|molho|biscoito|bolacha|aveia|granola|achocolatado|milho|ervilha|atum|sardinha|tempero|vinagre|fermento|cereal|pipoca|chocolate|geleia|mel|cha|lentilha|grao de bico|tapioca|ketchup|maionese|mostarda|extrato|palmito|azeitona/, 'mercearia']
];
const semAcento = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function setorDe(nome) { const n = semAcento(nome); const x = PALAVRAS_SETOR.find(([re]) => re.test(n)); return x ? x[1] : 'outros'; }
const setor = id => SETORES.find(x => x[0] === id) || SETORES[SETORES.length - 1];
function historicoCompras() { try { return JSON.parse(lsGet('histCompras') || '[]'); } catch (e) { return []; } }
function lembrarCompra(nome) {
  const h = historicoCompras().filter(x => x.toLowerCase() !== nome.toLowerCase());
  h.unshift(nome); lsSet('histCompras', JSON.stringify(h.slice(0, 40)));
}
function linhaCompra(c) {
  return `<div class="it${c.comprado ? ' feito' : ''}${c.pend ? ' pend' : ''}"><button class="ck${c.comprado ? ' on' : ''}" data-a="comprado" data-id="${c.id}" aria-label="${c.comprado ? 'Desmarcar' : 'Marcar'} ${esc(c.item)}">${ic('check', 18, 2.4)}</button>
    <button class="main" data-a="sheet" data-k="compra" data-id="${c.id}"><span class="t">${esc(c.item)}${c.qtd ? ` <span class="muted" style="font-weight:600">· ${esc(c.qtd)}</span>` : ''}</span>${c.comprado ? `<span class="s">${esc(nomeDe(c.compradoPor))} pegou</span>` : c.por && c.por !== S.eu ? `<span class="s">${av(c.por, 14)} ${esc(primeiroNome(c.por))} pediu</span>` : ''}</button>
    <button class="mini" data-a="rmCompra" data-id="${c.id}" aria-label="Tirar ${esc(c.item)} da lista">${ic('x', 18)}</button></div>`;
}
function scrCompras() {
  const todas = compras(), falta = todas.filter(c => !c.comprado), ok = todas.filter(c => c.comprado);
  const naLista = new Set(todas.map(c => c.item.toLowerCase()));
  const hist = historicoCompras().filter(x => !naLista.has(x.toLowerCase())).slice(0, 14);
  const porSetor = SETORES.map(([id, e, n]) => [e, n, falta.filter(c => (c.setor || setorDe(c.item)) === id)]).filter(x => x[2].length);
  return `<div class="between"><h1 class="display">Compras</h1>${falta.length ? `<span class="tag">${falta.length} ${plu(falta.length, 'item', 'itens')}</span>` : ''}</div>
    <form data-f="compra" class="inrow"><input class="in" id="comptxt" placeholder="Ex.: 2 leite, pão, café" maxlength="200" autocomplete="off" enterkeyhint="done"><button class="btn" type="submit" aria-label="Adicionar">${ic('plus', 20, 2.4)}</button></form>
    ${hist.length ? `<div class="chips scroll">${hist.map(x => `<button class="chip" data-a="readd" data-v="${esc(x)}">+ ${esc(x)}</button>`).join('')}</div>` : ''}
    ${porSetor.length ? porSetor.map(([e, n, l]) => `<p class="dia-h">${e} ${n}</p>${listaOu(l, linhaCompra)}`).join('') : `<div class="panel">${vazio('🛒', ok.length ? 'Tudo pego. Bom trabalho!' : 'A lista está vazia. Separe vários itens com vírgula. Ela se organiza pelos corredores do mercado.')}</div>`}
    ${ok.length ? secao('No carrinho', `<span class="tiny muted">${ok.length}</span>`) + listaOu(ok, linhaCompra) +
      `<div class="grid2"><button class="btn ghost" data-a="gastoCompras">${ic('receipt', 16)} Lançar o gasto</button><button class="btn ghost" data-a="limparCompras">${ic('trash', 16)} Limpar</button></div>` : ''}`;
}
