/* paineis.js — painéis que sobem de baixo: ver e editar afazeres, pendências, lançamentos, contas fixas, orçamento e perfil.
   Formulários guardam o que foi digitado em S.sheet.f; assim um toque num botão (que redesenha o painel) não apaga nada. */
'use strict';

const SH = {};
const head = (eb, title, extra = '') => `<div class="sh-h"><div style="min-width:0">${eb ? `<p class="eb">${eb}</p>` : ''}<p class="h1">${title}</p>${extra}</div><button class="x" data-a="close" aria-label="Fechar">${ic('x', 18)}</button></div>`;
const campo = (lab, html) => `<label class="lab"><span>${lab}</span>${html}</label>`;
const grupo = (lab, html) => `<div class="lab"><span>${lab}</span>${html}</div>`;
const inp = (k, val, extra = '') => `<input class="in" id="f-${k}" data-i="${k}" value="${esc(val == null ? '' : val)}" ${extra}>`;
const area = (k, val, extra = '') => `<textarea class="in" id="f-${k}" data-i="${k}" ${extra}>${esc(val || '')}</textarea>`;
const escolha = (k, atual, opcoes) => `<div class="chips">${opcoes.map(([v, l]) => `<button class="chip ${String(atual) === String(v) ? 'on' : ''}" data-a="f" data-k="${k}" data-v="${esc(v)}">${l}</button>`).join('')}</div>`;
const segm = (k, atual, opcoes) => `<div class="seg">${opcoes.map(([v, l]) => `<button class="${atual === v ? 'on' : ''}" data-a="f" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
const sumiu = t => head('', t) + vazio('🤷', 'Isso foi excluído.');
const criadoPor = x => x && x.por ? `<p class="tiny muted">Criado por ${x.por === S.eu ? 'você' : esc(nomeDe(x.por))}${x.em ? ' em ' + fmtCurta(isoLocal(x.em)) : ''}.</p>` : '';
const pessoasOpc = (eu = 'Eu') => [[S.eu, eu], ...outros().map(p => [p.id, esc(primeiroNome(p.id))])];

