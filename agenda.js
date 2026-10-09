/* agenda.js — Agenda da família: compromissos com cor por pessoa, quem leva, lembretes, repetição, conversa no evento,
   revisão da semana, perfis sem login (filhos, pais, pet) e exportação para o calendário do celular ou do Outlook.
   Carregado depois de acoes.js (acrescenta ações ao objeto A). As datas e repetições ficam em nucleo.js. */
'use strict';

const TIPOS_EV = { saude: ['🩺', 'Saúde'], escola: ['🎒', 'Escola'], trabalho: ['💼', 'Trabalho'], social: ['🥂', 'Social'], casa: ['🏠', 'Casa'],
  esporte: ['⚽', 'Esporte'], viagem: ['✈️', 'Viagem'], aniversario: ['🎂', 'Aniversário'], outro: ['📌', 'Outro'] };
const tipoEv = k => TIPOS_EV[k] || TIPOS_EV.outro;
/* Lembretes: minutos antes do início. Compromisso de dia inteiro conta a partir da meia-noite do dia. */
const ALERTAS_HORA = [[0, 'Na hora'], [15, '15 min antes'], [30, '30 min antes'], [60, '1 hora antes'], [120, '2 horas antes'], [1440, '1 dia antes'], [2880, '2 dias antes'], [10080, '1 semana antes']];
const ALERTAS_DIA = [[-480, 'No dia, às 8h'], [300, 'Na véspera, às 19h'], [1740, '2 dias antes, às 19h'], [9540, '1 semana antes, às 9h']];
const alertasPadrao = (diaTodo, tipo) => diaTodo ? (tipo === 'aniversario' ? [300, -480] : [300]) : tipo === 'saude' ? [1440, 120] : [1440, 60];
const nomeAlerta = (m, diaTodo) => ((diaTodo ? ALERTAS_DIA : ALERTAS_HORA).find(x => x[0] === m) || [m, `${m} min antes`])[1];
const REPETE_EV = [['', 'Não repete'], ['semana', 'Toda semana'], ['mes', 'Todo mês'], ['ano', 'Todo ano'], ['dia', 'Todo dia']];
const CORES_MEMBRO = ['e', 'f', 'g', 'h', 'a', 'b', 'c', 'd'];
const EMOJIS_MEMBRO = ['🙂', '👶', '🧒', '👧', '👦', '👩', '👨', '👵', '👴', '🐶', '🐱', '🐾', '🐰', '🐦'];

/* ============================== consultas ============================== */
const eventos = () => lista('eventos');
const corEvento = e => { const p = (e.pessoas || [])[0] || e.leva; return p ? pessoa(p).cor || 'e' : 'n'; };
const passaFiltro = e => !S.fPess || (e.pessoas || []).includes(S.fPess) || e.leva === S.fPess;
/** Ocorrências de [de, ate] como { e, dia }, em ordem de dia e horário (dia inteiro primeiro). */
function eventosEntre(de, ate, todos) {
  const out = [];
  eventos().forEach(e => { if (todos || passaFiltro(e)) N_ocorrencias(e, de, ate).forEach(dia => out.push({ e, dia })); });
  return out.sort((a, b) => a.dia.localeCompare(b.dia) || (a.e.diaTodo ? 0 : 1) - (b.e.diaTodo ? 0 : 1) || String(a.e.ini || '').localeCompare(String(b.e.ini || '')));
}
/** Compromissos que acontecem no dia D (inclusive os de vários dias que passam por ele). */
const eventosDoDia = (d, todos) => eventosEntre(d, d, todos);
/** Precisa de alguém para levar: tem alguém da família sem login (filho, pai, pet) e ninguém escolhido para ir junto. */
const semQuemLeve = e => !e.leva && (e.pessoas || []).some(id => !S.pessoas.some(p => p.id === id));
function horario(e) {
  if (e.diaTodo || !e.ini) return 'dia todo';
  return e.ini + (e.fimH ? '–' + e.fimH : '');
}
function quandoTexto(e, dia) {
  const fim = e.fim && e.fim > e.dia ? N_somaDias(dia, N_diasEntre(e.dia, e.fim)) : '';
  return `${fmtData(dia)}${fim ? ' até ' + fmtCurta(fim) : ''} · ${horario(e)}`;
}

