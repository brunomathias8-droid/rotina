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
  if (a) return { nome: a.nome, ic: a.ic || '🏠', freq: a.freq || 'dia', dias: N_diasSemana(a), n: a.n || 7, dm: a.dm || dHoje.getDate(), resp: a.resp || 'ambos', vez: a.vez || S.eu, prox: a.prox || hoje(), peso: a.peso || 2, nota: a.nota || '' };
  return { nome: '', ic: '🧹', freq: 'semana', dias: [dHoje.getDay()], n: 7, dm: dHoje.getDate(), resp: 'rodizio', vez: S.eu, prox: hoje(), peso: 2, nota: '' };
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
      <div class="between"><span class="small muted">Esforço</span><span class="small">${(PESOS.find(x => x[0] === (a.peso || 2)) || PESOS[1])[1]} · ${a.peso || 2} ${plu(a.peso || 2, 'ponto')}</span></div>
      ${a.resp === 'rodizio' ? '<p class="tiny muted">Rodízio: quem faz passa a vez para o outro. Pular não muda a vez.</p>' : ''}</div>
    ${t && t.st === 'pedida' ? `<div class="note warn"><span>${t.de === S.eu ? `Você pediu para ${esc(primeiroNome(t.para))} fazer esta vez. Esperando resposta.` : `${esc(primeiroNome(t.de))} pediu para você fazer esta vez.`}</span></div>` : ''}
    ${t && t.st === 'aceita' ? `<div class="note"><span>${esc(primeiroNome(t.para))} aceitou fazer esta vez no lugar de ${esc(primeiroNome(t.de))}.</span></div>` : ''}
    ${a.nota ? `<p class="small">${esc(a.nota)}</p>` : ''}
    <button class="btn block" data-a="concluir" data-id="${a.id}" data-fechar="1">${ic('check', 18, 2.4)} Marcar como feito</button>
    <button class="btn ghost block" data-a="pular" data-id="${a.id}">Pular esta vez</button>
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
    ${grupo('Esforço', escolha('peso', f.peso, PESOS.map(([v, l]) => [v, l])) + '<p class="tiny muted">Vale pontos no placar da casa: leve 1, médio 2, pesado 3.</p>')}
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
function formPend(p) {
  return p ? { titulo: p.titulo, nota: p.nota || '', area: p.area || '', resp: p.resp || 'ambos', prazo: p.prazo || '', alta: !!p.alta, itens: (p.itens || []).map(x => ({ ...x })), repete: p.repete || '', novoItem: '' }
    : { titulo: '', nota: '', area: '', resp: 'ambos', prazo: '', alta: false, itens: [], repete: '', novoItem: '' };
}
SH.pend = s => {
  const p = s.id && S.d.pendencias.get(s.id);
  if (s.id && !p) return sumiu('Pendência');
  if (!s.f) s.f = formPend(p);
  const f = s.f, h = hoje(), sab = N_primeira({ freq: 'semana', dias: [6] }, N_somaDias(h, 1));
  const rapidos = [[h, 'Hoje'], [N_somaDias(h, 1), 'Amanhã'], [sab, 'Sábado'], [N_somaDias(h, 7), 'Em 1 semana'], ['', 'Sem prazo']];
  const feitos = f.itens.filter(x => x.ok).length;
  return `${head(p ? (p.feita ? 'Concluída' : 'Pendência') : 'Nova pendência', p ? esc(p.titulo) : 'O que precisa ser resolvido?')}
    ${campo('O que é', inp('titulo', f.titulo, 'maxlength="120" placeholder="Ex.: Renovar o seguro do carro" autocomplete="off"'))}
    ${grupo('Área', escolha('area', f.area, [['', 'Nenhuma'], ...Object.entries(AREAS).map(([k, [e, n]]) => [k, `${e} ${n}`])]))}
    ${grupo('Quem resolve', escolha('resp', f.resp, [...pessoasOpc(), ['ambos', 'Nós dois']]))}
    ${grupo('Prazo', escolha('prazo', f.prazo, rapidos) + inp('prazo', f.prazo, 'type="date"'))}
    ${grupo('Repete', escolha('repete', f.repete, [['', 'Não'], ['semana', 'Toda semana'], ['mes', 'Todo mês'], ['ano', 'Todo ano']]) + (f.repete ? '<p class="tiny muted">Ao concluir, a próxima já fica criada com o prazo seguinte.</p>' : ''))}
    ${grupo(`Passos${f.itens.length ? ` (${feitos}/${f.itens.length})` : ''}`, `<div class="lst">${f.itens.map((x, i) => `<div class="it${x.ok ? ' feito' : ''}" style="min-height:44px;padding:6px 10px"><button class="ck sm${x.ok ? ' on' : ''}" data-a="passoPend" data-i="${i}" aria-label="${esc(x.t)}">${ic('check', 14, 2.6)}</button><span class="t" style="font-weight:600">${esc(x.t)}</span><button class="mini" data-a="rmPasso" data-i="${i}" aria-label="Remover">${ic('x', 16)}</button></div>`).join('')}
      <div class="inrow" style="padding:6px"><input class="in" id="f-novoItem" data-i="novoItem" value="${esc(f.novoItem)}" placeholder="Próximo passo (ex.: ligar para a corretora)" maxlength="80" autocomplete="off"><button class="btn ghost sm" data-a="addPasso">${ic('plus', 16, 2.4)}</button></div></div>`)}
    ${campo('Detalhes', area('nota', f.nota, 'maxlength="800" placeholder="Telefone, número do protocolo, valor…"'))}
    <div class="between"><span><b>Importante</b><br><span class="small muted">Aparece no topo da lista</span></span><button class="tog ${f.alta ? 'on' : ''}" data-a="f" data-k="alta" data-v="${f.alta ? '' : '1'}" aria-pressed="${f.alta}" aria-label="Importante"></button></div>
    <button class="btn block" data-a="salvarPend">Salvar</button>
    ${p ? `<div class="grid2"><button class="btn ghost" data-a="pendok" data-id="${p.id}" data-fechar="1">${p.feita ? 'Reabrir' : ic('check', 16, 2.4) + ' Concluir'}</button><button class="btn danger" data-a="excluir" data-col="pendencias" data-id="${p.id}">${ic('trash', 16)} Excluir</button></div>${criadoPor(p)}` : ''}`;
};