/* ============================== afazeres ============================== */
const EMOJIS_AFAZER = ['🧹', '🍽️', '🗑️', '🧺', '👕', '🛁', '🚽', '🛏️', '🧽', '🪟', '🪴', '🐶', '🐱', '🍳', '🛒', '🧊', '🚗', '💡', '🔧', '👶', '📦', '🧴', '🌿', '🏠'];
function formAfazer(a) {
  const dHoje = N_dataObj(hoje());
  if (a) return { nome: a.nome, ic: a.ic || '🏠', freq: a.freq || 'dia', dias: N_diasSemana(a), n: a.n || 7, dm: a.dm || dHoje.getDate(), resp: a.resp || 'ambos', vez: a.vez || S.eu, prox: a.prox || hoje(), nota: a.nota || '' };
  return { nome: '', ic: '🧹', freq: 'semana', dias: [dHoje.getDay()], n: 7, dm: dHoje.getDate(), resp: 'rodizio', vez: S.eu, prox: hoje(), nota: '' };
}
function recalcProx(s) { if (!s.proxManual) s.f.prox = N_primeira(s.f, hoje()); }
SH.afazer = s => {
  const a = s.id && S.d.afazeres.get(s.id);
  if (s.id && !a) return sumiu('Afazer');
  if (a && !s.f) return verAfazer(a);
  if (!s.f) s.f = formAfazer(a);
  return editarAfazer(s, a);
};
function verAfazer(a) {
  const q = quemFaz(a), t = a.troca, o = outros();
  const podeTrocar = o.length && a.resp !== 'ambos' && q === S.eu && !(t && t.st === 'pedida');
  const hist = feitosDe(a.id).sort((x, y) => (y.dia + y.hora).localeCompare(x.dia + x.hora)).slice(0, 8);
  return `${head(freqTexto(a), `${esc(a.ic || '🏠')} ${esc(a.nome)}`)}
    <div class="panel soft"><div class="between"><span class="small muted">Próxima vez</span><span class="hrow">${tagPrazo(a.prox)}<span class="small">${fmtCurta(a.prox)}</span></span></div>
      <div class="between"><span class="small muted">Quem faz</span><span class="hrow">${q ? av(q, 22) + ' ' + esc(nomeDe(q)) : 'Qualquer um'}</span></div>
      ${a.resp === 'rodizio' ? '<p class="tiny muted">Rodízio: quem faz passa a vez para o outro.</p>' : ''}</div>
    ${t && t.st === 'pedida' ? `<div class="note warn"><span>${t.de === S.eu ? `Você pediu para ${esc(primeiroNome(t.para))} fazer esta vez. Esperando resposta.` : `${esc(primeiroNome(t.de))} pediu para você fazer esta vez.`}</span></div>` : ''}
    ${t && t.st === 'aceita' ? `<div class="note"><span>${esc(primeiroNome(t.para))} aceitou fazer esta vez no lugar de ${esc(primeiroNome(t.de))}.</span></div>` : ''}
    ${a.nota ? `<p class="small">${esc(a.nota)}</p>` : ''}
    <button class="btn block" data-a="concluir" data-id="${a.id}" data-fechar="1">${ic('check', 18, 2.4)} Marcar como feito</button>
    ${podeTrocar ? `<button class="btn ghost block" data-a="sheet" data-k="troca" data-id="${a.id}">${ic('swap', 18)} Pedir para ${o.length === 1 ? esc(primeiroNome(o[0].id)) : 'outra pessoa'} fazer</button>` : ''}
    ${t && t.st === 'pedida' && t.para === S.eu ? `<div class="grid2"><button class="btn" data-a="troca" data-op="aceitar" data-id="${a.id}">Aceitar</button><button class="btn ghost" data-a="troca" data-op="recusar" data-id="${a.id}">Recusar</button></div>` : ''}
    ${t && t.st === 'pedida' && t.de === S.eu ? `<button class="btn ghost block" data-a="troca" data-op="cancelar" data-id="${a.id}">Cancelar o pedido de troca</button>` : ''}
    ${hist.length ? secao('Histórico') + listaOu(hist, linhaFeito) : ''}
    <div class="between">${criadoPor(a)}<button class="btn ghost sm" data-a="editar">${ic('edit', 16)} Editar</button></div>`;
}
function editarAfazer(s, a) {
  const f = s.f;
  const resps = [['rodizio', `${ic('repeat', 14, 2.2)} Rodízio`], ...pessoasOpc(), ['ambos', 'Qualquer um']];
  return `${head(a ? 'Editar' : 'Novo afazer', a ? esc(a.nome) : 'O que precisa ser feito?')}
    ${campo('Nome', inp('nome', f.nome, 'maxlength="60" placeholder="Ex.: Lavar a louça" autocomplete="off"'))}
    ${grupo('Ícone', `<div class="emojis">${EMOJIS_AFAZER.map(e => `<button class="${f.ic === e ? 'on' : ''}" data-a="f" data-k="ic" data-v="${e}" aria-label="${e}">${e}</button>`).join('')}</div>`)}
    ${grupo('Repete', segm('freq', f.freq, [['dia', 'Todo dia'], ['semana', 'Semana'], ['mes', 'Mês'], ['cada', 'A cada…']]))}
    ${f.freq === 'semana' ? grupo('Em quais dias', `<div class="chips">${[1, 2, 3, 4, 5, 6, 0].map(d => `<button class="chip ${f.dias.includes(d) ? 'on' : ''}" data-a="fdia" data-v="${d}">${DIAS[d]}</button>`).join('')}</div>`) : ''}
    ${f.freq === 'mes' ? campo('Dia do mês', inp('dm', f.dm, 'type="number" min="1" max="31" inputmode="numeric"')) : ''}
    ${f.freq === 'cada' ? campo('A cada quantos dias', inp('n', f.n, 'type="number" min="1" max="365" inputmode="numeric"')) : ''}
    ${grupo('Quem faz', escolha('resp', f.resp, resps))}
    ${f.resp === 'rodizio' ? (S.pessoas.length > 1 ? grupo('De quem é a vez agora', escolha('vez', f.vez, pessoasOpc('Minha'))) : '<p class="tiny muted">Rodízio: quando a outra pessoa entrar, vocês alternam a cada vez que o afazer é feito.</p>') : ''}
    ${campo('Próxima vez', inp('prox', f.prox, 'type="date"'))}
    ${campo('Observação', area('nota', f.nota, 'maxlength="300" placeholder="Opcional" style="min-height:60px"'))}
    <button class="btn block" data-a="salvarAfazer">Salvar</button>
    ${a ? `<button class="btn danger block" data-a="excluir" data-col="afazeres" data-id="${a.id}">${ic('trash', 16)} Excluir afazer</button>` : ''}`;
}
SH.troca = s => {
  const a = S.d.afazeres.get(s.id); if (!a) return sumiu('Troca');
  const o = outros();
  if (!s.f) s.f = { motivo: '', para: o[0] ? o[0].id : '' };
  return `${head('Pedir troca', `${esc(a.ic || '')} ${esc(a.nome)}`)}
    <p class="small">Se ${o.length === 1 ? esc(primeiroNome(o[0].id)) : 'a pessoa'} aceitar, faz esta vez (${rotuloDia(a.prox)}) no seu lugar${a.resp === 'rodizio' ? ', e a próxima vez fica com você' : ''}.</p>
    ${o.length > 1 ? grupo('Para quem', escolha('para', s.f.para, o.map(p => [p.id, esc(primeiroNome(p.id))]))) : ''}
    ${campo('Motivo (opcional)', inp('motivo', s.f.motivo, 'maxlength="140" placeholder="Ex.: plantão hoje à noite" autocomplete="off"'))}
    <button class="btn block" data-a="pedirTroca">${ic('swap', 18)} Enviar pedido</button>`;
};

