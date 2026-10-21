/* compras.js — Compras em duas partes:
   - Para comprar: o que a família quer comprar (robô aspirador, quadro da sala), com opções de loja, link e preço,
     orçamento, prazo e quem cuida. "Comprei" vira um lançamento em Finanças (no cartão, já parcelado se for o caso).
   - Mercado: a lista do mercado por corredor, com os itens da casa que voltam para a lista quando acabam. */
'use strict';

const ehPlano = c => c.lista === 'plano';
const planos = () => lista('compras').filter(ehPlano);
const mercado = () => compras().filter(c => !ehPlano(c));
const opcoesDe = c => (Array.isArray(c.opcoes) ? c.opcoes : []).filter(o => o && (o.url || o.n));
function faixaPreco(c) { const ps = opcoesDe(c).map(o => o.p).filter(x => x > 0); return ps.length ? [Math.min(...ps), Math.max(...ps)] : null; }
/** Quanto deve custar: o orçamento, ou a opção mais barata. */
const valorPlano = c => c.orc || (faixaPreco(c) || [0])[0];
const PRIOS = [['alta', 'Logo'], ['', 'Quando der'], ['baixa', 'Sem pressa']];

const LOJAS_LINK = [[/mercadolivre|mercadolibre|mlstatic/, 'Mercado Livre'], [/amazon\./, 'Amazon'], [/magazineluiza|magalu/, 'Magalu'], [/shopee/, 'Shopee'], [/americanas/, 'Americanas'],
  [/casasbahia/, 'Casas Bahia'], [/pontofrio/, 'Ponto Frio'], [/leroymerlin/, 'Leroy Merlin'], [/tokstok/, 'Tok&Stok'], [/ikea/, 'IKEA'], [/aliexpress/, 'AliExpress'], [/shein/, 'Shein'],
  [/kabum/, 'KaBuM!'], [/fastshop/, 'Fast Shop'], [/carrefour/, 'Carrefour'], [/centauro/, 'Centauro'], [/netshoes/, 'Netshoes'], [/decathlon/, 'Decathlon'], [/madeiramadeira/, 'MadeiraMadeira'], [/mobly/, 'Mobly'], [/westwing/, 'Westwing']];
/** "https://www.poraodosquadros.com.br/products/…" → "Porão dos Quadros" não dá para adivinhar; vira "Poraodosquadros". Lojas conhecidas saem com o nome certo. */
function lojaDoLink(url) {
  try {
    const h = new URL(url).hostname.replace(/^(www|m|loja|shop)\./, '');
    const k = LOJAS_LINK.find(([r]) => r.test(h)); if (k) return k[1];
    const base = h.split('.')[0]; return base ? base[0].toUpperCase() + base.slice(1) : '';
  } catch (e) { return ''; }
}
/** Nome do produto tirado do endereço: ".../robo-aspirador-de-po-v50-10000pa/p/MLB744" → "Robo aspirador de po v50 10000pa". */
function nomeDoLink(url) {
  try {
    const segs = new URL(url).pathname.split('/').map(decodeURIComponent).filter(x => /[a-z].*-.*[a-z]/i.test(x) && !/^(p|dp|products?|produto|item)$/i.test(x));
    const s = segs.sort((a, b) => b.length - a.length)[0] || '';
    const t = s.replace(/\.(html?|aspx?)$/i, '').replace(/[-_]+/g, ' ').replace(/\b(MLB|ML)\d+\b/gi, '').replace(/\s+/g, ' ').trim().slice(0, 70);
    return t ? t[0].toUpperCase() + t.slice(1) : '';
  } catch (e) { return ''; }
}
const ehUrl = t => /^https?:\/\/\S+$/i.test(String(t).trim());
const precoTxt = c => { const f = faixaPreco(c); return c.orc ? `até ${reais(c.orc)}` : f ? (f[0] === f[1] ? reais(f[0]) : `${compacto(f[0])} a ${compacto(f[1])}`) : ''; };

