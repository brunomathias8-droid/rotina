/* plano.js — Plano da família: objetivos (curto, médio e longo prazo) com metas medidas pelos dados do app,
   compromissos com dono e prazo, rituais de gestão (semanal e mensal) com ata, e o placar da prestação de contas.
   A Luar propõe o plano a partir dos números; o que vocês aprovam vira objetivos, metas e compromissos de verdade. */
'use strict';

const PLANO_VERSAO = '3.8.0';
const planoServidorOk = () => !S.apiVersao || S.apiVersao.localeCompare(PLANO_VERSAO, undefined, { numeric: true }) >= 0;
const HORIZ = { curto: ['Curto prazo', 'até 6 meses'], medio: ['Médio prazo', '6 meses a 2 anos'], longo: ['Longo prazo', 'mais de 2 anos'] };
const EMOJIS_OBJ = ['🧭', '🩸', '💳', '🛟', '✈️', '🚗', '🏠', '🏖️', '👶', '🎓', '📈', '💰', '🧾', '🌱'];
const RITUAL_HORA = '20:00', RITUAL_DIA_MES = 5;

/* ============================== cálculo ============================== */
const objetivosAtivos = () => lista('objetivos').filter(o => (o.status || 'ativo') === 'ativo').sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || String(a.em).localeCompare(String(b.em)));
const metasDe = o => metas().filter(m => m.objetivo === o.id);
const compromissos = () => lista('compromissos');
const compAbertos = () => compromissos().filter(c => (c.status || 'aberto') === 'aberto').sort((a, b) => String(a.prazo || '9').localeCompare(String(b.prazo || '9')));
const compAtrasado = c => (c.status || 'aberto') === 'aberto' && c.prazo && c.prazo < hoje();
const donoNome = d => !d || d === 'ambos' ? 'Os dois' : d === S.eu ? 'Você' : primeiroNome(d);
const comigo2 = c => !c.dono || c.dono === 'ambos' || c.dono === S.eu;

/** Sinal do objetivo pelas metas dele: verde no rumo, amarelo em risco, vermelho com prazo vencido, cinza sem meta. */
function sinalObjetivo(o) {
  const ms = metasDe(o);
  if (!ms.length) return { cls: '', txt: 'sem meta', cor: 'var(--s3)' };
  const ps = ms.map(progressoMeta);
  if (ps.every(p => p.status === 'concluida')) return { cls: 'good', txt: 'cumprido', cor: 'var(--accent)' };
  if (ps.some(p => p.status === 'atencao')) return o.prazo && o.prazo < hoje() ? { cls: 'bad', txt: 'atrasado', cor: 'var(--bad)' } : { cls: 'warn', txt: 'em risco', cor: 'var(--warn)' };
  return { cls: 'good', txt: 'no rumo', cor: 'var(--accent)' };
}
/** % de compromissos cumpridos nas últimas 8 semanas (atrasados contam como não cumpridos). */
function cumprimento() {
  const ini = N_somaDias(hoje(), -56), cs = compromissos().filter(c => (c.prazo || isoLocal(c.em)) >= ini);
  const feitos = cs.filter(c => c.status === 'feito').length, nao = cs.filter(c => c.status === 'naofeito').length + cs.filter(compAtrasado).length;
  return { feitos, nao, total: feitos + nao, pct: feitos + nao ? Math.round(feitos * 100 / (feitos + nao)) : null };
}
/* Rituais: o semanal vale de quarta a terça e vence no domingo (20h); o mensal fecha o mês anterior e vence no dia 5. */
const refSemanal = h => N_segunda(N_somaDias(h, -2));
const vencSemanal = ref => N_somaDias(ref, 6);
const refMensal = h => N_somaMes(N_mes(h), -1);
const vencMensal = ref => N_diaDoMes(N_somaMes(ref, 1), RITUAL_DIA_MES);
const ritualDe = (tipo, ref) => lista('rituais').find(r => r.tipo === tipo && r.ref === ref);
const trimestral = ref => [3, 6, 9, 12].includes(+ref.slice(5, 7)); // fechando mar, jun, set, dez: revisão dos objetivos
function proximosRituais() {
  const h = hoje(), rs = refSemanal(h), rm = refMensal(h);
  return [
    { tipo: 'semanal', ref: rs, venc: vencSemanal(rs), feito: ritualDe('semanal', rs) },
    { tipo: 'mensal', ref: rm, venc: vencMensal(rm), feito: ritualDe('mensal', rm) }
  ];
}
/** Semanas seguidas com o ritual semanal feito (a semana atual só conta se já foi feito). */
function sequenciaRituais() {
  let ref = refSemanal(hoje()), n = 0;
  if (!ritualDe('semanal', ref)) ref = N_somaDias(ref, -7);
  while (ritualDe('semanal', ref) && n < 200) { n++; ref = N_somaDias(ref, -7); }
  return n;
}
const nomeRitual = r => r.tipo === 'semanal' ? `Ritual da semana` : `Fechamento de ${fmtMes(r.ref).toLowerCase()}${trimestral(r.ref) ? ' e revisão do trimestre' : ''}`;
const quandoRitual = r => r.tipo === 'semanal' ? `${fmtData(r.venc).split(',')[0]}, ${fmtCurta(r.venc)} às ${RITUAL_HORA.replace(':00', 'h')}` : `dia ${fmtCurta(r.venc)}`;