/* ============================== pendências ============================== */
function formPend(p) { return p ? { titulo: p.titulo, nota: p.nota || '', resp: p.resp || 'ambos', prazo: p.prazo || '', alta: !!p.alta } : { titulo: '', nota: '', resp: 'ambos', prazo: '', alta: false }; }
SH.pend = s => {
  const p = s.id && S.d.pendencias.get(s.id);
  if (s.id && !p) return sumiu('Pendência');
  if (!s.f) s.f = formPend(p);
  const f = s.f, h = hoje(), sab = N_primeira({ freq: 'semana', dias: [6] }, N_somaDias(h, 1));
  const rapidos = [[h, 'Hoje'], [N_somaDias(h, 1), 'Amanhã'], [sab, 'Sábado'], [N_somaDias(h, 7), 'Em 1 semana'], ['', 'Sem prazo']];
  return `${head(p ? (p.feita ? 'Concluída' : 'Pendência') : 'Nova pendência', p ? esc(p.titulo) : 'O que precisa ser resolvido?')}
    ${campo('O que é', inp('titulo', f.titulo, 'maxlength="120" placeholder="Ex.: Renovar o seguro do carro" autocomplete="off"'))}
    ${campo('Detalhes', area('nota', f.nota, 'maxlength="800" placeholder="Telefone, número do protocolo, valor…"'))}
    ${grupo('Quem resolve', escolha('resp', f.resp, [...pessoasOpc(), ['ambos', 'Nós dois']]))}
    ${grupo('Prazo', escolha('prazo', f.prazo, rapidos) + inp('prazo', f.prazo, 'type="date"'))}
    <div class="between"><span><b>Importante</b><br><span class="small muted">Aparece no topo da lista</span></span><button class="tog ${f.alta ? 'on' : ''}" data-a="f" data-k="alta" data-v="${f.alta ? '' : '1'}" aria-pressed="${f.alta}" aria-label="Importante"></button></div>
    <button class="btn block" data-a="salvarPend">Salvar</button>
    ${p ? `<div class="grid2"><button class="btn ghost" data-a="pendok" data-id="${p.id}" data-fechar="1">${p.feita ? 'Reabrir' : ic('check', 16, 2.4) + ' Concluir'}</button><button class="btn danger" data-a="excluir" data-col="pendencias" data-id="${p.id}">${ic('trash', 16)} Excluir</button></div>${criadoPor(p)}` : ''}`;
};

