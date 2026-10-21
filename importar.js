/* importar.js — importar a fatura do cartão de uma planilha (modelo do app, CSV/Excel do banco, OFX ou colado do Excel).
   Cada compra importada guarda a fatura de onde veio (campo fat): cai exatamente nela, mesmo parcela de compra antiga.
   Nada é lançado sem revisão; o que já está no app é reconhecido e fica de fora (dá para importar a mesma fatura de novo sem duplicar). */
'use strict';

const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const IMP_MAX = 600;
const MODELO_CSV = 'Data;Descrição;Valor;Categoria;Parcela;Observação\r\n05/10/2026;Supermercado Pão de Açúcar;245,90;Mercado;;\r\n07/10/2026;Geladeira Brastemp;350,00;Compras e roupas;3/10;\r\n12/10/2026;Netflix;55,90;Assinaturas;;\r\n14/10/2026;Estorno Amazon;-89,90;Compras e roupas;;devolução\r\n';

/* ============================== ler o arquivo ============================== */
const normImp = t => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
function carregarXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = XLSX_URL; s.async = true;
    s.onload = () => window.XLSX ? res(window.XLSX) : rej(new Error('Não deu para abrir o leitor de Excel.'));
    s.onerror = () => rej(new Error('Para ler arquivo do Excel é preciso internet na primeira vez. Ou salve como CSV.'));
    document.head.appendChild(s);
  });
}
function textoDe(buf) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, ''); }
  catch (e) { return new TextDecoder('windows-1252').decode(buf); } // CSV de banco costuma vir em Latin-1
}
/* CSV com aspas; o separador (; , ou tab) é o que mais aparece nas primeiras linhas */
function lerCsv(t) {
  const amostra = t.split(/\r?\n/).slice(0, 8).join('\n');
  const sep = [';', '\t', ','].map(c => [c, amostra.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
  const linhas = []; let lin = [], cel = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cel += '"'; i++; } else q = false; } else cel += c; continue; }
    if (c === '"') q = true;
    else if (c === sep) { lin.push(cel); cel = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; lin.push(cel); linhas.push(lin); lin = []; cel = ''; }
    else cel += c;
  }
  if (cel || lin.length) { lin.push(cel); linhas.push(lin); }
  return linhas.filter(l => l.some(x => String(x).trim()));
}
/* OFX (exportado por vários bancos): uma linha por <STMTTRN> */
function lerOfx(t) {
  const tag = (b, n) => { const m = b.match(new RegExp('<' + n + '>([^<\\r\\n]*)', 'i')); return m ? m[1].trim() : ''; };
  const out = [['Data', 'Descrição', 'Valor']];
  t.split(/<STMTTRN>/i).slice(1).forEach(b => {
    const d = tag(b, 'DTPOSTED'), v = tag(b, 'TRNAMT');
    if (d && v) out.push([`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, tag(b, 'MEMO') || tag(b, 'NAME'), v.replace(',', '.')]);
  });
  return out;
}
async function matrizDoArquivo(f) {
  const buf = await f.arrayBuffer(), nome = f.name.toLowerCase();
  if (/\.(xlsx|xlsm|xls|ods)$/.test(nome)) {
    const X = await carregarXlsx(), wb = X.read(new Uint8Array(buf), { type: 'array' });
    // a aba com mais linhas é a das compras
    const abas = wb.SheetNames.map(n => X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }));
    return abas.sort((a, b) => b.length - a.length)[0] || [];
  }
  const t = textoDe(buf);
  if (/\.ofx$/.test(nome) || /<OFX>/i.test(t)) return lerOfx(t);
  return lerCsv(t);
}

/* ============================== entender as colunas ============================== */
const COLS_IMP = {
  dia: [/data.*compra|compra.*data/, /^(data|date|dt)$/, /^data\b(?!.*venc)/, /data/],
  desc: [/descri/, /estabelecimento|historico|lancamento|^title$|titulo/, /loja|detalhe|^nome$/],
  v: [/valor.*r\$|r\$.*valor|valor.*real|valor \(em r\$\)/, /^valor$|^amount$|^value$/, /^(?!.*(us|usd|dolar|cotacao)).*(valor|amount|preco)/],
  cat: [/categ/], parc: [/parcela|installment|^parc/], obs: [/obs|nota|coment/], tipo: [/^tipo$/]
};
function acharCabecalho(m) {
  for (let i = 0; i < Math.min(15, m.length); i++) {
    const h = m[i].map(normImp), col = {};
    Object.entries(COLS_IMP).forEach(([k, regs]) => {
      for (const r of regs) { const j = h.findIndex((x, jj) => r.test(x) && !Object.values(col).includes(jj)); if (j >= 0) { col[k] = j; break; } }
    });
    if (col.dia != null && col.v != null) return { lin: i, col };
  }
  // sem cabeçalho: adivinha pelo conteúdo (coluna de datas, de valores e o texto mais longo)
  const n = Math.max(...m.slice(0, 30).map(l => l.length)), conta = f => [...Array(n).keys()].map(j => m.slice(0, 30).filter(l => f(l[j])).length);
  const ds = conta(x => !!lerData(x, '2026-01')), vs = conta(x => lerValor(x) != null && !lerData(x, '2026-01')), ts = conta(x => typeof x === 'string' && /[a-z]{3}/i.test(x) && lerValor(x) == null);
  const melhor = a => a.indexOf(Math.max(...a));
  if (Math.max(...ds) < 1 || Math.max(...vs) < 1) return null;
  return { lin: -1, col: { dia: melhor(ds), v: melhor(vs), desc: melhor(ts) } };
}
const MESES_IMP = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
/* Datas: 05/10/2026, 05/10/26, 2026-10-05, 05/10 (sem ano), "05 out", número de série do Excel */
function lerData(x, ref, k) {
  if (x instanceof Date) return N_iso(x);
  if (typeof x === 'number') return x > 20000 && x < 80000 ? new Date(Math.round((x - 25569) * 864e5)).toISOString().slice(0, 10) : '';
  const t = normImp(x);
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return N_dataValida(`${m[1]}-${m[2]}-${m[3]}`) ? `${m[1]}-${m[2]}-${m[3]}` : '';
  let d, mes, ano;
  if ((m = t.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/))) { d = +m[1]; mes = +m[2]; ano = m[3] ? +m[3] : null; }
  else if ((m = t.match(/^(\d{1,2})\s*(?:de\s*)?([a-z]{3})[a-z]*\.?(?:\s*(?:de\s*)?(\d{2,4}))?$/)) && MESES_IMP.includes(m[2])) { d = +m[1]; mes = MESES_IMP.indexOf(m[2]) + 1; ano = m[3] ? +m[3] : null; }
  else return '';
  if (ano != null && ano < 100) ano += 2000;
  const iso = a => `${a}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  if (ano == null) {
    // sem ano: a data mais recente que ainda cabe antes do vencimento da fatura
    const lim = k ? N_vencimento(k, ref) : ref + '-28', y = +ref.slice(0, 4);
    ano = [y + 1, y, y - 1].find(a => N_dataValida(iso(a)) && iso(a) <= lim) || y;
  }
  return N_dataValida(iso(ano)) ? iso(ano) : '';
}
/* Valores: 1.234,56 · 1234.56 · R$ -45,90 · (45,90) · 45,90- · número do Excel. Volta em centavos. */
function lerValor(x) {
  if (typeof x === 'number') return isFinite(x) ? Math.round(x * 100) : null;
  let t = String(x == null ? '' : x).replace(/\s|R\$|BRL/gi, '');
  if (!t || !/\d/.test(t) || /[a-z]/i.test(t)) return null;
  let neg = /^-|-$|^\(.*\)$|^−/.test(t);
  t = t.replace(/[()−+-]/g, '');
  if (!/^[\d.,]+$/.test(t)) return null;
  const ult = Math.max(t.lastIndexOf(','), t.lastIndexOf('.'));
  if (t.includes(',') && t.includes('.')) t = t.slice(0, ult).replace(/[.,]/g, '') + '.' + t.slice(ult + 1);
  else if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = parseFloat(t);
  return isFinite(n) ? Math.round(n * 100) * (neg ? -1 : 1) : null;
}
/* "LOJA X PARC 03/10", "Geladeira 3/10", "Parcela 2 de 6" */
function lerParcela(t) {
  const m = String(t || '').match(/(?:parc(?:ela)?\.?\s*)?(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\s*$/i) || String(t || '').match(/parc(?:ela)?\.?\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})/i);
  if (!m) return null;
  const a = +m[1], b = +m[2];
  return a >= 1 && b >= 2 && a <= b && b <= 48 ? { k: a, n: b, tira: m[0] } : null;
}

/* ============================== categoria ============================== */
const PISTAS_CAT = [
  ['mercado', /supermerc|mercado(?! ?livre|pago)|atacad|assai|carrefour|pao de acucar|hortifruti|sacolao|padaria|acougue|hipermerc|sams club|makro|zona sul|st marche|oba hort/],
  ['transporte', /uber(?! ?eats)|99 ?(app|pop|taxi|tecnologia)|posto|combust|shell|ipiranga|petrobras|br mania|estacion|pedagio|sem parar|veloe|conectcar|metro|onibus|cabify|indrive|autopass|bilhete unico/],
  ['delivery', /ifood|rappi|uber ?eats|restaur|lanchon|burger|mc ?donald|\bbk\b|pizza|sushi|\bbar\b|cafe|starbucks|outback|coco bambu|ze delivery|cantina|churrasc|boteco/],
  ['saude', /drog|farmac|raia|pacheco|pague menos|panvel|hospital|clinica|laborat|medic|odonto|dentista|otica|psic|fleury|dasa|unimed|hapvida|sulamerica|amil/],
  ['assinaturas', /netflix|spotify|disney|hbo|\bmax\b|prime video|amazon prime|globoplay|youtube|apple\.com|icloud|google (one|storage)|deezer|paramount|chatgpt|openai|adobe|microsoft|xbox|playstation|steam|crunchyroll|claude/],
  ['compras', /amazon|mercado ?livre|mercadolivre|shopee|magalu|magazine|americanas|shein|renner|riachuelo|c&a|zara|centauro|netshoes|kabum|casas bahia|aliexpress|leroy|tok ?stok|decathlon|havan|ponto frio|fast shop/],
  ['lazer', /cinema|ingresso|sympla|eventim|teatro|parque|show|kinoplex|cinemark|museu|clube/],
  ['viagens', /hotel|airbnb|booking|latam|\bgol\b|\bazul\b|decolar|123 ?milhas|smiles|hurb|passagem|pousada|localiza|movida|unidas/],
  ['educacao', /escola|colegio|faculdade|curso|udemy|alura|livraria|saraiva|papelaria/],
  ['cuidados', /salao|barbearia|cabeleir|estetica|academia|smart ?fit|bodytech|gympass|wellhub|perfumaria|boticario|natura|sephora/],
  ['contas', /\bclaro\b|\bvivo\b|\btim\b|\boi\b|\bnet\b|enel|light|cemig|copel|sabesp|energia|\bagua\b|internet|telefon|comgas|naturgy/],
  ['impostos', /\biof\b|anuidade|tarifa|seguro cart/],
  ['dividas', /juros|encargo|multa|rotativo|financ/],
  ['presentes', /presente|flores|floricultura|giuliana/],
  ['moradia', /aluguel|condominio|imobili/]
];
const chaveDesc = t => normImp(t).replace(/\d+\s*\/\s*\d+/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
/** Categoria pelo nome da loja (palavras conhecidas), ou vazio. */
function pistaCat(desc) { const d = normImp(desc), cats = categorias('saida'), p = PISTAS_CAT.find(([id, r]) => r.test(d) && cats.some(x => x.id === id)); return p ? p[0] : ''; }
function catPara(txtCat, desc, historico) {
  const cats = categorias('saida');
  if (txtCat) {
    const c = normImp(txtCat), ach = cats.find(x => normImp(x.nome) === c || x.id === c) || cats.find(x => normImp(x.nome).includes(c) || c.includes(normImp(x.nome).split(' ')[0]));
    if (ach) return ach.id;
  }
  // A mesma loja já foi categorizada antes (regra da casa ou o que vocês mais usaram): usa a mesma categoria
  const h = sugerirCat(desc) || historico.get(chaveDesc(desc));
  if (h && !CAT_VAGA(h) && cats.some(x => x.id === h)) return h;
  const d = normImp(desc), p = PISTAS_CAT.find(([id, r]) => r.test(d) && cats.some(x => x.id === id));
  return p ? p[0] : (cats.find(x => x.id === 'outros') || cats[0] || {}).id || '';
}

/* ============================== montar as linhas ============================== */
function lerLinhas(m, k, ref) {
  const cab = acharCabecalho(m);
  if (!cab) throw erroApp('Não encontrei as colunas de data e valor. Use a planilha modelo ou confira o arquivo.', 'VALIDACAO');
  const c = cab.col, corpo = m.slice(cab.lin + 1).slice(0, IMP_MAX), rows = [], ruins = [];
  const historico = new Map(); lancs().filter(l => l.tipo === 'saida' && !CAT_VAGA(l.cat) && !aConfirmar(l) && l.desc).sort((a, b) => a.dia.localeCompare(b.dia)).forEach(l => historico.set(chaveDesc(l.desc), l.cat));
  corpo.forEach(l => {
    const cel = j => j == null ? '' : l[j];
    const dia = lerData(cel(c.dia), ref, k), v = lerValor(cel(c.v));
    let desc = String(cel(c.desc) || '').replace(/\s+/g, ' ').trim();
    if (!dia || v == null || v === 0) { if (l.some(x => String(x).trim())) ruins.push(l.filter(x => String(x).trim()).join(' · ').slice(0, 80)); return; }
    let parc = lerParcela(cel(c.parc)) || lerParcela(desc) || lerParcela(cel(c.tipo));
    if (desc && lerParcela(desc)) desc = desc.replace(lerParcela(desc).tira, '').replace(/[\s-]+$/, '').trim();
    rows.push({ dia, v, desc: desc.slice(0, 120) || 'Compra no cartão', txtCat: String(cel(c.cat) || ''), parc: parc ? `${parc.k}/${parc.n}` : '', obs: String(cel(c.obs) || '').trim().slice(0, 300) });
  });
  // Alguns bancos mostram compras como negativo: se a maioria vier negativa, inverte
  if (rows.length && rows.filter(r => r.v < 0).length > rows.length / 2) rows.forEach(r => { r.v = -r.v; });
  rows.forEach(r => {
    r.cat = catPara(r.txtCat, r.desc, historico);
    r.st = r.v < 0 && /pagamento|pagto|pgto|pag fat|credito de pagamento/i.test(normImp(r.desc)) ? 'pag' : r.v < 0 ? 'cred' : '';
    r.inc = r.st !== 'pag';
  });
  return { rows, ruins };
}
/* O que já está no app (mesmo valor e parcela, data perto ou mesma loja) fica marcado e de fora */
function marcarRepetidas(s) {
  const k = S.d.cartoes.get(s.id), ja = fatura(k, s.v).compras.slice(), usados = new Set();
  s.rows.forEach(r => {
    if (r.st === 'pag') return;
    const dup = ja.find(l => !usados.has(l.id) && l.v === r.v && (l.parc || '') === r.parc && (Math.abs(N_diasEntre(l.dia, r.dia)) <= 3 || r.parc || chaveDesc(l.desc) === chaveDesc(r.desc)));
    if (dup) { usados.add(dup.id); r.st = 'dup'; r.inc = false; }
    else if (r.st === 'dup') { r.st = r.v < 0 ? 'cred' : ''; r.inc = true; }
  });
}

/* ============================== painel ============================== */
const refsImportar = k => { const a = N_faturaRef(k, hoje()); return [N_somaMes(a, -2), N_somaMes(a, -1), a, N_somaMes(a, 1)]; };
SH.importar = s => {
  const k = S.d.cartoes.get(s.id); if (!k) return sumiu('Cartão');
  if (!s.f) s.f = { colar: '', total: '', futuras: true };
  if (!s.v) s.v = faturaDaVez(k).ref;
  const escolheRef = grupo('Qual fatura', `<div class="chips">${refsImportar(k).map(r => `<button class="chip ${s.v === r ? 'on' : ''}" data-a="impRef" data-v="${r}">${fmtMes(r)} <span class="muted" style="font-weight:600">· vence ${fmtCurta(N_vencimento(k, r))}</span></button>`).join('')}</div>`);
  if (!s.rows) return `${head(esc(k.nome), 'Importar fatura')}
    ${escolheRef}
    <div class="panel soft"><p class="small" style="margin:0"><b>1.</b> No app ou site do banco, baixe a fatura em <b>CSV, Excel ou OFX</b> (Nubank, Inter, C6, Itaú e outros). Ou preencha a planilha modelo.</p>
      <p class="small" style="margin:0"><b>2.</b> Escolha o arquivo aqui. Antes de lançar, você revisa tudo.</p>
      <button class="btn ghost sm" data-a="impModelo">${ic('down', 16)} Baixar planilha modelo</button></div>
    <button class="btn block" data-a="impArquivo">${ic('clipe', 16)} Escolher arquivo</button>
    <details ${s.f.colar ? 'open' : ''}><summary class="small muted">Ou cole do Excel ou do Google Planilhas</summary>
      ${area('colar', s.f.colar, 'placeholder="Selecione as linhas na planilha (com o cabeçalho), copie e cole aqui" style="min-height:110px;font-family:ui-monospace,monospace;font-size:12px"')}
      <button class="btn ghost block" data-a="impColar">Ler o que colei</button></details>
    <p class="tiny muted">Colunas reconhecidas pelo nome: Data, Descrição, Valor, Categoria, Parcela, Observação. Pagamento da fatura que vier no arquivo fica de fora; estorno entra como crédito.</p>`;
  const rows = s.rows, inc = rows.filter(r => r.inc), total = inc.reduce((a, r) => a + r.v, 0), dups = rows.filter(r => r.st === 'dup').length, pags = rows.filter(r => r.st === 'pag').length;
  const fut = inc.filter(r => r.parc && +r.parc.split('/')[0] < +r.parc.split('/')[1]);
  const nFut = fut.reduce((a, r) => a + (+r.parc.split('/')[1] - +r.parc.split('/')[0]), 0);
  const jaNoApp = fatura(k, s.v).total;
  const cats = categorias('saida');
  return `${head(esc(k.nome), `Revisar fatura de ${fmtMes(s.v).toLowerCase()}`)}
    ${escolheRef}
    <div class="panel soft">
      <div class="grid2"><div class="stat"><span class="tiny muted">${inc.length} ${plu(inc.length, 'lançamento')} a importar</span><b>${reais(total)}</b></div><div class="stat"><span class="tiny muted">Fatura no app depois</span><b>${reais(jaNoApp + total)}</b></div></div>
      ${dups ? `<p class="small" style="margin:0">✔️ ${dups} ${plu(dups, 'compra já está', 'compras já estão')} no app e ${plu(dups, 'ficou', 'ficaram')} de fora.</p>` : ''}
      ${pags ? `<p class="small" style="margin:0">💳 ${pags} ${plu(pags, 'pagamento')} de fatura ${plu(pags, 'ficou', 'ficaram')} de fora (pague pelo botão Pagar).</p>` : ''}
      ${s.ruins && s.ruins.length ? `<p class="small muted" style="margin:0">${s.ruins.length} ${plu(s.ruins.length, 'linha')} sem data ou valor ${plu(s.ruins.length, 'foi ignorada', 'foram ignoradas')}${s.ruins.length <= 3 ? ': ' + s.ruins.map(esc).join(' | ') : ''}.</p>` : ''}
      ${campo('Total da fatura no banco (para conferir)', inp('total', s.f.total, 'inputmode="decimal" placeholder="R$ 0,00" autocomplete="off"'))}
      <div id="impconf">${conferencia(s, jaNoApp + total)}</div>
    </div>
    ${nFut ? `<div class="between"><span><b>Lançar as parcelas que faltam</b><br><span class="small muted">${nFut} ${plu(nFut, 'parcela')} nas próximas faturas (ex.: ${fut[0].parc} → ${+fut[0].parc.split('/')[0] + 1}/${fut[0].parc.split('/')[1]}). Na próxima importação, elas são reconhecidas.</span></span><button class="tog ${s.f.futuras ? 'on' : ''}" data-a="f" data-k="futuras" data-v="${s.f.futuras ? '' : '1'}" aria-pressed="${!!s.f.futuras}" aria-label="Lançar parcelas futuras"></button></div>` : ''}
    <button class="btn block warm" data-a="impLancar" ${inc.length ? '' : 'disabled'}>Importar ${inc.length} ${plu(inc.length, 'lançamento')}</button>
    ${secao('Compras do arquivo', `<span class="tiny muted">${rows.length}</span>`)}
    <div class="lst">${rows.map((r, i) => `<div class="it imp${r.inc ? '' : ' feito'}"><button class="ck${r.inc ? ' on' : ''}" data-a="impInc" data-i="${i}" aria-label="${r.inc ? 'Tirar' : 'Incluir'} ${esc(r.desc)}">${ic('check', 16, 2.4)}</button>
      <div class="main"><span class="t">${esc(r.desc)}</span><span class="s"><span>${DIAS[N_dataObj(r.dia).getDay()].toLowerCase()} ${fmtCurta(r.dia)}</span>${r.parc ? `<span class="tag">parcela ${esc(r.parc)}</span>` : ''}${r.st === 'dup' ? '<span class="tag good">já no app</span>' : r.st === 'pag' ? '<span class="tag">pagamento</span>' : r.st === 'cred' ? '<span class="tag good">crédito</span>' : ''}</span>
        ${r.st === 'pag' ? '' : `<select class="in sm" data-i="impcat:${i}" aria-label="Categoria de ${esc(r.desc)}">${cats.map(c => `<option value="${esc(c.id)}"${c.id === r.cat ? ' selected' : ''}>${esc(c.ic)} ${esc(c.nome)}</option>`).join('')}</select>`}</div>
      <span class="v ${r.v < 0 ? 'c-good' : ''}">${reais(r.v)}</span></div>`).join('')}</div>
    <button class="btn ghost block" data-a="impVoltar">Escolher outro arquivo</button>`;
};
function conferencia(s, totalApp) {
  const b = lerReais(s.f.total || '');
  if (!b) return '<p class="tiny muted" style="margin:0">Opcional: digite o total que aparece no banco e o app mostra se bate.</p>';
  const d = b - totalApp;
  return d === 0 ? '<p class="small c-good" style="margin:0"><b>Bate com o banco.</b></p>'
    : `<p class="small" style="margin:0"><span class="tag ${Math.abs(d) < 100 ? 'warn' : 'bad'}">${d > 0 ? 'faltam' : 'sobram'} ${reais(Math.abs(d))}</span> ${d > 0 ? 'Talvez falte alguma compra (IOF, anuidade, compra internacional) ou uma linha esteja desmarcada.' : 'Confira se alguma compra está repetida ou se o pagamento entrou como compra.'}</p>`;
}
function atualizarConferencia() {
  const s = S.sheet, el = $('#impconf'); if (!s || !s.rows || !el) return;
  const k = S.d.cartoes.get(s.id), total = s.rows.filter(r => r.inc).reduce((a, r) => a + r.v, 0);
  el.innerHTML = conferencia(s, fatura(k, s.v).total + total);
}
async function lerParaRevisao(s, matriz) {
  const k = S.d.cartoes.get(s.id);
  const { rows, ruins } = lerLinhas(matriz, k, s.v);
  if (!rows.length) throw erroApp('Nenhuma compra encontrada no arquivo.', 'VALIDACAO');
  s.rows = rows; s.ruins = ruins;
  // Sugere a fatura pelo dia das compras (a mais comum entre as compras à vista), se a escolhida não for a dela
  const cont = {}; rows.filter(r => !r.parc && r.v > 0).forEach(r => { const f = N_faturaRef(k, r.dia); cont[f] = (cont[f] || 0) + 1; });
  const prov = Object.entries(cont).sort((a, b) => b[1] - a[1])[0];
  if (!s.refManual && prov && refsImportar(k).includes(prov[0])) s.v = prov[0];
  marcarRepetidas(s);
  renderSheet();
  $('.sheet') && ($('.sheet').scrollTop = 0);
}

/* ============================== lançar ============================== */
function lancamentosDaImportacao(s) {
  const k = S.d.cartoes.get(s.id), ref = s.v, out = [];
  s.rows.filter(r => r.inc).forEach(r => {
    const base = { tipo: 'saida', forma: 'cartao', cartao: k.id, carteira: '', pago: true, cat: r.cat, desc: r.desc, nota: r.obs, conta: '', ref: '', destino: '', meta: '' };
    if (!r.parc) { out.push({ ...base, id: uidNovo(), dia: r.dia, v: r.v, fat: ref }); return; }
    // Parcela k/n: a data de cada parcela anda um mês a partir da compra, como nas parcelas lançadas pelo app
    const [pk, pn] = r.parc.split('/').map(Number), grupo = uidNovo();
    const natural = N_faturaRef(k, r.dia) === ref, datas = N_datasParcelas(r.dia, pn + 1);
    const diaDe = j => natural ? datas[j - pk] : datas[j - 1];
    out.push({ ...base, id: uidNovo(), dia: diaDe(pk), v: r.v, parc: r.parc, grupo, fat: ref });
    if (s.f.futuras) for (let j = pk + 1; j <= pn; j++) out.push({ ...base, id: uidNovo(), dia: diaDe(j), v: r.v, parc: `${j}/${pn}`, grupo, fat: N_somaMes(ref, j - pk) });
  });
  return out;
}

Object.assign(A, {
  importarFatura: d => openSheet({ k: 'importar', id: d.id, v: d.v || '' }),
  impRef: d => { const s = S.sheet; s.v = d.v; s.refManual = true; if (s.rows) marcarRepetidas(s); renderSheet(); },
  impModelo: () => {
    const b = new Blob(['﻿' + MODELO_CSV], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = 'rotina-fatura-modelo.csv'; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('Planilha modelo baixada. Abra no Excel ou no Google Planilhas, troque os exemplos e salve como CSV ou Excel.', 6000);
  },
  impArquivo: () => {
    const s = S.sheet, el = document.createElement('input');
    el.type = 'file'; el.accept = '.csv,.txt,.tsv,.xlsx,.xls,.xlsm,.ods,.ofx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    el.style.cssText = 'position:fixed;left:-1000px;top:0;opacity:0';
    el.addEventListener('change', async () => {
      const f = el.files[0]; el.remove(); if (!f) return;
      if (f.size > 5 * 1048576) { toast('Arquivo grande demais para uma fatura (máximo 5 MB).'); return; }
      if (/\.pdf$/i.test(f.name)) { toast('PDF não dá para ler. No banco, procure "exportar" ou "baixar em CSV/Excel".', 6000); return; }
      try { toast('Lendo…', 1500); await lerParaRevisao(s, await matrizDoArquivo(f)); } catch (e) { toast(e.message, 6000); }
    });
    document.body.appendChild(el); el.click();
  },
  impColar: async () => {
    const s = S.sheet, t = String(s.f.colar || '').trim();
    if (!t) { toast('Cole as linhas da planilha.'); focar('f-colar'); return; }
    try { await lerParaRevisao(s, lerCsv(t)); } catch (e) { toast(e.message, 6000); }
  },
  impInc: d => { const s = S.sheet, r = s.rows[+d.i]; if (!r) return; r.inc = !r.inc; renderSheet(); },
  impVoltar: () => { const s = S.sheet; s.rows = null; s.ruins = null; renderSheet(); },
  impLancar: () => {
    const s = S.sheet, k = S.d.cartoes.get(s.id), itens = lancamentosDaImportacao(s);
    if (!itens.length) return;
    const n = s.rows.filter(r => r.inc).length, ref = s.v;
    for (let i = 0; i < itens.length; i += 72) enfileirar('lote', { col: 'lancamentos', itens: itens.slice(i, i + 72) });
    lsSet('ultimoCartao', k.id);
    openSheet({ k: 'fatura', id: k.id, v: ref });
    const ids = itens.map(x => x.id);
    toast(`${n} ${plu(n, 'lançamento importado', 'lançamentos importados')} na fatura de ${fmtMes(ref).toLowerCase()}${itens.length > n ? ` (+${itens.length - n} parcelas futuras)` : ''}.`, 7000,
      { rot: 'Desfazer', fn: () => { for (let i = 0; i < ids.length; i += 72) enfileirar('excluir', { col: 'lancamentos', ids: ids.slice(i, i + 72) }); toast('Importação desfeita.'); } });
  }
});