/* ============================== linhas ============================== */
function linhaEvento(e, dia) {
  const multi = e.fim && e.fim > e.dia, n = (e.coments || []).length, pessoasEv = (e.pessoas || []).slice(0, 4);
  const sub = [pessoasEv.length ? `<span>${pessoasEv.map(id => av(id, 16)).join('')} ${esc(pessoasEv.map(primeiroNome).join(', '))}</span>` : '',
    e.leva ? `<span>🚗 ${esc(e.leva === S.eu ? 'você leva' : primeiroNome(e.leva) + ' leva')}</span>` : '',
    semQuemLeve(e) ? '<span class="tag warn">quem leva?</span>' : '',
    e.local ? `<span>📍 ${esc(e.local)}</span>` : '', multi ? `<span>até ${fmtCurta(N_somaDias(dia, N_diasEntre(e.dia, e.fim)))}</span>` : '',
    e.repete ? `<span>${ic('repeat', 12, 2.2)}</span>` : '', n ? `<span>💬 ${n}</span>` : ''].filter(Boolean).join('');
  return `<button class="it ev${e.pend ? ' pend' : ''}" style="--ec:var(--cor-${corEvento(e)})" data-a="sheet" data-k="evento" data-id="${e.id}" data-v="${dia}">
    <span class="ev-hora">${e.diaTodo || !e.ini ? '<b>dia todo</b>' : `<b>${esc(e.ini)}</b>${e.fimH ? `<small>${esc(e.fimH)}</small>` : ''}`}</span>
    <span class="main"><span class="t">${esc(tipoEv(e.tipo)[0])} ${esc(e.titulo)}</span>${sub ? `<span class="s">${sub}</span>` : ''}</span><span></span></button>`;
}
const cabDia = d => `<p class="dia-h${d === hoje() ? ' hoje' : ''}">${rotuloDia(d) === fmtCurta(d) ? fmtData(d) : rotuloDia(d) + ' · ' + DIAS[N_dataObj(d).getDay()].toLowerCase() + ' ' + fmtCurta(d)}</p>`;

/* ============================== tela ============================== */
function scrAgenda() {
  const v = S.ag, h = hoje(), ms = membros();
  const filtros = `<div class="chips scroll"><button class="chip ${!S.fPess ? 'on' : ''}" data-a="fpess" data-v="">Todos</button>${ms.map(p => `<button class="chip ${S.fPess === p.id ? 'on' : ''}" data-a="fpess" data-v="${p.id}">${av(p.id, 18)} ${esc(p.id === S.eu ? 'Eu' : primeiroNome(p.id))}</button>`).join('')}<button class="chip" data-a="sheet" data-k="membro" title="Pessoa da família sem login">${ic('plus', 14, 2.4)} Família</button></div>`;
  let corpo = '';
  if (v === 'lista') {
    const itens = eventosEntre(h, N_somaDias(h, 60)), dias = [...new Set(itens.map(x => x.dia))];
    corpo = dias.length ? dias.map(d => cabDia(d) + listaOu(itens.filter(x => x.dia === d), x => linhaEvento(x.e, x.dia))).join('')
      : `<div class="panel">${vazio('📅', eventos().length ? 'Nada marcado nos próximos 60 dias.' : 'Marquem aqui consultas, reuniões da escola, aniversários, viagens… Cada pessoa tem uma cor, e o app avisa antes.')}<button class="btn block" data-a="novoEvento">Marcar compromisso</button></div>`;
  } else if (v === 'semana') {
    const seg = N_segunda(S.agDia), itens = eventosEntre(seg, N_somaDias(seg, 6));
    corpo = `<div class="mesnav"><button class="x" data-a="agnav" data-v="-7" aria-label="Semana anterior">${ic('chevl', 18)}</button><p class="h2" style="text-align:center;flex:1">${fmtCurta(seg)} a ${fmtCurta(N_somaDias(seg, 6))}</p><button class="x" data-a="agnav" data-v="7" aria-label="Próxima semana">${ic('chev', 18)}</button></div>
      <div class="semana">${[0, 1, 2, 3, 4, 5, 6].map(i => { const d = N_somaDias(seg, i), l = itens.filter(x => x.dia === d);
        return `<div class="sdia${d === h ? ' hoje' : ''}"><button class="sdia-h" data-a="novoEvento" data-dia="${d}" title="Marcar neste dia"><b>${DIAS[N_dataObj(d).getDay()]}</b><span>${N_dataObj(d).getDate()}</span></button>${l.length ? `<div class="lst">${l.map(x => linhaEvento(x.e, x.dia)).join('')}</div>` : '<p class="tiny muted sdia-v">—</p>'}</div>`; }).join('')}</div>`;
  } else {
    const ref = N_mes(S.agDia), ini = N_segunda(ref + '-01'), fimMes = N_diaDoMes(ref, 31), itens = eventosEntre(ini, N_somaDias(ini, 41));
    const semanas = Math.ceil((N_diasEntre(ini, fimMes) + 1) / 7), sel = S.agDia, doDia = itens.filter(x => x.dia === sel);
    corpo = `<div class="mesnav"><button class="x" data-a="agmes" data-v="-1" aria-label="Mês anterior">${ic('chevl', 18)}</button><p class="h2" style="text-align:center;flex:1">${fmtMes(ref)}</p><button class="x" data-a="agmes" data-v="1" aria-label="Próximo mês">${ic('chev', 18)}</button></div>
      <div class="mes"><div class="mes-sem">${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(x => `<span>${x}</span>`).join('')}</div>
      <div class="mes-grade">${Array.from({ length: semanas * 7 }, (_, i) => { const d = N_somaDias(ini, i), l = itens.filter(x => x.dia === d);
        return `<button class="mdia${N_mes(d) !== ref ? ' fora' : ''}${d === h ? ' hoje' : ''}${d === sel ? ' sel' : ''}" data-a="agdia" data-v="${d}" aria-label="${fmtData(d)}: ${l.length} ${plu(l.length, 'compromisso')}"><span class="mn">${N_dataObj(d).getDate()}</span>
          <span class="mpts">${l.slice(0, 4).map(x => `<i style="background:var(--cor-${corEvento(x.e)})"></i>`).join('')}</span>
          <span class="mtit">${l.slice(0, 3).map(x => `<em style="--ec:var(--cor-${corEvento(x.e)})">${esc(x.e.diaTodo || !x.e.ini ? '' : x.e.ini + ' ')}${esc(x.e.titulo)}</em>`).join('')}${l.length > 3 ? `<em class="mais">+${l.length - 3}</em>` : ''}</span></button>`; }).join('')}</div></div>
      ${cabDia(sel)}${listaOu(doDia, x => linhaEvento(x.e, x.dia), `<div class="panel" style="padding:12px 14px;flex-direction:row;align-items:center;justify-content:space-between"><span class="small muted">Nada marcado.</span><button class="btn ghost sm" data-a="novoEvento" data-dia="${sel}">${ic('plus', 15, 2.4)} Marcar</button></div>`)}`;
  }
  const seg = N_segunda(h), semTotal = eventosEntre(seg, N_somaDias(seg, 6), true).length;
  return `<div class="between"><h1 class="display">Agenda</h1><button class="btn sm" data-a="novoEvento">${ic('plus', 16, 2.4)} Novo</button></div>
    <form data-f="evento" class="inrow"><input class="in" id="evtxt" placeholder="Ex.: dentista Ana sexta 14h" maxlength="160" autocomplete="off" enterkeyhint="done"><button class="btn" type="submit" aria-label="Marcar">${ic('plus', 20, 2.4)}</button></form>
    <div class="seg">${[['lista', 'Próximos'], ['semana', 'Semana'], ['mes', 'Mês']].map(([k, l]) => `<button class="${v === k ? 'on' : ''}" data-a="agv" data-v="${k}">${l}</button>`).join('')}</div>
    ${filtros}
    <button class="panel soft combinado" data-a="sheet" data-k="semana"><span class="em-tile" style="background:var(--s1)">🗓️</span><span style="flex:1"><b>Combinado da semana</b><br><span class="small muted">${semTotal} ${plu(semTotal, 'compromisso')} nesta semana. 15 minutos juntos para ver tudo e decidir quem leva e quem faz.</span></span>${ic('chev', 18)}</button>
    ${corpo}`;
}