/* ============================== lançamentos ============================== */
const FORMAS = ['Pix', 'Débito', 'Crédito', 'Dinheiro', 'Boleto'];
function formLanc(l, pre) {
  if (l) return { tipo: l.tipo || 'saida', v: reaisInput(l.v), desc: l.desc || '', cat: l.cat || '', dia: l.dia, forma: l.forma || '', conta: l.conta || '', ref: l.ref || '' };
  pre = pre || {};
  const tipo = pre.tipo || 'saida', cats = categorias(tipo);
  return { tipo, v: pre.v ? reaisInput(pre.v) : '', desc: pre.desc || '', cat: pre.cat || (cats[0] ? cats[0].id : ''), dia: pre.dia || hoje(), forma: pre.forma || '', conta: pre.conta || '', ref: pre.ref || '' };
}
SH.lanc = s => {
  const l = s.id && S.d.lancamentos.get(s.id);
  if (s.id && !l) return sumiu('Lançamento');
  if (!s.f) s.f = formLanc(l, s.pre);
  const f = s.f, ent = f.tipo === 'entrada', conta = f.conta && S.d.contas.get(f.conta);
  return `${head(l ? 'Lançamento' : ent ? 'Nova entrada' : 'Novo gasto', ent ? 'Quanto entrou?' : 'Quanto foi?')}
    ${!f.conta ? segm('tipo', f.tipo, [['saida', 'Gasto'], ['entrada', 'Entrada']]) : ''}
    ${inp('v', f.v, 'class="in big" inputmode="decimal" placeholder="R$ 0,00" autocomplete="off" aria-label="Valor"').replace('class="in" ', '')}
    ${campo('Descrição', inp('desc', f.desc, `maxlength="120" placeholder="${ent ? 'Ex.: salário de outubro' : 'Ex.: feira do sábado'}" autocomplete="off"`))}
    ${grupo('Categoria', escolha('cat', f.cat, categorias(f.tipo).map(c => [c.id, `${esc(c.ic)} ${esc(c.nome)}`])))}
    <div class="grid2">${campo('Data', inp('dia', f.dia, 'type="date"'))}<span></span></div>
    ${!ent ? grupo('Como pagou', escolha('forma', f.forma, FORMAS.map(x => [x, x]))) : ''}
    ${conta ? `<div class="note"><span>Pagamento de <b>${esc(conta.nome)}</b> referente a ${fmtMes(f.ref).toLowerCase()}.</span></div>` : ''}
    <button class="btn block ${ent ? '' : 'warm'}" data-a="salvarLanc">Salvar</button>
    ${l ? `<button class="btn danger block" data-a="excluir" data-col="lancamentos" data-id="${l.id}">${ic('trash', 16)} Excluir lançamento</button><p class="tiny muted">Lançado por ${l.por === S.eu ? 'você' : esc(nomeDe(l.por))}.</p>` : ''}`;
};