/* ============================== tela ============================== */
function scrCompras() {
  const nP = planos().filter(c => !c.comprado).length, nM = mercado().filter(c => !c.comprado).length;
  const aba = S.compraAba || (nM && !nP ? 'mercado' : 'plano');
  return `<div class="between"><h1 class="display">Compras</h1></div>
    <div class="seg" role="tablist"><button class="${aba === 'plano' ? 'on' : ''}" data-a="compraAba" data-v="plano" role="tab">Para comprar${nP ? ` · ${nP}` : ''}</button><button class="${aba === 'mercado' ? 'on' : ''}" data-a="compraAba" data-v="mercado" role="tab">Mercado${nM ? ` · ${nM}` : ''}</button></div>
    ${aba === 'plano' ? telaPlanos() : telaMercado()}`;
}

function linhaPlano(c) {
  const ops = opcoesDe(c), n = c.prazo ? N_diasEntre(hoje(), c.prazo) : null, partes = [];
  partes.push(ops.length ? `${ops.length} ${plu(ops.length, 'opção', 'opções')}` : 'sem opções ainda');
  if (c.comprado) partes.push('comprado ' + fmtCurta(isoLocal(c.compradoEm) || hoje()));
  const prazo = c.comprado || n == null ? '' : n < 0 ? `<span class="tag bad">passou do prazo</span>` : n <= 7 ? `<span class="tag warn">até ${rotuloDia(c.prazo)}</span>` : `<span>até ${fmtCurta(c.prazo)}</span>`;
  const quem = c.resp && c.resp !== 'ambos' && c.resp !== 'rodizio' ? `<span>${av(c.resp, 15)} ${esc(primeiroNome(c.resp))}</span>` : '';
  const anexos = anexosDe('compras:' + c.id).length;
  return `<button class="it${c.comprado ? ' feito' : ''}" data-a="sheet" data-k="compra" data-id="${c.id}"><span class="em-tile">${c.prio === 'alta' && !c.comprado ? '⭐' : '🛍️'}</span>
    <span class="main"><span class="t">${esc(c.item)}</span><span class="s"><span>${partes.join(' · ')}</span>${prazo}${quem}${anexos ? `<span>📎 ${anexos}</span>` : ''}</span></span>
    <span class="v">${esc(precoTxt(c))}</span></button>`;
}
function telaPlanos() {
  const todos = planos(), falta = todos.filter(c => !c.comprado), ok = todos.filter(c => c.comprado).sort((a, b) => String(b.compradoEm).localeCompare(String(a.compradoEm)));
  const ordem = (a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999') || String(b.em || '').localeCompare(String(a.em || ''));
  const grupos = PRIOS.map(([k, nome]) => [nome, falta.filter(c => (c.prio || '') === k).sort(ordem)]).filter(g => g[1].length);
  const total = falta.reduce((a, c) => a + valorPlano(c), 0), semPreco = falta.filter(c => !valorPlano(c)).length;
  const cat = categorias('saida').find(c => c.id === 'compras'), gastoCat = cat ? resumoMes(N_mes(hoje())).porCat.compras || 0 : 0;
  return `<form data-f="plano" class="inrow"><input class="in" id="planotxt" placeholder="O que querem comprar? Ou cole um link" maxlength="1500" autocomplete="off" enterkeyhint="done"><button class="btn" type="submit" aria-label="Adicionar">${ic('plus', 20, 2.4)}</button></form>
    ${falta.length ? `<div class="grid2"><div class="stat"><span class="tiny muted">Na lista</span><b>${falta.length} ${plu(falta.length, 'item', 'itens')}</b></div><div class="stat"><span class="tiny muted">Deve custar</span><b>${total ? compacto(total) : '—'}</b>${semPreco ? `<span class="tiny muted">${semPreco} sem preço ainda</span>` : ''}</div></div>` : ''}
    ${grupos.length ? grupos.map(([nome, l]) => secao(nome, `<span class="tiny muted">${l.length}</span>`) + listaOu(l, linhaPlano)).join('')
      : `<div class="panel">${vazio('🛍️', 'Robô aspirador, quadro da sala, presente do Arthur… Guarde aqui as opções (link e preço), o orçamento e o prazo. Quando comprar, um toque e já entra em Finanças.')}</div>`}
    ${cat && (gastoCat || cat.orc) ? `<button class="panel soft" data-a="irCat" data-v="compras" style="border:0;text-align:left;cursor:pointer;color:inherit;font:inherit"><span class="small"><b>${esc(cat.ic)} ${esc(cat.nome)}</b> este mês: ${reais(gastoCat)}${cat.orc ? ` de ${reais(cat.orc)}` : ''}</span>${cat.orc ? bar(gastoCat, cat.orc, gastoCat > cat.orc ? 'var(--bad)' : 'var(--accent)') : ''}</button>` : ''}
    ${ok.length ? `<details><summary>${secao('Comprados', `<span class="tiny muted">${ok.length}</span>`)}</summary>${listaOu(ok.slice(0, 30), linhaPlano)}</details>` : ''}`;
}
function telaMercado() {
  const todas = mercado(), falta = todas.filter(c => !c.comprado), ok = todas.filter(c => c.comprado && !c.fixo), casa = todas.filter(c => c.comprado && c.fixo).sort((a, b) => a.item.localeCompare(b.item));
  const naLista = new Set(todas.map(c => c.item.toLowerCase()));
  const hist = historicoCompras().filter(x => !naLista.has(x.toLowerCase())).slice(0, 14);
  const porSetor = SETORES.map(([id, e, n]) => [e, n, falta.filter(c => (c.setor || setorDe(c.item)) === id)]).filter(x => x[2].length);
  const ref = N_mes(hoje()), temMerc = categorias('saida').some(c => c.id === 'mercado'), gm = temMerc ? resumoMes(ref).porCat.mercado || 0 : 0, media = temMerc ? mediaCategoria(ref, 'mercado') : 0;
  return `<form data-f="compra" class="inrow"><input class="in" id="comptxt" placeholder="Ex.: 2 leite, pão, café" maxlength="200" autocomplete="off" enterkeyhint="done"><button class="btn" type="submit" aria-label="Adicionar">${ic('plus', 20, 2.4)}</button></form>
    ${casa.length ? `<div class="stack" style="gap:6px"><p class="tiny muted" style="margin:0">Itens da casa: toque no que acabou</p><div class="chips">${casa.map(c => `<button class="chip" data-a="acabou" data-id="${c.id}">${esc(c.item)}</button>`).join('')}</div></div>` : ''}
    ${hist.length ? `<div class="chips scroll">${hist.map(x => `<button class="chip" data-a="readd" data-v="${esc(x)}">+ ${esc(x)}</button>`).join('')}</div>` : ''}
    ${porSetor.length ? porSetor.map(([e, n, l]) => `<p class="dia-h">${e} ${n}</p>${listaOu(l, linhaCompra)}`).join('') : `<div class="panel">${vazio('🛒', ok.length ? 'Tudo pego. Bom trabalho!' : 'A lista está vazia. Separe vários itens com vírgula: ela se organiza pelos corredores do mercado. Café, arroz, papel higiênico: marque como "item da casa" e ele volta com um toque quando acabar.')}</div>`}
    ${ok.length ? secao('No carrinho', `<span class="tiny muted">${ok.length}</span>`) + listaOu(ok, linhaCompra) +
      `<div class="grid2"><button class="btn ghost" data-a="gastoCompras">${ic('receipt', 16)} Lançar o gasto</button><button class="btn ghost" data-a="limparCompras">${ic('trash', 16)} Limpar</button></div>` : ''}
    ${gm || media ? `<button class="panel soft" data-a="irCat" data-v="mercado" style="border:0;text-align:left;cursor:pointer;color:inherit;font:inherit"><span class="small">🛒 <b>Mercado este mês: ${reais(gm)}</b>${media ? ` · média ${reais(media)}` : ''}</span></button>` : ''}`;
}

/* ============================== painel de um item de Para comprar ============================== */
function formPlano(c) { return { modo: 'editar', item: c.item, orc: reaisInput(c.orc), prazo: c.prazo || '', prio: c.prio || '', resp: c.resp || 'ambos', cat: c.cat || '', nota: c.nota || '' }; }
function shPlano(s, c) {
  const f = s.f, ops = opcoesDe(c), donos = [['ambos', 'Os dois'], ...S.pessoas.filter(p => p.ativo !== false).map(p => [p.id, esc(primeiroNome(p.id))])];
  if (f && f.modo === 'editar') return `${head('Para comprar', 'Editar')}
    ${campo('O que comprar', inp('item', f.item, 'maxlength="80" autocomplete="off"'))}
    <div class="grid2">${campo('Orçamento (opcional)', inp('orc', f.orc, 'inputmode="decimal" placeholder="R$ 0,00" autocomplete="off"'))}${campo('Até quando (opcional)', inp('prazo', f.prazo, 'type="date"'))}</div>
    ${grupo('Prioridade', escolha('prio', f.prio, PRIOS))}
    ${grupo('Quem cuida', escolha('resp', f.resp, donos))}
    ${grupo('Categoria em Finanças', escolha('cat', f.cat, [['', 'Escolher na hora'], ...categorias('saida').map(x => [x.id, `${esc(x.ic)} ${esc(x.nome)}`])]))}
    ${campo('Observação', area('nota', f.nota, 'maxlength="800" placeholder="Medidas, cor, o que não pode faltar…" style="min-height:70px"'))}
    <button class="btn block" data-a="salvarPlano">Salvar</button>
    <button class="btn danger block" data-a="rmPlano" data-id="${c.id}">${ic('trash', 16)} Excluir</button>`;
  if (f && f.modo === 'opcao') return `${head(esc(c.item), f.i != null ? 'Editar opção' : 'Nova opção')}
    ${campo('Link (opcional)', inp('url', f.url, 'type="url" inputmode="url" placeholder="Cole o endereço do produto" autocomplete="off"'))}
    ${campo('Nome', inp('n', f.n, 'maxlength="80" placeholder="Ex.: Robô V50, cor preta" autocomplete="off"'))}
    <div class="grid2">${campo('Preço', inp('p', f.p, 'inputmode="decimal" placeholder="R$ 0,00" autocomplete="off"'))}${campo('Loja', inp('loja', f.loja, 'maxlength="40" placeholder="Ex.: Mercado Livre" autocomplete="off"'))}</div>
    <p class="tiny muted">Colou o link? Nome e loja se preenchem sozinhos ao salvar, se estiverem vazios.</p>
    <button class="btn block" data-a="salvarOpcao">Salvar opção</button>
    ${f.i != null ? `<button class="btn danger block" data-a="rmOpcao" data-i="${f.i}">${ic('trash', 16)} Tirar esta opção</button>` : ''}`;
  const l = c.lanc && S.d.lancamentos.get(c.lanc), n = c.prazo ? N_diasEntre(hoje(), c.prazo) : null, cat = c.cat && categoria(c.cat);
  const linhaOp = (o, i) => `<div class="it"><span class="em-tile">${o.url ? ic('link', 18) : '🏷️'}</span>
    <button class="main" data-a="editarOpcao" data-i="${i}"><span class="t">${esc(o.n || nomeDoLink(o.url) || 'Opção ' + (i + 1))}</span><span class="s">${[o.loja || (o.url ? lojaDoLink(o.url) : ''), o.p ? reais(o.p) : 'sem preço'].filter(Boolean).map(esc).join(' · ')}</span></button>
    <span class="stack" style="gap:6px;align-items:flex-end;flex:none">${c.comprado ? '' : `<button class="btn sm" style="padding:7px 12px" data-a="comprei" data-i="${i}">Comprei</button>`}
      ${o.url ? `<a class="link small" href="${esc(o.url)}" target="_blank" rel="noopener">Abrir ${ic('ext', 13)}</a>` : ''}</span></div>`;
  return `${head('Para comprar', esc(c.item))}
    <div class="panel soft"><div class="between"><span class="small">${c.orc ? `Orçamento <b>${reais(c.orc)}</b>` : faixaPreco(c) ? `Opções de <b>${esc(precoTxt(c))}</b>` : 'Sem orçamento'}</span>${c.prio === 'alta' ? '<span class="tag warn">logo</span>' : c.prio === 'baixa' ? '<span class="tag">sem pressa</span>' : ''}</div>
      ${[n != null && !c.comprado ? (n < 0 ? 'O prazo passou (' + fmtCurta(c.prazo) + ')' : 'Até ' + fmtData(c.prazo)) : '', c.resp && c.resp !== 'ambos' ? 'Quem cuida: ' + primeiroNome(c.resp) : '', cat ? `Entra em ${cat.ic} ${cat.nome}` : ''].filter(Boolean).map(t => `<p class="small muted" style="margin:0">${esc(t)}</p>`).join('')}
      ${c.nota ? `<p class="small" style="margin:0">${linkar(esc(c.nota))}</p>` : ''}</div>
    ${c.comprado ? `<div class="note good"><span>${ic('check', 16, 2.6)}</span><span style="flex:1">Comprado ${fmtCurta(isoLocal(c.compradoEm) || hoje())}${c.compradoPor ? ' por ' + esc(primeiroNome(c.compradoPor)) : ''}${l ? ` · ${reais(l.v)}${l.parc ? ' em ' + esc(l.parc.split('/')[1]) + 'x' : ''}` : ''}.</span>${l ? `<button class="link" data-a="sheet" data-k="lanc" data-id="${l.id}">Ver lançamento</button>` : ''}</div>` : ''}
    ${secao('Opções', `<button class="link" data-a="novaOpcao">+ Opção</button>`)}
    ${ops.length ? `<div class="lst">${ops.map(linhaOp).join('')}</div>` : '<p class="small muted">Cole o link de cada produto que vocês estão olhando, com o preço. Fica fácil comparar.</p>'}
    ${c.comprado ? `<button class="btn ghost block" data-a="naoComprei">Ainda não comprei</button>` : `<button class="btn block" data-a="comprei">${ic('check', 16, 2.6)} Comprei${ops.length > 1 ? ' (outra opção)' : ''}</button>`}
    ${blocoAnexos('compras', c.id, '', 'Fotos e referências', 'Foto de onde vai ficar, medidas, inspiração: deixe aqui.')}
    <div class="between">${criadoPor(c)}<button class="btn ghost sm" data-a="editarPlano">${ic('edit', 16)} Editar</button></div>`;
}

/* ============================== ações ============================== */
Object.assign(A, {
  compraAba: d => { S.compraAba = d.v; render(false); },
  irCat: d => { S.tab = 'financas'; S.mes = N_mes(hoje()); A.fcat({ v: d.v }); },
  acabou: d => { const c = S.d.compras.get(d.id); if (!c) return; enfileirar('salvar', { col: 'compras', item: { id: c.id, comprado: false, compradoPor: '', compradoEm: '' } }); toast(`${c.item} voltou para a lista.`); },
  novaOpcao: () => { S.sheet.f = { modo: 'opcao', url: '', n: '', p: '', loja: '' }; renderSheet(); setTimeout(() => focar('f-url'), 100); },
  editarOpcao: d => { const c = S.d.compras.get(S.sheet.id), o = c && opcoesDe(c)[+d.i]; if (!o) return; S.sheet.f = { modo: 'opcao', i: +d.i, url: o.url || '', n: o.n || '', p: reaisInput(o.p), loja: o.loja || '' }; renderSheet(); },
  salvarOpcao: () => {
    const s = S.sheet, f = s.f, c = S.d.compras.get(s.id); if (!c) return;
    const url = String(f.url || '').trim();
    if (url && !ehUrl(url)) { toast('O link precisa começar com http:// ou https://'); focar('f-url'); return; }
    const o = { url, n: String(f.n || '').trim() || nomeDoLink(url), p: lerReais(f.p || ''), loja: String(f.loja || '').trim() || (url ? lojaDoLink(url) : '') };
    if (!o.url && !o.n) { toast('Cole o link ou dê um nome à opção.'); focar('f-url'); return; }
    const ops = [...opcoesDe(c)]; if (f.i != null) ops[f.i] = o; else ops.push(o);
    s.f = null; enfileirar('salvar', { col: 'compras', item: { id: c.id, opcoes: ops.slice(0, 20) } }); renderSheet(); toast(f.i != null ? 'Opção atualizada.' : 'Opção guardada.');
  },
  rmOpcao: d => { const s = S.sheet, c = S.d.compras.get(s.id); if (!c) return; const ops = opcoesDe(c).filter((x, i) => i !== +d.i); s.f = null; enfileirar('salvar', { col: 'compras', item: { id: c.id, opcoes: ops } }); renderSheet(); },
  editarPlano: () => { S.sheet.f = formPlano(S.d.compras.get(S.sheet.id)); renderSheet(); },
  salvarPlano: () => {
    const s = S.sheet, f = s.f, item = String(f.item || '').trim();
    if (!item) { toast('Diga o que é.'); focar('f-item'); return; }
    if (f.prazo && !N_dataValida(f.prazo)) { toast('Data inválida.'); return; }
    s.f = null; enfileirar('salvar', { col: 'compras', item: { id: s.id, item, orc: lerReais(f.orc || ''), prazo: f.prazo || '', prio: f.prio || '', resp: f.resp || 'ambos', cat: f.cat || '', nota: String(f.nota || '').trim() } });
    renderSheet(); toast('Salvo.');
  },
  rmPlano: d => { const c = S.d.compras.get(d.id); if (!c || !confirm(`Tirar "${c.item}" de Para comprar?`)) return; closeSheet(); enfileirar('excluir', { col: 'compras', id: c.id }); toast('Excluído.'); },
  // Comprei: abre o lançamento já preenchido (valor da opção, descrição, categoria); ao salvar, o item fica como comprado
  comprei: d => {
    const c = S.d.compras.get(S.sheet.id); if (!c) return;
    const o = d.i != null ? opcoesDe(c)[+d.i] : opcoesDe(c).length === 1 ? opcoesDe(c)[0] : null;
    const cat = c.cat || (categorias('saida').some(x => x.id === 'compras') ? 'compras' : (categorias('saida')[0] || {}).id || '');
    openSheet({ k: 'lanc', pre: { tipo: 'saida', v: (o && o.p) || c.orc || '', desc: c.item.slice(0, 120), cat, dia: hoje(), compra: c.id, nota: o ? [o.loja, o.url].filter(Boolean).join(' · ').slice(0, 300) : '' } });
    setTimeout(() => focar('f-v'), 280);
  },
  naoComprei: () => { const c = S.d.compras.get(S.sheet.id); if (!c) return; enfileirar('salvar', { col: 'compras', item: { id: c.id, comprado: false, compradoPor: '', compradoEm: '', lanc: '' } }); toast('Voltou para Para comprar. O lançamento continua em Finanças: exclua lá se precisar.', 5000); }
});
/* Item novo em Para comprar: texto ou link colado. Abre o item para completar. */
function addPlano(txt) {
  const t = String(txt || '').trim(); if (!t) return;
  const url = ehUrl(t) ? t : '', nome = url ? (nomeDoLink(url) || 'Produto de ' + (lojaDoLink(url) || 'um link')) : t[0].toUpperCase() + t.slice(1);
  const item = { id: uidNovo(), item: nome.slice(0, 80), lista: 'plano', comprado: false, resp: 'ambos', prio: '', opcoes: url ? [{ url, n: nomeDoLink(url), p: 0, loja: lojaDoLink(url) }] : [] };
  enfileirar('salvar', { col: 'compras', item });
  openSheet({ k: 'compra', id: item.id });
}