/* ============================== tela ============================== */
function scrPlano() {
  if (!planoServidorOk()) return `<h1 class="display">Plano</h1><div class="note warn"><span>O Plano precisa do servidor na versão ${PLANO_VERSAO} (o daqui está na ${esc(S.apiVersao)}). O passo a passo está em IMPLANTAR.md, “Plano da família”.</span></div>`;
  carregarProposta();
  const objs = objetivosAtivos(), abertos = compAbertos(), cum = cumprimento(), seq = sequenciaRituais(), h = hoje();
  const prox = proximosRituais(), prop = PLANO.proposta;
  const semMeta = metas().filter(m => !m.objetivo || !S.d.objetivos.get(m.objetivo));
  const topo = `<div class="between"><h1 class="display">Plano</h1><button class="btn sm" data-a="sheet" data-k="comp">${ic('plus', 16, 2.4)} Compromisso</button></div>`;
  const cartaoProposta = prop ? `<div class="panel hero"><p class="h2" style="color:inherit">🌙 A Luar preparou um plano</p><p class="small" style="opacity:.85">${esc(prop.resumo || '')}</p><p class="small" style="opacity:.85">${(prop.objetivos || []).length} objetivos · ${(prop.objetivos || []).reduce((a, o) => a + (o.metas || []).length, 0)} metas · ${(prop.compromissos || []).length} compromissos. Vocês aprovam item por item.</p><button class="btn block" style="background:var(--on-accent);color:var(--accent)" data-a="sheet" data-k="proposta">Revisar a proposta</button></div>` : '';
  const vazioPlano = !objs.length && !prop ? `<div class="panel"><p class="h2">Montar o plano da família</p><p class="small muted">Objetivos de curto, médio e longo prazo, metas medidas pelos números do app, compromissos com dono e prazo, e um ritual por semana para prestar contas.</p>
      ${PLANO.gerando ? `<p class="small"><b>A Luar está lendo os números e montando a proposta…</b> leva até 2 minutos.</p>` : `<button class="btn block" data-a="planoLuar">🌙 A Luar propõe, nós aprovamos</button>`}<button class="btn ghost block" data-a="sheet" data-k="objetivo">Criar um objetivo à mão</button></div>` : '';
  const placar = `<div class="panel"><div class="grid2">
      <div class="stat"><span class="tiny muted">Compromissos cumpridos (8 semanas)</span><b>${cum.pct == null ? '—' : cum.pct + '%'}</b><span class="tiny muted">${cum.total ? `${cum.feitos} de ${cum.total}` : 'nenhum ainda'}</span></div>
      <div class="stat"><span class="tiny muted">Rituais seguidos</span><b>${seq} ${plu(seq, 'semana')}</b><span class="tiny muted">${seq ? '🔥 não deixem quebrar' : 'comecem neste domingo'}</span></div></div>
    ${prox.map(r => { const atras = !r.feito && r.venc < h, hojeR = !r.feito && r.venc === h, cont = PLANO.rascunho && PLANO.rascunho.tipo === r.tipo && PLANO.rascunho.ref === r.ref;
      return `<div class="between ritual-l"><span><b>${esc(nomeRitual(r))}</b><br><span class="small ${atras ? 'c-bad' : 'muted'}">${r.feito ? '✅ feito em ' + fmtCurta(r.feito.dia) : (atras ? 'atrasado · era ' : hojeR ? 'hoje · ' : '') + quandoRitual(r)}</span></span>
        ${r.feito ? `<button class="btn ghost sm" data-a="sheet" data-k="ata" data-id="${r.feito.id}">Ata</button>` : `<button class="btn sm ${atras || hojeR ? '' : 'ghost'}" data-a="ritual" data-tipo="${r.tipo}" data-v="${r.ref}">${cont ? 'Continuar' : 'Fazer agora'}</button>`}</div>`; }).join('')}</div>`;
  const comps = abertos.length ? listaOu(abertos, linhaComp) : `<div class="panel">${vazio('🤝', 'Nenhum compromisso aberto. Eles nascem nos rituais (ou com a Luar): o quê, quem e até quando.')}</div>`;
  const porHoriz = Object.entries(HORIZ).map(([k, [nome, desc]]) => {
    const os = objs.filter(o => (o.horiz || 'curto') === k);
    return os.length ? secao(`${nome} <span class="tiny muted" style="font-family:inherit">${desc}</span>`) + os.map(cartaoObjetivo).join('') : '';
  }).join('');
  const atas = lista('rituais').sort((a, b) => b.dia.localeCompare(a.dia));
  return `${topo}${cartaoProposta}${vazioPlano}${COL_INI}
    ${secao('Prestação de contas')}${placar}
    ${secao('Compromissos', abertos.filter(compAtrasado).length ? `<span class="tag bad">${abertos.filter(compAtrasado).length} ${plu(abertos.filter(compAtrasado).length, 'atrasado', 'atrasados')}</span>` : '')}${comps}
    ${COL_MEIO}${porHoriz}
    ${objs.length ? `<button class="btn ghost block" data-a="sheet" data-k="objetivo">+ Objetivo</button>` : ''}
    ${semMeta.length && objs.length ? secao('Metas sem objetivo') + listaOu(semMeta, linhaMeta) : ''}
    ${atas.length ? `<details>${'<summary>' + secao('Atas dos rituais', `<span class="tiny muted">${atas.length}</span>`) + '</summary>'}${listaOu(atas, r => `<button class="it" data-a="sheet" data-k="ata" data-id="${r.id}"><span class="em-tile">📋</span><span class="main"><span class="t">${esc(nomeRitual(r))}</span><span class="s">${fmtCurta(r.dia)} · ${esc(resumoAta(r))}</span></span></button>`)}</details>` : ''}
    ${COL_FIM}`;
}
function linhaComp(c) {
  const atras = compAtrasado(c), m = c.meta && S.d.metas.get(c.meta);
  return `<button class="it" data-a="sheet" data-k="comp" data-id="${c.id}">${av(c.dono && c.dono !== 'ambos' ? c.dono : S.eu, 30)}
    <span class="main"><span class="t">${esc(c.texto)}</span><span class="s">${esc(donoNome(c.dono))}${c.prazo ? ` · <span class="${atras ? 'c-bad' : ''}">${atras ? 'atrasado desde ' : 'até '}${fmtCurta(c.prazo)}</span>` : ''}${m ? ` · ${esc(m.ic || '🎯')} ${esc(m.nome)}` : ''}</span></span></button>`;
}
function cartaoObjetivo(o) {
  const ms = metasDe(o), sn = sinalObjetivo(o), cs = compAbertos().filter(c => c.objetivo === o.id || ms.some(m => m.id === c.meta));
  return `<div class="panel objetivo"><button class="obj-cab" data-a="sheet" data-k="objetivo" data-id="${o.id}"><span class="em-tile">${esc(o.ic || '🧭')}</span>
      <span class="main"><span class="between"><span class="t">${esc(o.nome)}</span><span class="tag ${sn.cls}">${sn.txt}</span></span>
      <span class="s">${o.prazo ? 'até ' + fmtMesCurto(o.prazo) + ' · ' : ''}${esc(donoNome(o.dono))}${cs.length ? ` · ${cs.length} ${plu(cs.length, 'compromisso')}` : ''}</span></span></button>
    ${o.porque ? `<p class="small muted" style="margin:0">${esc(o.porque)}</p>` : ''}
    ${ms.length ? listaOu(ms, linhaMeta) : `<button class="btn ghost sm" data-a="metaDoObjetivo" data-id="${o.id}">+ Meta para medir</button>`}</div>`;
}
const resumoAta = r => { const a = r.ata || {}, rv = a.revisados || []; return `${rv.filter(x => x.status === 'feito').length}/${rv.length} cumpridos · ${(a.novos || []).length} novos`; };