/* ============================== contas fixas ============================== */
function formConta(c) { return c ? { nome: c.nome, v: reaisInput(c.v), vence: c.vence || 10, cat: c.cat || 'contas', ativa: c.ativa !== false, nota: c.nota || '' } : { nome: '', v: '', vence: 10, cat: 'contas', ativa: true, nota: '' }; }
SH.conta = s => {
  const c = s.id && S.d.contas.get(s.id);
  if (s.id && !c) return sumiu('Conta fixa');
  if (!s.f) s.f = formConta(c);
  const f = s.f, pags = c ? lista('lancamentos').filter(l => l.conta === c.id).sort((a, b) => b.dia.localeCompare(a.dia)).slice(0, 6) : [];
  return `${head(c ? 'Conta fixa' : 'Nova conta fixa', c ? esc(c.nome) : 'Que conta chega todo mês?')}
    ${campo('Nome', inp('nome', f.nome, 'maxlength="60" placeholder="Ex.: Aluguel, luz, internet" autocomplete="off"'))}
    <div class="grid2">${campo('Valor de sempre', inp('v', f.v, 'inputmode="decimal" placeholder="R$ 0,00" autocomplete="off"'))}${campo('Vence todo dia', inp('vence', f.vence, 'type="number" min="1" max="31" inputmode="numeric"'))}</div>
    ${grupo('Categoria', escolha('cat', f.cat, categorias('saida').map(x => [x.id, `${esc(x.ic)} ${esc(x.nome)}`])))}
    ${c ? `<div class="between"><span><b>Ativa</b><br><span class="small muted">Desligue se a conta acabou</span></span><button class="tog ${f.ativa ? 'on' : ''}" data-a="f" data-k="ativa" data-v="${f.ativa ? '' : '1'}" aria-pressed="${f.ativa}" aria-label="Ativa"></button></div>` : ''}
    ${campo('Observação', area('nota', f.nota, 'maxlength="300" placeholder="Débito automático, código de cliente…" style="min-height:60px"'))}
    <button class="btn block" data-a="salvarConta">Salvar</button>
    ${pags.length ? secao('Pagamentos') + `<div class="lst">${pags.map(l => `<button class="it" data-a="sheet" data-k="lanc" data-id="${l.id}"><span class="em-tile">${esc(categoria(l.cat).ic)}</span><span class="main"><span class="t">${fmtMes(l.ref || N_mes(l.dia))}</span><span class="s">pago ${fmtCurta(l.dia)} · ${esc(nomeDe(l.por))}</span></span><span class="v">${reais(l.v)}</span></button>`).join('')}</div>` : ''}
    ${c ? `<button class="btn danger block" data-a="excluir" data-col="contas" data-id="${c.id}">${ic('trash', 16)} Excluir conta fixa</button>` : ''}`;
};

/* ============================== orçamento e categorias ============================== */
const EMOJIS_CAT = ['🛒', '🏠', '💡', '🚗', '⛽', '💊', '🍔', '🎉', '🛍️', '📚', '🐾', '👶', '✈️', '🎁', '💳', '📱', '🏋️', '💇', '🧾', '📦', '💰', '✨', '💵', '📈'];
SH.orcamento = s => {
  if (!s.f) s.f = { cats: categorias().map(c => ({ ...c, orcTxt: reaisInput(c.orc) })), nic: '📦', nnome: '', ntipo: 'saida' };
  const f = s.f, total = f.cats.filter(c => c.tipo === 'saida').reduce((a, c) => a + lerReais(c.orcTxt), 0);
  const linha = (c, i) => `<div style="display:grid;grid-template-columns:28px minmax(0,1fr) ${c.tipo === 'saida' ? '108px ' : ''}32px;gap:8px;align-items:center">
    <span style="font-size:22px;text-align:center">${esc(c.ic)}</span>
    <input class="in" data-i="cnome:${i}" value="${esc(c.nome)}" maxlength="30" aria-label="Nome da categoria">
    ${c.tipo === 'saida' ? `<input class="in num" data-i="corc:${i}" value="${esc(c.orcTxt)}" inputmode="decimal" placeholder="sem limite" aria-label="Orçamento de ${esc(c.nome)}" style="text-align:right">` : ''}
    <button class="mini" data-a="rmCat" data-i="${i}" aria-label="Remover ${esc(c.nome)}">${ic('trash', 16)}</button></div>`;
  return `${head('Finanças', 'Orçamento do mês')}
    <p class="small muted">Quanto vocês querem gastar por mês em cada categoria. Deixe vazio para não ter limite.</p>
    <div class="panel soft" style="padding:12px 14px"><div class="between"><span class="small">Total previsto de gastos</span><b class="num">${reais(total)}</b></div></div>
    <div class="stack">${f.cats.map((c, i) => c.tipo === 'saida' ? linha(c, i) : '').join('')}</div>
    ${secao('Categorias de entrada')}
    <div class="stack">${f.cats.map((c, i) => c.tipo === 'entrada' ? linha(c, i) : '').join('')}</div>
    ${secao('Nova categoria')}
    <div class="emojis">${EMOJIS_CAT.map(e => `<button class="${f.nic === e ? 'on' : ''}" data-a="f" data-k="nic" data-v="${e}">${e}</button>`).join('')}</div>
    ${segm('ntipo', f.ntipo, [['saida', 'Gasto'], ['entrada', 'Entrada']])}
    <div class="inrow">${inp('nnome', f.nnome, 'maxlength="30" placeholder="Nome (ex.: Farmácia)" autocomplete="off"')}<button class="btn ghost" data-a="addCat">Adicionar</button></div>
    <button class="btn block" data-a="salvarOrc">Salvar</button>`;
};

