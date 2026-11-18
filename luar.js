/* luar.js — Finanças › Luar: a coach financeira da casa. A conversa fica no servidor (aba Luar), então precisa de internet. */
'use strict';

const LUAR_VERSAO = '3.6.0';
const LUAR = { dados: null, carregando: false, erro: '', enviando: false, txt: '' };
const LUAR_ATALHOS = ['Como estamos este mês?', 'Posso gastar com isso?', 'Monte nosso plano de curto, médio e longo prazo', 'Onde estamos vazando dinheiro?', 'Check-in da semana'];
const luarServidorOk = () => !S.apiVersao || S.apiVersao.localeCompare(LUAR_VERSAO, undefined, { numeric: true }) >= 0;

function carregarLuar(forcar) {
  if (LUAR.carregando || (LUAR.dados && !forcar) || !navigator.onLine || !luarServidorOk()) return;
  LUAR.carregando = true; LUAR.erro = '';
  api('luar', { op: 'conversa' }, { timeout: 60000 })
    .then(d => { LUAR.dados = d; guardarUltimaLuar(d.mensagens); })
    .catch(e => { LUAR.erro = e.message; })
    .finally(() => { LUAR.carregando = false; if (S.tab === 'financas' && S.fv === 'luar') render(); if (S.sheet && S.sheet.k === 'luarAjustes') renderSheet(); });
}
function guardarUltimaLuar(ms) {
  const u = (ms || []).filter(m => m.papel === 'luar').pop();
  if (u) lsSet('luarUltima', JSON.stringify({ texto: u.texto.slice(0, 400), quando: u.quando }));
}
/* Texto da Luar: escapa tudo, depois *negrito* e quebras de linha */
const luarTexto = t => esc(t).replace(/\*\*?([^*\n]+)\*\*?/g, '<b>$1</b>').replace(/\n/g, '<br>');
const luarQuando = iso => { const d = new Date(iso); return (isoLocal(iso) === hoje() ? '' : fmtCurta(isoLocal(iso)) + ' ') + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

function finLuar() {
  const D = LUAR.dados;
  if (!luarServidorOk()) return `<div class="note warn"><span>A Luar precisa do servidor na versão ${LUAR_VERSAO} ou mais nova (o daqui está na ${esc(S.apiVersao)}). O passo a passo está em IMPLANTAR.md, “Ligar a Luar”.</span></div>`;
  if (!D) {
    carregarLuar();
    if (!navigator.onLine) return `<div class="note"><span>A Luar precisa de internet para conversar.</span></div>`;
    return LUAR.erro ? `<div class="note warn"><span>Não deu para falar com a Luar: ${esc(LUAR.erro)} <button class="link" data-a="luarRecarregar">Tentar de novo</button></span></div>` : `<div class="panel">${vazio('🌙', 'Chamando a Luar…')}</div>`;
  }
  const msgs = D.mensagens || [];
  setTimeout(rolarLuar, 0);
  const topo = `<div class="panel luar-topo"><div class="between"><div><p class="h2">🌙 Luar</p><p class="small muted">Coach financeira da casa. Lê os números do Rotina${D.banco && D.banco.ligado ? ' e dos bancos' : ''} e cobra vocês de manhã, à tarde e à noite.</p></div>
    <button class="btn ghost sm" data-a="sheet" data-k="luarAjustes">Ajustes</button></div></div>`;
  if (!D.ativa) return topo + `<div class="note warn"><span><b>A Luar ainda está desligada.</b> Falta pôr a chave da API da Anthropic no Apps Script (propriedade ANTHROPIC_API_KEY) e rodar <b>ativarLuar</b>. O passo a passo está em IMPLANTAR.md, “Ligar a Luar”.</span></div>`;
  const avisos = [];
  if (!D.perfil) avisos.push(`<div class="note warn"><span>Conte para a Luar quem vocês são: renda, dívidas, filhos, sonhos. <button class="link" data-a="sheet" data-k="luarAjustes">Preencher o perfil</button></span></div>`);
  const bolhas = msgs.length ? msgs.map(m => {
    const luar = m.papel === 'luar', eu = !luar && m.pessoa === S.eu;
    const quem = luar ? (m.canal === 'aviso' ? 'Luar · aviso' : 'Luar') : (eu ? 'Você' : esc(primeiroNome(m.pessoa)));
    return `<div class="bolha ${luar ? 'luar' : eu ? 'eu' : 'outro'}"><p class="tiny muted">${quem} · ${luarQuando(m.quando)}${m.canal === 'telegram' ? ' · Telegram' : ''}</p><div>${luarTexto(m.texto)}</div></div>`;
  }).join('') : vazio('🌙', 'Comecem perguntando "como estamos este mês?". A Luar não vai passar a mão na cabeça.');
  return `${topo}${avisos.join('')}
    <div class="luar-msgs" id="luarmsgs">${bolhas}${LUAR.enviando ? `<div class="bolha luar pensando"><p class="tiny muted">Luar</p><div>Olhando os números…</div></div>` : ''}</div>
    <div class="chips scroll">${LUAR_ATALHOS.map(t => `<button class="chip" data-a="luarAtalho" data-v="${esc(t)}" ${LUAR.enviando ? 'disabled' : ''}>${esc(t)}</button>`).join('')}</div>
    <form data-f="luar" class="luar-form"><textarea class="in" id="luartxt" data-i="luartxt" rows="2" maxlength="2000" placeholder="Fale com a Luar (ou desabafe)…" ${LUAR.enviando ? 'disabled' : ''}>${esc(LUAR.txt)}</textarea>
      <button class="btn" type="submit" ${LUAR.enviando ? 'disabled' : ''}>${LUAR.enviando ? '…' : 'Enviar'}</button></form>
    <p class="tiny muted">A conversa vai para a Anthropic (Claude) com os números da casa. Custo da Luar neste mês: US$ ${fmt(D.custoMes || 0, 2)}.</p>`;
}
function rolarLuar() { const el = $('#luarmsgs'); if (el) el.scrollTop = el.scrollHeight; }

async function enviarLuar(texto) {
  texto = String(texto || '').trim(); if (!texto || LUAR.enviando) return;
  if (!navigator.onLine) { toast('Sem internet: a Luar só conversa on-line.'); return; }
  const D = LUAR.dados;
  LUAR.enviando = true; LUAR.txt = '';
  if (D) D.mensagens = (D.mensagens || []).concat([{ id: 'tmp', quando: new Date().toISOString(), papel: 'pessoa', pessoa: S.eu, canal: 'app', texto }]);
  render(); rolarLuar();
  try {
    const r = await api('luar', { op: 'falar', texto }, { timeout: 180000 });
    if (D) D.mensagens = r.mensagens;
    guardarUltimaLuar(r.mensagens);
    carregarLuar(true);
  } catch (e) {
    if (D) D.mensagens = D.mensagens.filter(m => m.id !== 'tmp');
    LUAR.txt = texto; toast(e.message, 6000);
  } finally { LUAR.enviando = false; render(); rolarLuar(); }
}

/* Cartão da Luar na tela Hoje: a última coisa que ela disse */
function cartaoLuar() {
  let u = null; try { u = JSON.parse(lsGet('luarUltima') || 'null'); } catch (e) { /* ok */ }
  if (!u) return '';
  return `${secao('🌙 Luar', `<button class="link" data-a="irLuar">Responder</button>`)}<div class="panel luar-hoje" data-a="irLuar"><p class="tiny muted">${luarQuando(u.quando)}</p><p class="small">${luarTexto(u.texto.length > 280 ? u.texto.slice(0, 277) + '…' : u.texto)}</p></div>`;
}

/* ============ do banco para o app: qual conta do banco é qual cartão ou conta do Rotina ============ */
function luarMapaBanco(s, bc) {
  if (!bc.lista) return `<div class="note warn"><span>Para as transações do banco virarem lançamentos, atualize o servidor para a versão 3.7 (IMPLANTAR.md, “Do banco para os lançamentos”).</span></div>`;
  const lista = bc.lista;
  if (!lista.length) return '';
  if (!s.f.mapa) { s.f.mapa = {}; Object.entries(bc.mapa || {}).forEach(([k, m]) => { s.f.mapa[k] = m.tipo + ':' + m.id; }); s.f.ofdesde = bc.desde || N_somaMes(N_mes(hoje()), -1) + '-01'; }
  const ks = cartoes(), cs = contasBancarias();
  const op = (c, v, l) => `<option value="${esc(v)}"${(s.f.mapa[c.id] || '') === v ? ' selected' : ''}>${esc(l)}</option>`;
  const opc = c => op(c, '', 'Não lançar')
    + (ks.length ? `<optgroup label="Cartões">${ks.map(k => op(c, 'cartao:' + k.id, k.nome)).join('')}</optgroup>` : '')
    + (cs.length ? `<optgroup label="Contas">${cs.map(p => op(c, 'carteira:' + p.id, p.nome)).join('')}</optgroup>` : '');
  return `<div class="panel soft"><p class="small" style="margin:0"><b>O que vira lançamento.</b> Diga qual conta do banco é qual cartão ou conta do app. As transações viram lançamentos sozinhas a cada busca (de 4 em 4 horas) e entram em tudo: extrato, orçamento, faturas, resumo e Luar. O que vocês já lançaram à mão é reconhecido e não duplica; o que ficar sem categoria vai para Extrato › Revisar.</p>
    ${lista.map(c => campo(`${esc(c.inst)} · ${esc(c.nome)}${c.tipo === 'cartao' ? ' (cartão)' : ''}`, `<select class="in" data-i="ofmapa:${esc(c.id)}">${opc(c)}</select>`)).join('')}
    ${!cs.length ? '<p class="tiny muted" style="margin:0">Para lançar o que sai da conta corrente (Pix, débito, boletos), cadastre as contas em Finanças › Patrimônio › Conta.</p>' : ''}
    ${campo('Lançar a partir de', inp('ofdesde', s.f.ofdesde, 'type="date"'))}
    <button class="btn block" data-a="luarMapa" ${s.salvandoMapa ? 'disabled' : ''}>${s.salvandoMapa ? 'Lançando…' : 'Salvar e lançar'}</button>
    ${bc.pendentes ? `<p class="tiny muted" style="margin:0">${bc.pendentes} ${plu(bc.pendentes, 'transação', 'transações')} do banco ainda sem lançamento (contas marcadas “Não lançar”, de antes da data ou pagamento de fatura sem cartão definido).</p>` : ''}</div>`;
}

/* ============ painel de ajustes ============ */
SH.luarAjustes = s => {
  const D = LUAR.dados || {};
  if (!s.f) s.f = { perfil: D.perfil || '', caderno: D.caderno || '' };
  const tg = D.telegram || {}, bc = D.banco || {};
  return head('Luar', 'Ajustes da coach') + `<div class="stack">
    ${campo('Perfil da família', area('perfil', s.f.perfil, 'rows="9" maxlength="4000" placeholder="Renda de cada um, dívidas, filhos, o que tira o sono, sonhos para 1, 5 e 20 anos, onde o dinheiro escapa…"'))}
    <p class="tiny muted">A Luar lê isto em toda conversa. Fica só no Apps Script de vocês, não no código do app.</p>
    ${campo('Caderno da Luar (compromissos e decisões que ela anotou)', area('caderno', s.f.caderno, 'rows="6" maxlength="6000"'))}
    <button class="btn block" data-a="luarSalvarAjustes">Salvar perfil e caderno</button>
    ${secao('Telegram')}
    ${!tg.ligado ? `<div class="note"><span>Desligado. Para ligar: criar um bot no @BotFather, pôr o token na propriedade TELEGRAM_TOKEN do Apps Script e rodar ativarLuar (IMPLANTAR.md, “Ligar a Luar”).</span></div>`
      : `<div class="note"><span>${tg.vinculado ? '✅ Seu Telegram já está vinculado.' : 'Seu Telegram ainda não está vinculado.'}${s.codigo ? ` Mande <b>/vincular ${esc(s.codigo)}</b> para ${tg.bot ? '<b>@' + esc(tg.bot) + '</b>' : 'o bot'} (vale 30 minutos).` : ''}</span></div>
        <button class="btn ghost block" data-a="luarTelegram">${tg.vinculado ? 'Vincular outro aparelho' : 'Gerar código para vincular'}</button>`}
    ${secao('Bancos (Open Finance)')}
    ${!bc.ligado ? `<div class="note"><span>Desligado. Com o MeuPluggy (gratuito, só leitura) a Luar vê saldos, faturas e gastos direto dos bancos, todo dia, mesmo sem ninguém lançar. Passo a passo em IMPLANTAR.md.</span></div>`
      : `<div class="note"><span>Última busca: ${bc.quando ? luarQuando(bc.quando) : 'ainda não'} · ${bc.contas} contas · ${bc.transacoes} transações dos últimos 95 dias${bc.criados ? ` · ${bc.criados} ${plu(bc.criados, 'lançamento novo', 'lançamentos novos')}` : ''}.${bc.erros && bc.erros.length ? ' Erro: ' + esc(bc.erros[0]) : ''}</span></div>
        <button class="btn ghost block" data-a="luarBanco" ${s.buscando ? 'disabled' : ''}>${s.buscando ? 'Buscando…' : 'Buscar agora'}</button>
        ${luarMapaBanco(s, bc)}`}
    <p class="tiny muted">Modelo: ${esc(D.modelo || '')}. Custo neste mês: US$ ${fmt(D.custoMes || 0, 2)}.</p>
  </div>`;
};

Object.assign(A, {
  luarRecarregar: () => { LUAR.erro = ''; carregarLuar(true); render(); },
  luarAtalho: d => {
    if (d.v !== 'Posso gastar com isso?') return enviarLuar(d.v);
    LUAR.txt = 'Posso gastar R$  com '; render(); const t = $('#luartxt'); if (t) { t.focus(); t.setSelectionRange(16, 16); }
  },
  irLuar: () => { S.tab = 'financas'; S.fv = 'luar'; render(false); },
  luarSalvarAjustes: async () => {
    const f = S.sheet.f;
    await api('luar', { op: 'perfil', perfil: f.perfil });
    const r = await api('luar', { op: 'caderno', caderno: f.caderno });
    if (LUAR.dados) { LUAR.dados.perfil = f.perfil; LUAR.dados.caderno = r.caderno; }
    toast('Guardado. A Luar já usa na próxima conversa.');
  },
  luarTelegram: async () => {
    const r = await api('luar', { op: 'telegram' });
    S.sheet.codigo = r.codigo; if (LUAR.dados) LUAR.dados.telegram = r; renderSheet();
  },
  luarMapa: async () => {
    const s = S.sheet, mapa = {};
    Object.entries(s.f.mapa || {}).forEach(([k, v]) => { if (v) { const [tipo, id] = v.split(':'); mapa[k] = { tipo, id }; } });
    s.salvandoMapa = true; renderSheet();
    try {
      const r = await api('luar', { op: 'bancoMapa', mapa, desde: s.f.ofdesde || '' }, { timeout: 300000 });
      if (LUAR.dados) LUAR.dados.banco = r.banco;
      toast(r.criados || r.ligados ? `${r.criados} ${plu(r.criados, 'lançamento criado', 'lançamentos criados')}${r.ligados ? ` e ${r.ligados} que já estavam no app reconhecidos` : ''}.` : 'Guardado. Nada novo para lançar agora.', 7000);
      sincronizar();
    } finally { if (S.sheet) { S.sheet.salvandoMapa = false; renderSheet(); } }
  },
  luarBanco: async () => {
    S.sheet.buscando = true; renderSheet();
    try { const r = await api('luar', { op: 'banco' }, { timeout: 300000 }); if (LUAR.dados) LUAR.dados.banco = r.banco; toast('Bancos atualizados.'); sincronizar(); }
    finally { if (S.sheet) { S.sheet.buscando = false; renderSheet(); } }
  }
});