/* ============================== compromisso ============================== */
const pessoasEscolha = () => [['ambos', 'Os dois']].concat(S.pessoas.filter(p => p.ativo !== false).map(p => [p.id, esc(primeiroNome(p.id))]));
const opcMetas = () => [['', 'Nenhuma']].concat(metas().map(m => [m.id, `${esc(m.ic || '🎯')} ${esc(m.nome)}`]));
SH.comp = s => {
  const c = s.id && S.d.compromissos.get(s.id);
  if (s.id && !c) return sumiu('Compromisso');
  if (c && !s.f) {
    const st = c.status || 'aberto', m = c.meta && S.d.metas.get(c.meta);
    return `${head(esc(donoNome(c.dono)) + (c.prazo ? ' · até ' + fmtCurta(c.prazo) : ''), esc(c.texto))}
      ${m ? `<p class="small muted">Move a meta ${esc(m.ic || '🎯')} <b>${esc(m.nome)}</b></p>` : ''}
      ${st === 'feito' ? `<div class="note"><span>✅ Cumprido em ${fmtCurta(c.fechadoEm || hoje())}.</span></div>` : ''}
      ${st === 'naofeito' ? `<div class="note warn"><span>❌ Não cumprido${c.fechadoEm ? ' (' + fmtCurta(c.fechadoEm) + ')' : ''}. Motivo: ${esc(c.motivo || '—')}</span></div>` : ''}
      ${st === 'aberto' ? (s.nao ? `${campo('Por que não deu? (sem desculpa vaga: o que aconteceu e o que muda)', area('motivo', s.motivo || '', 'maxlength="300" id="f-motivo"'))}<button class="btn block danger" data-a="compNao" data-id="${c.id}">Registrar que não cumpri</button><button class="btn ghost block" data-a="compNaoVolta">Voltar</button>`
        : `<div class="grid2"><button class="btn" data-a="compFeito" data-id="${c.id}">✓ Cumpri</button><button class="btn ghost" data-a="compNaoAbre">✗ Não cumpri</button></div>`)
        : `<button class="btn ghost block" data-a="compReabrir" data-id="${c.id}">Reabrir</button>`}
      <button class="btn ghost block" data-a="compEditar">${ic('edit', 16)} Editar</button>
      <button class="btn danger block" data-a="excluir" data-col="compromissos" data-id="${c.id}">${ic('trash', 16)} Excluir</button>${criadoPor(c)}`;
  }
  if (!s.f) s.f = { texto: '', dono: S.eu, prazo: N_somaDias(hoje(), 7), meta: s.meta || '' };
  const f = s.f;
  return `${head(c ? 'Editar compromisso' : 'Novo compromisso', 'O quê, quem e até quando')}
    ${campo('O que vai ser feito', inp('texto', f.texto, 'maxlength="160" placeholder="Ex.: cancelar 2 assinaturas e o cartão adicional" autocomplete="off"'))}
    ${grupo('Quem', escolha('dono', f.dono, pessoasEscolha()))}
    ${campo('Até quando', inp('prazo', f.prazo, 'type="date"'))}
    ${metas().length ? campo('Qual meta isso move (opcional)', `<select class="in" data-i="meta">${opcMetas().map(([v, l]) => `<option value="${esc(v)}"${f.meta === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`) : ''}
    <button class="btn block" data-a="salvarComp">Salvar</button>`;
};

/* ============================== objetivo ============================== */
SH.objetivo = s => {
  const o = s.id && S.d.objetivos.get(s.id);
  if (s.id && !o) return sumiu('Objetivo');
  if (o && !s.f) {
    const ms = metasDe(o), sn = sinalObjetivo(o), cs = compromissos().filter(c => c.objetivo === o.id || ms.some(m => m.id === c.meta));
    return `${head(`${HORIZ[o.horiz || 'curto'][0]}${o.prazo ? ' · até ' + fmtMesCurto(o.prazo) : ''} · ${esc(donoNome(o.dono))}`, `${esc(o.ic || '🧭')} ${esc(o.nome)}`)}
      <div class="between"><span class="tag ${sn.cls}">${sn.txt}</span>${o.status === 'concluido' ? '<span class="tag good">concluído</span>' : ''}</div>
      ${o.porque ? `<div class="panel soft"><p class="tiny muted" style="margin:0">Por que importa</p><p class="small" style="margin:0">${esc(o.porque)}</p></div>` : ''}
      ${secao('Metas')}${ms.length ? listaOu(ms, linhaMeta) : '<p class="small muted">Sem meta, não dá para saber se está no rumo.</p>'}
      <button class="btn ghost block" data-a="metaDoObjetivo" data-id="${o.id}">+ Meta para medir</button>
      ${secao('Compromissos')}${cs.length ? listaOu(cs.sort((a, b) => String(b.prazo).localeCompare(String(a.prazo))).slice(0, 12), linhaComp) : '<p class="small muted">Nenhum ainda.</p>'}
      <button class="btn ghost block" data-a="compDoObjetivo" data-id="${o.id}">+ Compromisso</button>
      <button class="btn ghost block" data-a="objEditar">${ic('edit', 16)} Editar objetivo</button>
      <div class="grid2"><button class="btn ghost" data-a="objStatus" data-id="${o.id}" data-v="${o.status === 'concluido' ? 'ativo' : 'concluido'}">${o.status === 'concluido' ? 'Reabrir' : '🏁 Concluído'}</button><button class="btn ghost" data-a="objStatus" data-id="${o.id}" data-v="arquivado">Arquivar</button></div>
      <button class="btn danger block" data-a="excluir" data-col="objetivos" data-id="${o.id}">${ic('trash', 16)} Excluir objetivo</button>`;
  }
  if (!s.f) s.f = o ? { nome: o.nome, ic: o.ic || '🧭', horiz: o.horiz || 'curto', porque: o.porque || '', prazo: o.prazo || '', dono: o.dono || 'ambos' } : { nome: '', ic: '🧭', horiz: 'curto', porque: '', prazo: '', dono: 'ambos' };
  const f = s.f;
  return `${head(o ? 'Editar objetivo' : 'Novo objetivo', esc(f.nome) || 'Onde a família quer chegar')}
    ${campo('Objetivo', inp('nome', f.nome, 'maxlength="80" placeholder="Ex.: Parar de fechar o mês no vermelho" autocomplete="off"'))}
    ${grupo('Ícone', `<div class="emojis">${EMOJIS_OBJ.map(e => `<button class="${f.ic === e ? 'on' : ''}" data-a="f" data-k="ic" data-v="${e}">${e}</button>`).join('')}</div>`)}
    ${grupo('Horizonte', segm('horiz', f.horiz, Object.entries(HORIZ).map(([k, v]) => [k, v[0]])))}
    ${campo('Por que importa', area('porque', f.porque, 'maxlength="400" placeholder="O motivo de verdade: é ele que segura a disciplina" style="min-height:70px"'))}
    ${campo('Até quando', inp('prazo', f.prazo, 'type="date"'))}
    ${grupo('Dono', escolha('dono', f.dono, pessoasEscolha()))}
    <button class="btn block" data-a="salvarObj">Salvar objetivo</button>`;
};

/* ============================== ritual (passo a passo) ============================== */
function passosRitual(s) {
  return s.tipo === 'semanal' ? ['placar', 'compromissos', 'novos', 'fechar']
    : ['fechamento', 'metas'].concat(trimestral(s.ref) ? ['objetivos'] : [], ['compromissos', 'novos', 'fechar']);
}
const TITULOS_PASSO = { placar: 'Placar da semana', fechamento: 'Como fechou o mês', metas: 'Metas e objetivos', objetivos: 'Revisão do trimestre', compromissos: 'Prestação de contas', novos: 'Compromissos da próxima etapa', fechar: 'Fechar o ritual' };
const compsDoRitual = s => compAbertos().filter(c => !c.prazo || c.prazo <= (s.tipo === 'semanal' ? vencSemanal(s.ref) : vencMensal(s.ref)));
const linhaMetaFixa = m => { const p = progressoMeta(m), st = STATUS_META[p.status]; return `<div class="stack" style="gap:4px"><div class="between small"><span><b>${esc(m.ic || '🎯')} ${esc(m.nome)}</b></span><span class="tag ${st[0]}">${st[1]}</span></div>${bar(p.pct, 1, p.cor || (p.status === 'atencao' ? 'var(--warn)' : 'var(--accent)'))}<span class="tiny muted">${esc(p.linha)}</span></div>`; };
function placarAgora() {
  const ref = N_mes(hoje()), prev = previsaoMes(ref), ms = metas().map(progressoMeta), cum = cumprimento();
  return { saldoPrev: prev.saldo, rec: prev.rec, desp: prev.desp, metasOk: ms.filter(p => p.status !== 'atencao').length, metasAtencao: ms.filter(p => p.status === 'atencao').length,
    revisar: lancs().filter(aRevisar).length, cumprimento: cum.pct };
}
SH.ritual = s => {
  const ps = passosRitual(s), passo = ps[s.passo || 0], f = s.f, h = hoje();
  const pontos = `<div class="passos">${ps.map((p, i) => `<span class="${i === s.passo ? 'on' : i < s.passo ? 'ok' : ''}"></span>`).join('')}</div>`;
  let corpo = '';
  if (passo === 'placar') {
    const pl = placarAgora();
    corpo = `<div class="panel soft"><p class="tiny muted" style="margin:0">Previsão de ${MESES[+N_mes(h).slice(5) - 1]}</p><p class="saldo ${pl.saldoPrev < 0 ? 'c-bad' : ''}" style="font-size:30px">${reais(pl.saldoPrev, true)}</p>
        <p class="small muted" style="margin:0">Entra ${reais(pl.rec)} · sai ${reais(pl.desp)}</p></div>
      ${metas().length ? `<div class="panel">${metas().map(linhaMetaFixa).join('')}</div>` : '<p class="small muted">Sem metas ainda: o placar fica no saldo.</p>'}
      ${pl.revisar ? `<div class="note warn"><span>${pl.revisar} ${plu(pl.revisar, 'lançamento', 'lançamentos')} sem categoria (Extrato › Revisar). Sem isso, o placar mente.</span></div>` : ''}
      ${blocoLuarRitual(s)}`;
  } else if (passo === 'fechamento') {
    const r = resumoMes(s.ref), estouros = categorias('saida').filter(c => c.orc && (r.porCat[c.id] || 0) > c.orc).map(c => ({ c, g: r.porCat[c.id] }));
    const top = Object.entries(r.porCat).sort((a, b) => b[1] - a[1]).slice(0, 6);
    corpo = `<div class="panel soft"><p class="tiny muted" style="margin:0">${fmtMes(s.ref)}</p><p class="saldo ${r.rec - r.desp < 0 ? 'c-bad' : ''}" style="font-size:30px">${reais(r.rec - r.desp, true)}</p><p class="small muted" style="margin:0">Entrou ${reais(r.rec)} · saiu ${reais(r.desp)} · investido ${reais(r.inv)}</p></div>
      ${estouros.length ? `<div class="note warn"><span><b>Estourou o teto:</b> ${estouros.map(x => `${esc(x.c.nome)} (${reais(x.g)} de ${reais(x.c.orc)})`).join(', ')}.</span></div>` : '<div class="note"><span>Nenhuma categoria passou do teto.</span></div>'}
      <div class="panel"><p class="small muted" style="margin:0">Para onde foi o dinheiro</p>${top.map(([id, v]) => `<div class="between small"><span>${esc(categoria(id).ic)} ${esc(categoria(id).nome)}</span><span class="num">${reais(v)}</span></div>`).join('')}</div>
      <button class="btn ghost block" data-a="ritualTetos">Ajustar os tetos do mês</button>
      ${blocoLuarRitual(s)}`;
  } else if (passo === 'metas' || passo === 'objetivos') {
    const objs = objetivosAtivos();
    corpo = `${objs.map(o => { const sn = sinalObjetivo(o); return `<div class="panel"><div class="between"><b>${esc(o.ic || '🧭')} ${esc(o.nome)}</b><span class="tag ${sn.cls}">${sn.txt}</span></div>${passo === 'objetivos' && o.porque ? `<p class="small muted" style="margin:0">${esc(o.porque)}</p>` : ''}${metasDe(o).map(linhaMetaFixa).join('')}</div>`; }).join('')}
      ${metas().filter(m => !m.objetivo).length ? `<div class="panel">${metas().filter(m => !m.objetivo).map(linhaMetaFixa).join('')}</div>` : ''}
      ${passo === 'objetivos' ? '<div class="note"><span>Revisão do trimestre: os objetivos ainda fazem sentido? Prazo e valor continuam realistas? Anotem no fim do ritual o que muda; depois ajustem tocando no objetivo.</span></div>' : ''}`;
  } else if (passo === 'compromissos') {
    const cs = compsDoRitual(s);
    corpo = cs.length ? `<p class="small muted">Cada compromisso que venceu: cumpriu ou não. Se não, o motivo de verdade.</p>${cs.map(c => { const v = s.revis[c.id]; return `<div class="panel"><div class="between"><span><b>${esc(c.texto)}</b><br><span class="tiny muted">${esc(donoNome(c.dono))}${c.prazo ? ' · até ' + fmtCurta(c.prazo) : ''}</span></span></div>
        <div class="grid2"><button class="btn sm ${v === 'feito' ? '' : 'ghost'}" data-a="ritRevis" data-id="${c.id}" data-v="feito">✓ Cumpriu</button><button class="btn sm ${v === 'naofeito' ? 'danger' : 'ghost'}" data-a="ritRevis" data-id="${c.id}" data-v="naofeito">✗ Não cumpriu</button></div>
        ${v === 'naofeito' ? inp('mot:' + c.id, f['mot:' + c.id] || '', 'maxlength="300" placeholder="O que aconteceu e o que muda" autocomplete="off"') : ''}</div>`; }).join('')}`
      : '<div class="panel">' + vazio('🤝', 'Nenhum compromisso venceu nesta etapa.') + '</div>';
  } else if (passo === 'novos') {
    const emRisco = metas().filter(m => progressoMeta(m).status === 'atencao');
    corpo = `${emRisco.length ? `<div class="note warn"><span><b>Metas em risco:</b> ${emRisco.map(m => esc(m.nome)).join(', ')}. Cada uma merece pelo menos um compromisso.</span></div>` : ''}
      ${s.novos.length ? listaOu(s.novos, (n, i) => `<div class="it"><span class="em-tile">🤝</span><span class="main"><span class="t">${esc(n.texto)}</span><span class="s">${esc(donoNome(n.dono))} · até ${fmtCurta(n.prazo)}</span></span><button class="x" data-a="ritTiraNovo" data-i="${i}" aria-label="Tirar">${ic('x', 16)}</button></div>`) : ''}
      <div class="panel soft">${campo('Novo compromisso', inp('ntexto', f.ntexto, 'maxlength="160" placeholder="Ex.: zero delivery de segunda a quinta" autocomplete="off"'))}
        ${grupo('Quem', escolha('ndono', f.ndono, pessoasEscolha()))}${campo('Até quando', inp('nprazo', f.nprazo, 'type="date"'))}
        ${metas().length ? campo('Move qual meta', `<select class="in" data-i="nmeta">${opcMetas().map(([v, l]) => `<option value="${esc(v)}"${(f.nmeta || '') === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`) : ''}
        <button class="btn ghost block" data-a="ritNovo">+ Adicionar</button></div>`;
  } else {
    const rv = Object.values(s.revis), feitos = rv.filter(v => v === 'feito').length;
    corpo = `<div class="panel soft"><p class="small" style="margin:0">${rv.length ? `<b>${feitos} de ${rv.length}</b> compromissos cumpridos.` : 'Nenhum compromisso para prestar contas.'} ${s.novos.length} ${plu(s.novos.length, 'compromisso novo', 'compromissos novos')}.</p></div>
      ${campo('Decisões e combinados (vai para a ata)', area('notas', f.notas, 'maxlength="1500" placeholder="O que decidimos, o que muda, o que precisamos lembrar" style="min-height:90px"'))}
      <button class="btn block" data-a="ritConcluir">Concluir ritual</button>`;
  }
  return `${head(`${esc(nomeRitual(s))} · passo ${s.passo + 1} de ${ps.length}`, TITULOS_PASSO[passo])}${pontos}<div class="stack">${corpo}</div>
    <div class="grid2 ritual-nav">${s.passo ? '<button class="btn ghost" data-a="ritPasso" data-v="-1">Voltar</button>' : '<span></span>'}${passo !== 'fechar' ? '<button class="btn" data-a="ritPasso" data-v="1">Próximo</button>' : '<span></span>'}</div>`;
};
function blocoLuarRitual(s) {
  if (!luarServidorOk() || (LUAR.dados && !LUAR.dados.ativa)) return ''; // Luar desligada no servidor
  return s.luar ? `<div class="bolha luar" style="max-width:100%"><p class="tiny muted">Luar</p><div>${luarTexto(s.luar)}</div></div>`
    : `<button class="btn ghost block" data-a="ritLuar" ${s.lendo ? 'disabled' : ''}>${s.lendo ? 'A Luar está lendo os números…' : '🌙 Pedir a leitura da Luar'}</button>`;
}
SH.ata = s => {
  const r = S.d.rituais.get(s.id); if (!r) return sumiu('Ata');
  const a = r.ata || {}, pl = a.placar || {};
  return `${head(`Feito em ${fmtCurta(r.dia)}${r.por ? ' por ' + esc(nomeDe(r.por)) : ''}`, `📋 ${esc(nomeRitual(r))}`)}
    <div class="panel soft"><div class="grid2"><div class="stat"><span class="tiny muted">Saldo previsto do mês</span><b class="${pl.saldoPrev < 0 ? 'c-bad' : ''}">${pl.saldoPrev != null ? reais(pl.saldoPrev, true) : '—'}</b></div><div class="stat"><span class="tiny muted">Metas em risco</span><b>${pl.metasAtencao != null ? pl.metasAtencao : '—'}</b></div></div></div>
    ${(a.revisados || []).length ? secao('Prestação de contas') + `<div class="panel">${a.revisados.map(x => `<p class="small" style="margin:0">${x.status === 'feito' ? '✅' : '❌'} <b>${esc(x.texto)}</b> · ${esc(x.dono || '')}${x.motivo ? `<br><span class="muted">${esc(x.motivo)}</span>` : ''}</p>`).join('')}</div>` : ''}
    ${(a.novos || []).length ? secao('Compromissos assumidos') + `<div class="panel">${a.novos.map(x => `<p class="small" style="margin:0">🤝 <b>${esc(x.texto)}</b> · ${esc(x.dono || '')} · até ${fmtCurta(x.prazo)}</p>`).join('')}</div>` : ''}
    ${a.notas ? secao('Decisões') + `<div class="panel"><p class="small" style="margin:0;white-space:pre-wrap">${esc(a.notas)}</p></div>` : ''}
    ${a.luar ? secao('Leitura da Luar') + `<div class="bolha luar" style="max-width:100%"><div>${luarTexto(a.luar)}</div></div>` : ''}`;
};

/* ============================== proposta da Luar ============================== */
const PLANO = { proposta: null, gerando: false, carregou: false, rascunho: null };
function carregarProposta() {
  if (PLANO.carregou || !navigator.onLine || !planoServidorOk() || !S.sessao) return;
  PLANO.carregou = true;
  api('luar', { op: 'proposta' }).then(r => { PLANO.proposta = r.proposta || null; if (PLANO.proposta && S.tab === 'plano') render(); }).catch(() => { PLANO.carregou = false; });
}
/* Meta da proposta que o app consegue medir: tipo conhecido e, se for de categoria, uma categoria que existe */
const metaValida = m => !!TIPOS_META[m.tipo] && !(m.tipo === 'reduzir' && m.metrica === 'cat' && !categorias('saida').some(c => c.id === m.cat));
const donoPorNome = n => { const t = normImp(n); if (!t || /ambos|dois|casal/.test(t)) return 'ambos'; const p = S.pessoas.find(x => normImp(x.nome).split(' ')[0] === t.split(' ')[0]); return p ? p.id : 'ambos'; };
SH.proposta = s => {
  const p = PLANO.proposta; if (!p) return head('Luar', 'Proposta') + vazio('🌙', 'Nenhuma proposta pendente.');
  if (!s.sel) { s.sel = {}; (p.objetivos || []).forEach((o, i) => { s.sel['o' + i] = true; (o.metas || []).forEach((m, j) => { s.sel[`o${i}m${j}`] = metaValida(m); }); }); (p.compromissos || []).forEach((c, i) => { s.sel['c' + i] = true; }); }
  const ck = (k, html) => `<div class="it imp${s.sel[k] ? '' : ' feito'}"><button class="ck${s.sel[k] ? ' on' : ''}" data-a="propSel" data-v="${k}" aria-label="Incluir">${ic('check', 16, 2.4)}</button><div class="main">${html}</div></div>`;
  const descMeta = m => m.tipo === 'saldo' ? `fechar o mês com sobra ≥ ${reais(Math.round((m.alvo || 0) * 100))}` : m.tipo === 'mensal' ? `investir ${reais(Math.round((m.alvo || 0) * 100))} por mês` : m.tipo === 'juntar' ? `juntar ${reais(Math.round((m.alvo || 0) * 100))}${m.prazo ? ' até ' + fmtMesCurto(m.prazo) : ''}` : `${METRICAS[m.metrica] || 'gasto'}${m.metrica === 'cat' && m.cat ? ' (' + categoria(m.cat).nome + ')' : ''} até ${reais(Math.round((m.alvo || 0) * 100))}`;
  const n = Object.values(s.sel).filter(Boolean).length;
  return `${head('Proposta da Luar', 'Revisem e aprovem')}
    ${p.resumo ? `<div class="bolha luar" style="max-width:100%"><div>${luarTexto(p.resumo)}</div></div>` : ''}
    ${(p.objetivos || []).map((o, i) => `${secao(`${esc(o.ic || '🧭')} ${esc(o.nome)}`, `<span class="tiny muted">${esc((HORIZ[o.horiz] || HORIZ.curto)[0])}</span>`)}
      <div class="lst">${ck('o' + i, `<span class="t">Objetivo${o.prazo ? ' até ' + fmtMesCurto(o.prazo) : ''} · ${esc(o.dono || 'os dois')}</span><span class="s">${esc(o.porque || '')}</span>`)}
      ${(o.metas || []).map((m, j) => metaValida(m) ? ck(`o${i}m${j}`, `<span class="t">${esc(m.ic || '🎯')} ${esc(m.nome)}</span><span class="s">${esc(descMeta(m))}</span>`) : `<div class="it imp feito"><span class="em-tile">⚠️</span><div class="main"><span class="t">${esc(m.nome)}</span><span class="s">Não dá para medir no app (categoria “${esc(m.cat || '?')}” não existe): fica de fora.</span></div></div>`).join('')}</div>`).join('')}
    ${(p.compromissos || []).length ? secao('Primeiros compromissos') + `<div class="lst">${p.compromissos.map((c, i) => ck('c' + i, `<span class="t">${esc(c.texto)}</span><span class="s">${esc(c.dono || 'os dois')}${c.prazo ? ' · até ' + fmtCurta(c.prazo) : ''}</span>`)).join('')}</div>` : ''}
    <button class="btn block" data-a="propAprovar" ${n ? '' : 'disabled'}>Aprovar ${n} ${plu(n, 'item', 'itens')}</button>
    <button class="btn ghost block" data-a="propDescartar">Descartar a proposta</button>
    <p class="tiny muted">Depois de aprovado, tudo pode ser editado no Plano.</p>`;
};

/* ============================== ações ============================== */
const fecharComp = (c, status, motivo) => enfileirar('salvar', { col: 'compromissos', item: { id: c.id, status, motivo: motivo || '', fechadoEm: status === 'aberto' ? '' : hoje() } });
Object.assign(A, {
  compFeito: d => { const c = S.d.compromissos.get(d.id); if (!c) return; fecharComp(c, 'feito'); closeSheet(); toast('Cumprido. É assim que se muda o jogo.'); },
  compNaoAbre: () => { S.sheet.nao = true; renderSheet(); focar('f-motivo'); },
  compNaoVolta: () => { S.sheet.nao = false; renderSheet(); },
  compNao: d => {
    const c = S.d.compromissos.get(d.id), mot = String(($('#f-motivo') || {}).value || '').trim();
    if (mot.length < 8) { toast('Escreva o motivo de verdade (o que aconteceu e o que muda).'); focar('f-motivo'); return; }
    fecharComp(c, 'naofeito', mot); closeSheet(); toast('Registrado. Vai para a ata do próximo ritual.');
  },
  compReabrir: d => { const c = S.d.compromissos.get(d.id); if (c) { fecharComp(c, 'aberto'); renderSheet(); } },
  compEditar: () => { const c = S.d.compromissos.get(S.sheet.id); S.sheet.f = { texto: c.texto, dono: c.dono || 'ambos', prazo: c.prazo || '', meta: c.meta || '' }; renderSheet(); },
  compDoObjetivo: d => openSheet({ k: 'comp', objetivo: d.id }),
  salvarComp: () => {
    const s = S.sheet, f = s.f, texto = String(f.texto || '').trim();
    if (!texto) { toast('Escreva o compromisso.'); focar('f-texto'); return; }
    if (!N_dataValida(f.prazo)) { toast('Compromisso sem prazo não é compromisso: escolha a data.'); focar('f-prazo'); return; }
    const item = { id: s.id || uidNovo(), texto, dono: f.dono || 'ambos', prazo: f.prazo, meta: f.meta || '' };
    if (!s.id) { item.status = 'aberto'; item.objetivo = s.objetivo || ''; item.origem = 'app'; }
    enfileirar('salvar', { col: 'compromissos', item }); closeSheet(); toast(s.id ? 'Compromisso atualizado.' : 'Compromisso assumido.');
  },
  objEditar: () => { S.sheet.f = null; const o = S.d.objetivos.get(S.sheet.id); S.sheet.f = { nome: o.nome, ic: o.ic || '🧭', horiz: o.horiz || 'curto', porque: o.porque || '', prazo: o.prazo || '', dono: o.dono || 'ambos' }; renderSheet(); },
  salvarObj: () => {
    const s = S.sheet, f = s.f, nome = String(f.nome || '').trim();
    if (!nome) { toast('Dê um nome ao objetivo.'); focar('f-nome'); return; }
    if (f.prazo && !N_dataValida(f.prazo)) { toast('Data inválida.'); return; }
    const item = { id: s.id || uidNovo(), nome, ic: f.ic, horiz: f.horiz, porque: String(f.porque || '').trim(), prazo: f.prazo || '', dono: f.dono || 'ambos' };
    if (!s.id) { item.status = 'ativo'; item.ordem = objetivosAtivos().length; }
    enfileirar('salvar', { col: 'objetivos', item }); closeSheet(); S.tab = 'plano'; render(false); toast(s.id ? 'Objetivo atualizado.' : 'Objetivo criado. Agora, uma meta para medir.');
  },
  objStatus: d => { enfileirar('salvar', { col: 'objetivos', item: { id: d.id, status: d.v } }); closeSheet(); toast(d.v === 'concluido' ? '🏁 Objetivo concluído!' : d.v === 'arquivado' ? 'Objetivo arquivado.' : 'Objetivo reaberto.'); },
  metaDoObjetivo: d => openSheet({ k: 'meta', f: { nome: '', ic: '🎯', tipo: 'juntar', alvo: '', prazo: '', itens: [], metrica: '', cat: '', nota: '', objetivo: d.id } }),
  ritual: d => {
    const r = PLANO.rascunho && PLANO.rascunho.tipo === d.tipo && PLANO.rascunho.ref === d.v ? PLANO.rascunho
      : { k: 'ritual', tipo: d.tipo, ref: d.v, passo: 0, revis: {}, novos: [], f: { notas: '', ntexto: '', ndono: 'ambos', nprazo: d.tipo === 'semanal' ? N_somaDias(vencSemanal(d.v), 7) : N_somaDias(hoje(), 30), nmeta: '' } };
    PLANO.rascunho = r; openSheet(r);
  },
  ritPasso: d => {
    const s = S.sheet, ps = passosRitual(s), passo = ps[s.passo];
    if (+d.v > 0 && passo === 'compromissos') {
      const cs = compsDoRitual(s), falta = cs.filter(c => !s.revis[c.id]), semMot = cs.filter(c => s.revis[c.id] === 'naofeito' && String(s.f['mot:' + c.id] || '').trim().length < 8);
      if (falta.length) { toast(`Falta dizer se ${falta.length === 1 ? '1 compromisso foi cumprido' : falta.length + ' compromissos foram cumpridos'}.`); return; }
      if (semMot.length) { toast('Todo "não cumpriu" precisa do motivo de verdade.'); return; }
    }
    s.passo = clamp(s.passo + +d.v, 0, ps.length - 1); renderSheet(); const el = $('.sheet'); if (el) el.scrollTop = 0;
  },
  ritRevis: d => { const s = S.sheet; s.revis[d.id] = s.revis[d.id] === d.v ? undefined : d.v; if (!s.revis[d.id]) delete s.revis[d.id]; renderSheet(); if (d.v === 'naofeito') { const el = document.getElementById('f-mot:' + d.id); if (el) el.focus({ preventScroll: true }); } },
  ritNovo: () => {
    const s = S.sheet, f = s.f, texto = String(f.ntexto || '').trim();
    if (!texto) { toast('Escreva o compromisso.'); focar('f-ntexto'); return; }
    if (!N_dataValida(f.nprazo)) { toast('Escolha até quando.'); return; }
    s.novos.push({ id: uidNovo(), texto, dono: f.ndono || 'ambos', prazo: f.nprazo, meta: f.nmeta || '' }); f.ntexto = ''; renderSheet(); focar('f-ntexto');
  },
  ritTiraNovo: d => { S.sheet.novos.splice(+d.i, 1); renderSheet(); },
  ritualTetos: () => { PLANO.rascunho = S.sheet; openSheet({ k: 'orcamento' }); toast('Ajustem os tetos e salvem. O ritual continua de onde parou no Plano.', 6000); },
  ritLuar: async () => {
    const s = S.sheet; s.lendo = true; renderSheet();
    try {
      const r = await api('luar', { op: 'falar', texto: `[Ritual ${s.tipo === 'semanal' ? 'da semana' : 'do mês ' + s.ref}] Faça a leitura do placar em até 6 linhas: o que está bom, o que está em risco e qual deve ser o compromisso mais importante desta etapa.` }, { timeout: 180000 });
      s.luar = r.resposta; if (LUAR.dados) LUAR.dados.mensagens = r.mensagens;
    } catch (e) { toast(e.message, 6000); }
    finally { s.lendo = false; if (S.sheet === s) renderSheet(); }
  },
  ritConcluir: () => {
    const s = S.sheet, revisados = [];
    Object.entries(s.revis).forEach(([id, st]) => {
      const c = S.d.compromissos.get(id); if (!c) return;
      const mot = st === 'naofeito' ? String(s.f['mot:' + id] || '').trim() : '';
      fecharComp(c, st, mot); revisados.push({ texto: c.texto, dono: donoNome(c.dono), status: st, motivo: mot });
    });
    s.novos.forEach(n => enfileirar('salvar', { col: 'compromissos', item: { id: n.id, texto: n.texto, dono: n.dono, prazo: n.prazo, meta: n.meta, objetivo: '', status: 'aberto', origem: 'ritual' } }));
    const ata = { placar: placarAgora(), revisados, novos: s.novos.map(n => ({ texto: n.texto, dono: donoNome(n.dono), prazo: n.prazo })), notas: String(s.f.notas || '').trim(), luar: s.luar || '' };
    enfileirar('salvar', { col: 'rituais', item: { id: uidNovo(), tipo: s.tipo, ref: s.ref, dia: hoje(), ata } });
    PLANO.rascunho = null; closeSheet(); S.tab = 'plano'; render(false);
    const seq = sequenciaRituais();
    toast(s.tipo === 'semanal' ? `Ritual concluído: ${seq} ${plu(seq, 'semana seguida', 'semanas seguidas')}. 🔥` : 'Fechamento do mês concluído. A ata está no Plano.', 6000);
  },
  planoLuar: async () => {
    if (!navigator.onLine) { toast('A Luar precisa de internet.'); return; }
    PLANO.gerando = true; render();
    try { const r = await api('luar', { op: 'gerarPlano' }, { timeout: 300000 }); PLANO.proposta = r.proposta; openSheet({ k: 'proposta' }); }
    catch (e) { toast(e.message, 7000); }
    finally { PLANO.gerando = false; render(); }
  },
  propSel: d => { const s = S.sheet; if (/m\d+$/.test(d.v) && !s.sel[d.v] && !s.sel[d.v.replace(/m\d+$/, '')]) s.sel[d.v.replace(/m\d+$/, '')] = true; s.sel[d.v] = !s.sel[d.v]; if (/^o\d+$/.test(d.v) && !s.sel[d.v]) Object.keys(s.sel).forEach(k => { if (k.startsWith(d.v + 'm')) s.sel[k] = false; }); renderSheet(); },
  propAprovar: async () => {
    const s = S.sheet, p = PLANO.proposta, ids = {}, base = objetivosAtivos().length;
    let nO = 0, nM = 0, nC = 0;
    (p.objetivos || []).forEach((o, i) => {
      const comMetas = (o.metas || []).some((m, j) => s.sel[`o${i}m${j}`]);
      if (!s.sel['o' + i] && !comMetas) return;
      let oid = '';
      if (s.sel['o' + i]) {
        oid = ids[i] = uidNovo();
        enfileirar('salvar', { col: 'objetivos', item: { id: oid, nome: String(o.nome || 'Objetivo').slice(0, 80), ic: o.ic || '🧭', horiz: HORIZ[o.horiz] ? o.horiz : 'curto', porque: String(o.porque || '').slice(0, 400), prazo: N_dataValida(o.prazo) ? o.prazo : '', dono: donoPorNome(o.dono), status: 'ativo', ordem: base + i } }); nO++;
      }
      (o.metas || []).forEach((m, j) => {
        if (!s.sel[`o${i}m${j}`] || !metaValida(m)) return;
        const metrica = m.tipo === 'reduzir' ? (METRICAS[m.metrica] ? m.metrica : 'cartao') : '', cat = metrica === 'cat' && categorias('saida').some(c => c.id === m.cat) ? m.cat : '';
        if (metrica === 'cat' && !cat) return;
        const item = { id: uidNovo(), nome: String(m.nome || o.nome).slice(0, 60), ic: m.ic || '🎯', tipo: m.tipo, alvo: Math.max(0, Math.round((Number(m.alvo) || 0) * 100)), prazo: m.tipo === 'juntar' && N_dataValida(m.prazo) ? m.prazo : '',
          itens: [], metrica, cat, nota: '', ativa: true, objetivo: oid, inicio: hoje() };
        if (metrica === 'divida') { item.itens = dividas().map(x => x.id); item.base = valorReduzir(item, N_mes(hoje())); }
        enfileirar('salvar', { col: 'metas', item }); nM++;
      });
    });
    (p.compromissos || []).forEach((c, i) => {
      if (!s.sel['c' + i]) return;
      const oi = Number.isInteger(c.objetivo) ? c.objetivo : -1;
      enfileirar('salvar', { col: 'compromissos', item: { id: uidNovo(), texto: String(c.texto || '').slice(0, 160), dono: donoPorNome(c.dono), prazo: N_dataValida(c.prazo) ? c.prazo : N_somaDias(hoje(), 7), meta: '', objetivo: ids[oi] || '', status: 'aberto', origem: 'luar' } }); nC++;
    });
    PLANO.proposta = null; closeSheet(); S.tab = 'plano'; render(false);
    toast(`Plano aprovado: ${nO} ${plu(nO, 'objetivo')}, ${nM} ${plu(nM, 'meta')} e ${nC} ${plu(nC, 'compromisso')}.`, 7000);
    try { await api('luar', { op: 'descartarProposta' }); } catch (e) { /* fica para a próxima */ }
  },
  propDescartar: async () => {
    if (!confirm('Descartar a proposta da Luar?')) return;
    PLANO.proposta = null; closeSheet(); render();
    try { await api('luar', { op: 'descartarProposta' }); } catch (e) { toast(e.message); }
  }
});

/* Cartão do Plano na tela Hoje: compromissos que vencem logo e o ritual do dia */
function cartaoPlanoHoje() {
  if (!planoServidorOk()) return '';
  const h = hoje(), lim = N_somaDias(h, 3), cs = compAbertos().filter(c => comigo2(c) && c.prazo && c.prazo <= lim);
  const rits = proximosRituais().filter(r => !r.feito && r.venc <= h);
  if (!cs.length && !rits.length) return '';
  return `${secao('🧭 Plano', `<button class="link" data-a="tab" data-v="plano">Ver plano</button>`)}
    ${rits.map(r => `<div class="panel ritual-hoje"><div class="between"><span><b>${esc(nomeRitual(r))}</b><br><span class="small ${r.venc < h ? 'c-bad' : 'muted'}">${r.venc < h ? 'atrasado desde ' + fmtCurta(r.venc) : 'hoje às ' + RITUAL_HORA.replace(':00', 'h')} · uns 20 minutos, os dois juntos</span></span><button class="btn sm" data-a="ritual" data-tipo="${r.tipo}" data-v="${r.ref}">Fazer</button></div></div>`).join('')}
    ${cs.length ? listaOu(cs, linhaComp) : ''}`;
}