/* ============================== perfil ============================== */
SH.perfil = () => {
  const casa = S.casa || {}, conv = casa.convite;
  return `${head(esc(casa.nome || 'Nossa casa'), esc(pessoa(S.eu).nome), '')}
    ${grupo('Aparência', `<div class="seg">${[['auto', 'Automática'], ['claro', 'Clara'], ['escuro', 'Escura']].map(([v, l]) => `<button class="${S.tema === v ? 'on' : ''}" data-a="tema" data-v="${v}">${l}</button>`).join('')}</div>`)}
    ${secao('Notificações')}<div class="panel">${secaoPush()}</div>
    ${secao('Quem mora aqui')}
    <div class="lst">${S.pessoas.map(p => `<div class="it">${av(p.id, 34)}<div class="main"><span class="t">${esc(p.nome)}${p.id === S.eu ? ' <span class="muted" style="font-weight:600">(você)</span>' : ''}</span>${p.admin ? '<span class="s">criou a casa</span>' : ''}</div><span></span></div>`).join('')}</div>
    ${conv ? `<div class="panel soft"><div class="between"><span><span class="small muted">Código de convite</span><br><b style="font-size:20px;letter-spacing:.12em">${esc(conv)}</b></span><button class="btn sm" data-a="convidar">${ic('share', 16)} Convidar</button></div></div>` : ''}
    <div class="lst">
      <button class="it" data-a="sheet" data-k="pin"><span class="em-tile">${ic('key')}</span><span class="main"><span class="t">Trocar meu PIN</span></span><span class="muted">${ic('chev', 18)}</span></button>
      ${INSTALADO() ? '' : `<button class="it" data-a="sheet" data-k="instalar"><span class="em-tile">${ic('phone')}</span><span class="main"><span class="t">Instalar o app</span><span class="s">Ícone na tela de início e notificações</span></span><span class="muted">${ic('chev', 18)}</span></button>`}
      <button class="it" data-a="sair"><span class="em-tile">${ic('logout')}</span><span class="main"><span class="t">Sair deste aparelho</span></span><span></span></button>
    </div>
    <p class="tiny muted" style="text-align:center">Rotina ${VERSAO_APP}</p>`;
};
SH.pin = () => `${head('Perfil', 'Trocar meu PIN')}
  <form data-f="pin" class="stack">
    <label class="lab"><span>PIN atual</span><input class="in" id="pinAtual" type="password" inputmode="numeric" maxlength="8" autocomplete="current-password"></label>
    <label class="lab"><span>PIN novo (4 a 8 números)</span><input class="in" id="pinNovo" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password"></label>
    <button class="btn block" type="submit">Trocar PIN</button>
  </form>`;
SH.instalar = () => `${head('Instalar', 'Rotina na tela de início')}
  ${IOS ? `<ol class="steps"><li>Abra este endereço no <b>Safari</b>.</li><li>Toque em <b>Compartilhar</b> (o quadrado com a seta).</li><li>Toque em <b>Adicionar à Tela de Início</b>.</li><li>Abra o Rotina pelo ícone novo e entre de novo (o app instalado guarda os dados separado do Safari).</li></ol>`
  : `<ol class="steps"><li>No Chrome, toque no menu <b>⋮</b>.</li><li>Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</li><li>Abra o Rotina pelo ícone novo.</li></ol>${S.instalarEvt ? `<button class="btn block" data-a="instalarja">Instalar agora</button>` : ''}`}`;