/* ============================== painéis ============================== */
/* Ver um compromisso */
SH.evento = s => {
  const e = s.id && S.d.eventos.get(s.id);
  if (s.id && !e) return sumiu('Compromisso');
  if (!s.f) { if (e) return verEvento(e, s.v || e.dia); s.f = formEvento(null, s.pre); }
  return editarEvento(s, e);
};
function verEvento(e, dia) {
  const t = tipoEv(e.tipo), ms = e.pessoas || [];
  const maps = e.local ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.local)}` : '';
  return `${head(`${t[0]} ${t[1]}`, esc(e.titulo))}
    <div class="panel soft">
      <div class="hrow" style="gap:10px">${ic('cal', 18)}<span><b>${quandoTexto(e, dia)}</b>${e.repete ? `<br><span class="small muted">${ic('repeat', 12, 2.2)} ${REPETE_EV.find(x => x[0] === e.repete)[1].toLowerCase()}${e.ate ? ' até ' + fmtCurta(e.ate) : ''}</span>` : ''}</span></div>
      ${ms.length ? `<div class="hrow" style="gap:10px">${ic('home', 18)}<span class="hrow" style="gap:6px">${ms.map(id => `${av(id, 22)} ${esc(primeiroNome(id))}`).join(' ')}</span></div>` : ''}
      ${e.leva ? `<div class="hrow" style="gap:10px"><span style="width:18px;text-align:center">🚗</span><span>${esc(e.leva === S.eu ? 'Você leva' : primeiroNome(e.leva) + ' leva')}</span></div>` : semQuemLeve(e) ? `<div class="note warn"><span>Ninguém foi escolhido para levar. <button class="link" data-a="euLevo" data-id="${e.id}">Eu levo</button></span></div>` : ''}
      ${e.local ? `<div class="hrow" style="gap:10px"><span style="width:18px;text-align:center">📍</span><a href="${maps}" target="_blank" rel="noopener" class="link">${esc(e.local)}</a></div>` : ''}
      ${(e.alertas || []).length ? `<div class="hrow" style="gap:10px">${ic('bell', 18)}<span class="small">${e.alertas.map(m => nomeAlerta(m, e.diaTodo)).join(' · ')}${e.avisar === 'todos' ? ' · avisa todos' : ''}</span></div>` : ''}
    </div>
    ${e.nota ? `<p class="small" style="white-space:pre-wrap">${esc(e.nota)}</p>` : ''}
    <div class="grid2"><button class="btn sm" data-a="editarEvento">${ic('edit', 16)} Editar</button><button class="btn ghost sm" data-a="icsEvento" data-id="${e.id}">${ic('cal', 16)} No meu calendário</button>
      <button class="btn ghost sm" data-a="tarefaDoEvento" data-id="${e.id}" data-v="${dia}">${ic('clip', 16)} Criar tarefa</button><button class="btn ghost sm" data-a="duplicarEvento" data-id="${e.id}">Duplicar</button></div>
    ${secao('Conversa', `<span class="tiny muted">${(e.coments || []).length}</span>`)}
    <div class="stack">${(e.coments || []).map(c => `<div class="coment${c.p === S.eu ? ' meu' : ''}">${av(c.p, 24)}<div><p class="small">${esc(c.t)}</p><p class="tiny muted">${esc(nomeDe(c.p))} · ${rotuloDia(isoLocal(c.em))} ${esc(new Date(c.em).toTimeString().slice(0, 5))}</p></div></div>`).join('') || '<p class="small muted">Combinem aqui: quem leva, o que precisa levar, mudança de horário…</p>'}</div>
    <form data-f="coment" class="inrow"><input class="in" id="comtxt" placeholder="Escreva um comentário" maxlength="500" autocomplete="off"><button class="btn" type="submit" aria-label="Enviar">${ic('up', 18, 2.4)}</button></form>
    ${e.repete ? `<div class="grid2"><button class="btn danger sm" data-a="excluirEvento" data-id="${e.id}" data-v="${dia}" data-modo="um">Excluir só este dia</button><button class="btn danger sm" data-a="excluirEvento" data-id="${e.id}" data-modo="todos">Excluir todos</button></div>`
      : `<button class="btn danger block" data-a="excluirEvento" data-id="${e.id}" data-modo="todos">${ic('trash', 16)} Excluir compromisso</button>`}
    <p class="tiny muted">Marcado por ${e.por === S.eu ? 'você' : esc(nomeDe(e.por))}.</p>`;
}
function formEvento(e, pre) {
  if (e) return { titulo: e.titulo, tipo: e.tipo || 'outro', dia: e.dia, fim: e.fim || '', diaTodo: !!e.diaTodo, ini: e.ini || '', fimH: e.fimH || '', local: e.local || '', pessoas: [...(e.pessoas || [])],
    leva: e.leva || '', repete: e.repete || '', ate: e.ate || '', alertas: (e.alertas || []).map(String), avisar: e.avisar || 'envolvidos', nota: e.nota || '' };
  pre = pre || {};
  const tipo = pre.tipo || 'outro', diaTodo = pre.diaTodo != null ? pre.diaTodo : !pre.ini && tipo === 'aniversario';
  return { titulo: pre.titulo || '', tipo, dia: pre.dia || hoje(), fim: pre.fim || '', diaTodo, ini: pre.ini || (diaTodo ? '' : '09:00'), fimH: pre.fimH || '', local: pre.local || '',
    pessoas: pre.pessoas || (S.fPess ? [S.fPess] : [S.eu]), leva: pre.leva || '', repete: pre.repete || (tipo === 'aniversario' ? 'ano' : ''), ate: '',
    alertas: (pre.alertas || alertasPadrao(diaTodo, tipo)).map(String), avisar: 'envolvidos', nota: pre.nota || '' };
}
function editarEvento(s, e) {
  const f = s.f, ms = membros(), comLogin = S.pessoas;
  return `${head(e ? 'Editar' : 'Novo compromisso', e ? esc(e.titulo) : 'O que vai acontecer?')}
    ${campo('O quê', inp('titulo', f.titulo, 'maxlength="120" placeholder="Ex.: Pediatra do Pedro" autocomplete="off"'))}
    ${grupo('Tipo', escolha('tipo', f.tipo, Object.entries(TIPOS_EV).map(([k, [e2, n]]) => [k, `${e2} ${n}`])))}
    <div class="grid2">${campo('Dia', inp('dia', f.dia, 'type="date"'))}${campo('Até (se durar mais de um dia)', inp('fim', f.fim, 'type="date"'))}</div>
    ${toggle('diaTodo', f.diaTodo, 'Dia inteiro', f.diaTodo ? 'Sem horário (aniversário, viagem, feriado)' : '')}
    ${f.diaTodo ? '' : `<div class="grid2">${campo('Começa', inp('ini', f.ini, 'type="time"'))}${campo('Termina (opcional)', inp('fimH', f.fimH, 'type="time"'))}</div>`}
    ${grupo('Quem', escolhaMulti('pessoas', f.pessoas, ms.map(p => [p.id, `${av(p.id, 18)} ${esc(p.id === S.eu ? 'Eu' : primeiroNome(p.id))}`])) + '<button class="link" data-a="membroDoEvento" style="margin-top:6px">+ Pessoa da família (filho, pais, pet)</button>')}
    ${grupo('Quem leva ou acompanha', escolha('leva', f.leva, [['', 'Ninguém'], ...comLogin.map(p => [p.id, p.id === S.eu ? 'Eu' : esc(primeiroNome(p.id))])]))}
    ${campo('Onde (opcional)', inp('local', f.local, 'maxlength="200" placeholder="Endereço ou nome do lugar" autocomplete="off"'))}
    ${grupo('Repete', escolha('repete', f.repete, REPETE_EV))}
    ${f.repete ? campo('Repete até (opcional)', inp('ate', f.ate, 'type="date"')) : ''}
    ${grupo('Lembretes', escolhaMulti('alertas', f.alertas, (f.diaTodo ? ALERTAS_DIA : ALERTAS_HORA).map(([m, n]) => [String(m), n])))}
    ${grupo('Avisar', segm('avisar', f.avisar, [['envolvidos', 'Quem está no compromisso'], ['todos', 'Todos da casa']]))}
    ${campo('Observação', area('nota', f.nota, 'maxlength="800" placeholder="Levar exames, pedido médico, carteirinha…"'))}
    <button class="btn block" data-a="salvarEvento">Salvar</button>
    ${e ? `<button class="btn danger block" data-a="excluirEvento" data-id="${e.id}" data-modo="todos">${ic('trash', 16)} Excluir compromisso</button>` : ''}`;
}

/* Combinado da semana: tudo dos próximos 7 dias num lugar, com o que ainda não tem dono */
SH.semana = () => {
  const h = hoje(), dias = Array.from({ length: 7 }, (_, i) => N_somaDias(h, i));
  const evs = eventosEntre(dias[0], dias[6], true), tars = abertas().filter(t => t.prox && t.prox <= dias[6]);
  const contas = agendaMes(N_mes(h)).concat(agendaMes(N_somaMes(N_mes(h), 1))).filter(x => !x.entrada && x.status !== 'pago' && x.venc >= h && x.venc <= dias[6]);
  const semLeva = evs.filter(x => semQuemLeve(x.e)), semDono = tars.filter(t => !quemFaz(t) && !t.freq);
  return `${head('Combinado da semana', 'Próximos 7 dias')}
    <p class="small muted">Sentem 15 minutos juntos: vejam a semana inteira, decidam quem leva cada compromisso e quem faz cada tarefa. É o hábito que mais tira a carga mental de uma pessoa só.</p>
    <div class="grid3"><div class="stat"><span class="tiny muted">Compromissos</span><b>${evs.length}</b></div><div class="stat"><span class="tiny muted">Tarefas</span><b>${tars.length}</b></div><div class="stat"><span class="tiny muted">Contas</span><b>${compacto(contas.reduce((a, x) => a + (x.resta != null ? x.resta : x.v), 0))}</b></div></div>
    ${semLeva.length || semDono.length ? `<div class="note warn"><span>Para decidir: ${[semLeva.length ? `${semLeva.length} ${plu(semLeva.length, 'compromisso')} sem quem leve` : '', semDono.length ? `${semDono.length} ${plu(semDono.length, 'tarefa')} de "nós dois" sem dono` : ''].filter(Boolean).join(' e ')}.</span></div>` : '<div class="note"><span>Tudo com dono. Boa semana!</span></div>'}
    ${dias.map(d => {
      const e = evs.filter(x => x.dia === d), t = tars.filter(x => (x.prox < h ? h : x.prox) === d), c = contas.filter(x => x.venc === d);
      if (!e.length && !t.length && !c.length) return '';
      return cabDia(d) + `<div class="lst">${e.map(x => linhaEvento(x.e, x.dia)).join('')}${t.map(linhaTarefa).join('')}${c.map(linhaAgenda).join('')}</div>`;
    }).join('') || vazio('🌤️', 'Semana tranquila: nada marcado.')}`;
};

/* Pessoa da família sem login */
SH.membro = s => {
  const p = s.id && S.d.perfis.get(s.id);
  if (!s.f) s.f = p ? { nome: p.nome, ic: p.ic || '🙂', cor: p.cor || 'e', nasc: p.nasc || '' } : { nome: '', ic: '🧒', cor: CORES_MEMBRO[perfis().length % 4], nasc: '' };
  const f = s.f;
  return `${head('Família', p ? esc(p.nome) : 'Nova pessoa')}
    <p class="small muted">Para marcar compromissos de quem não usa o app: filhos, pais, sogros, o pet. Só quem tem login recebe os avisos.</p>
    ${campo('Nome', inp('nome', f.nome, 'maxlength="30" placeholder="Ex.: Pedro, Mãe, Thor" autocomplete="off"'))}
    ${grupo('Ícone', `<div class="emojis">${EMOJIS_MEMBRO.map(x => `<button class="${f.ic === x ? 'on' : ''}" data-a="f" data-k="ic" data-v="${x}">${x}</button>`).join('')}</div>`)}
    ${grupo('Cor na agenda', `<div class="chips">${CORES_MEMBRO.map(c => `<button class="cor cor-${c} ${f.cor === c ? 'on' : ''}" data-a="f" data-k="cor" data-v="${c}" aria-label="Cor ${c}"></button>`).join('')}</div>`)}
    ${campo('Aniversário (opcional)', inp('nasc', f.nasc, 'type="date"'))}
    ${!p && f.nasc ? '<p class="tiny muted">O aniversário entra sozinho na agenda, todo ano, com aviso na véspera.</p>' : ''}
    <button class="btn block" data-a="salvarMembro">Salvar</button>
    ${p ? `<button class="btn danger block" data-a="excluir" data-col="perfis" data-id="${p.id}">${ic('trash', 16)} Remover</button>` : ''}`;
};

/* Assinar a agenda no calendário do celular ou do computador */
function linkAgenda() { const u = apiUrl(); return u && S.casa && S.casa.ics ? `${u}${u.includes('?') ? '&' : '?'}agenda=${S.casa.ics}` : ''; }
SH.assinar = () => {
  const url = linkAgenda();
  return `${head('Agenda', 'Ver no calendário do celular')}
    <p class="small">A agenda do Rotina pode aparecer dentro do calendário do iPhone, do Google ou do Outlook, só para ver. Para marcar e mudar, use o Rotina.</p>
    ${url ? `<div class="inrow"><input class="in" readonly value="${esc(url)}" id="agurl" onclick="this.select()"><button class="btn ghost" data-a="copiarAgenda">Copiar</button></div>
    <ol class="steps"><li><b>iPhone:</b> Ajustes › Calendário › Contas › Adicionar Conta › Outra › <b>Adicionar Calendário Assinado</b> › cole o endereço.</li>
      <li><b>Outlook (Windows ou web):</b> Calendário › Adicionar calendário › <b>Assinar da Web</b> › cole o endereço.</li>
      <li><b>Google Agenda (computador):</b> Outras agendas › + › <b>Do URL</b> › cole o endereço.</li></ol>
    <div class="note"><span>Os calendários buscam as mudanças de tempos em tempos (o Google pode levar algumas horas). Quem tiver o endereço vê a agenda: não compartilhe fora da família. Para trocar o endereço, apague <b>agenda_ics</b> na aba Config da planilha.</span></div>`
      : '<div class="note warn"><span>O endereço aparece depois da próxima sincronização com o servidor.</span></div>'}
    <p class="small muted">Para um compromisso só, abra-o e toque em <b>No meu calendário</b>.</p>`;
};

/* ============================== entrada rápida: "dentista Ana sexta 14h" ============================== */
const DIAS_NOME = [['domingo', 'dom'], ['segunda', 'seg'], ['terca', 'ter'], ['quarta', 'qua'], ['quinta', 'qui'], ['sexta', 'sex'], ['sabado', 'sab']];
const TIPO_PALAVRAS = [[/medic|dentist|consulta|exame|pediatra|vacina|terapia|fisio|psic|ortodont|oftalmo|hospital|clinica/, 'saude'], [/escola|reuniao de pais|aula|prova|creche|faculdade/, 'escola'],
  [/aniversari/, 'aniversario'], [/viagem|voo|aeroporto|ferias/, 'viagem'], [/jantar|almoco|festa|churrasco|casamento|cafe com|encontro|cinema|show/, 'social'],
  [/futebol|academia|natacao|corrida|treino|pilates|yoga|bal[eé]/, 'esporte'], [/reuniao|trabalho|entrevista/, 'trabalho'], [/encanador|eletricista|entrega|conserto|limpeza|diarista|condominio/, 'casa']];
function lerEvento(txt) {
  let t = ' ' + String(txt).trim() + ' ';
  const sa = semAcento(t), achou = []; // trechos [ini, fim] a tirar do título
  const marca = (re) => { const m = re.exec(sa); if (m) achou.push([m.index, m.index + m[0].length]); return m; };
  const h = hoje(), pre = {};
  let m;
  if ((m = marca(/\s(depois de amanha)\s/))) pre.dia = N_somaDias(h, 2);
  else if ((m = marca(/\s(amanha)\s/))) pre.dia = N_somaDias(h, 1);
  else if ((m = marca(/\s(hoje)\s/))) pre.dia = h;
  if (!pre.dia && (m = marca(/\s(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s/))) {
    const ano = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : h.slice(0, 4), d = `${ano}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
    if (N_dataValida(d)) pre.dia = !m[3] && d < h ? `${+ano + 1}${d.slice(4)}` : d;
  }
  if (!pre.dia && (m = marca(/\sdia (\d{1,2})\s/))) { let d = N_diaDoMes(N_mes(h), +m[1]); if (d < h) d = N_diaDoMes(N_somaMes(N_mes(h), 1), +m[1]); pre.dia = d; }
  if (!pre.dia) DIAS_NOME.some(([longo, curto], i) => {
    const r = new RegExp(`\\s(?:na |no |nesta |neste |proxima |proximo )?(${longo}(?:-feira)?|${curto})\\s`);
    if ((m = marca(r))) { const n = (i - N_dataObj(h).getDay() + 7) % 7; pre.dia = N_somaDias(h, n); return true; }
    return false;
  });
  if ((m = marca(/\s(?:as |a )?(\d{1,2})(?::|h)(\d{2})?h?\s/))) { const hh = +m[1], mm = +(m[2] || 0); if (hh < 24 && mm < 60) pre.ini = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; }
  else if ((m = marca(/\s(?:ao |as )?meio[- ]dia\s/))) pre.ini = '12:00';
  pre.pessoas = [];
  membros().forEach(p => {
    const nome = semAcento(p.nome.split(' ')[0]);
    if (nome.length < 2) return;
    const r = new RegExp(`\\s(?:com |do |da |de |pro |pra |para )?(${nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\s`);
    if ((m = marca(r))) pre.pessoas.push(p.id);
  });
  if (!pre.pessoas.length) delete pre.pessoas;
  const tp = TIPO_PALAVRAS.find(([re]) => re.test(sa)); if (tp) pre.tipo = tp[1];
  if (pre.tipo === 'aniversario' && !pre.ini) pre.diaTodo = true;
  // tira do texto o que virou data, hora e pessoa
  let titulo = '';
  for (let i = 0; i < t.length; i++) if (!achou.some(([a, b]) => i > a && i < b - 1)) titulo += t[i];
  titulo = titulo.replace(/\s+/g, ' ').replace(/^\s*(?:as|na|no|de|com|dia)\s+|\s+(?:as|na|no|de|com|dia|e)\s*$/gi, '').trim();
  pre.titulo = titulo ? titulo[0].toUpperCase() + titulo.slice(1) : '';
  return pre;
}