/* ============================== compras ============================== */
SH.compra = s => {
  const c = S.d.compras.get(s.id); if (!c) return sumiu('Item');
  if (!s.f) s.f = { item: c.item, qtd: c.qtd || '', setor: c.setor || setorDe(c.item) };
  const f = s.f;
  return `${head('Lista de compras', esc(c.item))}
    <div class="grid2" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr)">${campo('Item', inp('item', f.item, 'maxlength="80" autocomplete="off"'))}${campo('Quantidade', inp('qtd', f.qtd, 'maxlength="30" placeholder="Ex.: 2 kg" autocomplete="off"'))}</div>
    ${grupo('Setor do mercado', escolha('setor', f.setor, SETORES.map(([k, e, n]) => [k, `${e} ${n}`])))}
    <button class="btn block" data-a="salvarCompra">Salvar</button>`;
};

const EMOJIS_CAT = ['🛒', '🏠', '💡', '🚗', '⛽', '💊', '🍔', '🎉', '🛍️', '📚', '🐾', '👶', '✈️', '🎁', '💳', '📱', '🏋️', '💇', '🧾', '📦', '💰', '✨', '💵', '📈'];
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
SH.instalar = () => {
  const android = /Android/.test(navigator.userAgent), mac = /Macintosh/.test(navigator.userAgent) && !IOS;
  const passos = IOS ? '<ol class="steps"><li>Abra este endereço no <b>Safari</b>.</li><li>Toque em <b>Compartilhar</b> (o quadrado com a seta).</li><li>Toque em <b>Adicionar à Tela de Início</b>.</li><li>Abra o Rotina pelo ícone novo e entre de novo (o app instalado guarda os dados separado do Safari).</li></ol>'
    : android ? '<ol class="steps"><li>No Chrome, toque no menu <b>⋮</b>.</li><li>Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</li><li>Abra o Rotina pelo ícone novo.</li></ol>'
    : mac ? '<ol class="steps"><li>No <b>Safari</b>: menu <b>Arquivo › Adicionar ao Dock</b>.</li><li>No <b>Chrome</b> ou <b>Edge</b>: ícone de instalar na barra de endereço, à direita.</li><li>O Rotina abre numa janela própria, como um programa.</li></ol>'
    : '<ol class="steps"><li>Abra o Rotina no <b>Edge</b> ou no <b>Chrome</b>.</li><li>Clique no ícone de instalar na barra de endereço, à direita (um monitor com uma seta, ou ⊕). Se não aparecer: menu <b>⋯</b> › <b>Aplicativos</b> › <b>Instalar este site como um aplicativo</b>.</li><li>O Rotina passa a abrir numa janela própria, aparece no menu Iniciar e pode ser fixado na barra de tarefas.</li><li>Para receber os avisos, ative as notificações aqui no perfil e confira em <b>Configurações do Windows › Sistema › Notificações</b> se o Edge ou o Chrome estão liberados.</li></ol>';
  return `${head('Instalar', IOS || android ? 'Rotina na tela de início' : 'Rotina no computador')}${passos}${S.instalarEvt ? '<button class="btn block" data-a="instalarja">Instalar agora</button>' : ''}`;
};