/* ============================== exportar um compromisso (.ics) ============================== */
function icsDeEvento(e) {
  const d8 = iso => iso.replace(/-/g, ''), esc2 = x => String(x || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rotina//PT', 'BEGIN:VEVENT', `UID:${e.id}@rotina`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`];
  const fimDia = e.fim && e.fim > e.dia ? e.fim : e.dia;
  if (e.diaTodo || !e.ini) L.push(`DTSTART;VALUE=DATE:${d8(e.dia)}`, `DTEND;VALUE=DATE:${d8(N_somaDias(fimDia, 1))}`);
  else { const fimH = e.fimH || `${String(Math.min(23, +e.ini.slice(0, 2) + 1)).padStart(2, '0')}${e.ini.slice(2)}`; L.push(`DTSTART:${d8(e.dia)}T${e.ini.replace(':', '')}00`, `DTEND:${d8(fimDia)}T${fimH.replace(':', '')}00`); }
  if (e.repete) L.push(`RRULE:FREQ=${{ dia: 'DAILY', semana: 'WEEKLY', mes: 'MONTHLY', ano: 'YEARLY' }[e.repete]}${e.ate ? `;UNTIL=${d8(e.ate)}T235959Z` : ''}`);
  L.push(`SUMMARY:${esc2(e.titulo)}`);
  if (e.local) L.push(`LOCATION:${esc2(e.local)}`);
  const desc = [(e.pessoas || []).map(primeiroNome).join(', '), e.leva ? 'Quem leva: ' + primeiroNome(e.leva) : '', e.nota].filter(Boolean).join('\n');
  if (desc) L.push(`DESCRIPTION:${esc2(desc)}`);
  (e.alertas || []).forEach(m => L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc2(e.titulo)}`, `TRIGGER:${m >= 0 ? '-' : ''}PT${Math.abs(m)}M`, 'END:VALARM'));
  L.push('END:VEVENT', 'END:VCALENDAR');
  return L.join('\r\n') + '\r\n';
}

/* ============================== ações ============================== */
Object.assign(A, {
  agv: d => { S.ag = d.v; lsSet('agVisao', d.v); render(false); },
  agnav: d => { S.agDia = N_somaDias(S.agDia, +d.v); render(); },
  agmes: d => { S.agDia = N_diaDoMes(N_somaMes(N_mes(S.agDia), +d.v), 1); render(); },
  agdia: d => { S.agDia = d.v; render(); },
  fpess: d => { S.fPess = S.fPess === d.v ? '' : d.v; render(); },
  novoEvento: d => { openSheet({ k: 'evento', pre: { dia: d.dia || (S.tab === 'agenda' && S.ag !== 'lista' ? S.agDia : hoje()) } }); setTimeout(() => focar('f-titulo'), 280); },
  editarEvento: () => { const s = S.sheet; s.f = formEvento(S.d.eventos.get(s.id)); renderSheet(); },
  salvarEvento: () => {
    const s = S.sheet, f = s.f, titulo = f.titulo.trim();
    if (!titulo) { toast('Escreva o que é o compromisso.'); focar('f-titulo'); return; }
    if (!N_dataValida(f.dia)) { toast('Escolha o dia.'); return; }
    if (f.fim && (!N_dataValida(f.fim) || f.fim < f.dia)) { toast('O "até" precisa ser depois do dia.'); return; }
    if (!f.diaTodo && !/^\d{2}:\d{2}$/.test(f.ini)) { toast('Escolha o horário ou marque "dia inteiro".'); return; }
    if (!f.diaTodo && f.fimH && f.fimH <= f.ini && !(f.fim > f.dia)) { toast('O fim precisa ser depois do começo.'); return; }
    const item = { id: s.id || uidNovo(), titulo, tipo: f.tipo, dia: f.dia, fim: f.fim && f.fim > f.dia ? f.fim : '', diaTodo: !!f.diaTodo, ini: f.diaTodo ? '' : f.ini, fimH: f.diaTodo ? '' : f.fimH,
      local: String(f.local || '').trim(), pessoas: f.pessoas || [], leva: f.leva || '', repete: f.repete || '', ate: f.repete && N_dataValida(f.ate) ? f.ate : '',
      alertas: (f.alertas || []).map(Number).sort((a, b) => b - a), avisar: f.avisar || 'envolvidos', nota: String(f.nota || '').trim() };
    closeSheet(); enfileirar('salvar', { col: 'eventos', item });
    S.agDia = item.dia;
    toast(s.id ? 'Compromisso atualizado.' : `Marcado: ${titulo}, ${rotuloDia(item.dia)}${item.diaTodo ? '' : ' às ' + item.ini}.`);
  },
  excluirEvento: d => {
    const e = S.d.eventos.get(d.id); if (!e) return;
    if (d.modo === 'um') {
      if (!confirm(`Cancelar só o compromisso de ${fmtCurta(d.v)}? Os outros continuam.`)) return;
      closeSheet(); enfileirar('salvar', { col: 'eventos', item: { id: e.id, exc: [...(e.exc || []), d.v] } }); toast('Cancelado só neste dia.');
      return;
    }
    if (!confirm(e.repete ? 'Excluir todas as repetições deste compromisso?' : 'Excluir este compromisso? Some para todos.')) return;
    closeSheet(); enfileirar('excluir', { col: 'eventos', id: e.id }); toast('Excluído.');
  },
  euLevo: d => { enfileirar('salvar', { col: 'eventos', item: { id: d.id, leva: S.eu } }); toast('Combinado: você leva.'); renderSheet(); },
  duplicarEvento: d => { const e = S.d.eventos.get(d.id); if (!e) return; openSheet({ k: 'evento', f: { ...formEvento(e), dia: S.sheet && S.sheet.v || e.dia } }); toast('Cópia: mude o dia e salve.'); },
  tarefaDoEvento: d => {
    const e = S.d.eventos.get(d.id); if (!e) return;
    openSheet({ k: 'tarefa', pre: { titulo: '', prox: N_somaDias(d.v || e.dia, -1) < hoje() ? hoje() : N_somaDias(d.v || e.dia, -1), nota: `Para: ${e.titulo} (${fmtCurta(d.v || e.dia)})` } });
    setTimeout(() => focar('f-titulo'), 280);
  },
  icsEvento: d => {
    const e = S.d.eventos.get(d.id); if (!e) return;
    const blob = new Blob([icsDeEvento(e)], { type: 'text/calendar;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = (e.titulo.replace(/[^\wÀ-ú -]/g, '').trim() || 'compromisso') + '.ics';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('Abra o arquivo para adicionar ao calendário.');
  },
  salvarMembro: () => {
    const s = S.sheet, f = s.f, nome = f.nome.trim();
    if (!nome) { toast('Escreva o nome.'); focar('f-nome'); return; }
    const item = { id: s.id || uidNovo(), nome, ic: f.ic, cor: f.cor, nasc: N_dataValida(f.nasc) ? f.nasc : '' };
    const voltar = S.sheet && S.sheet.voltar;
    closeSheet(); enfileirar('salvar', { col: 'perfis', item });
    if (!s.id && item.nasc) enfileirar('salvar', { col: 'eventos', item: { id: uidNovo(), titulo: 'Aniversário de ' + nome, tipo: 'aniversario', dia: item.nasc, diaTodo: true, repete: 'ano', pessoas: [item.id], alertas: [300, -480], avisar: 'todos', ini: '', fimH: '', fim: '', local: '', leva: '', ate: '', nota: '' } });
    toast(s.id ? 'Atualizado.' : `${nome} entrou na família.`);
    if (voltar) { if (!s.id && voltar.f) voltar.f.pessoas = [...(voltar.f.pessoas || []), item.id]; openSheet(voltar); }
  },
  membroDoEvento: () => openSheet({ k: 'membro', voltar: S.sheet }),
  copiarAgenda: async () => { const u = linkAgenda(); try { await navigator.clipboard.writeText(u); toast('Endereço copiado.'); } catch (e) { const i = $('#agurl'); if (i) { i.select(); } toast('Selecione e copie o endereço.'); } }
});
