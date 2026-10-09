/* arquivos.js — arquivos importantes da família e anexos (em compromissos, tarefas e lançamentos).
   O arquivo em si fica no Google Drive de quem implantou o servidor; quem tem login na casa abre pelo app, sem precisar de conta no Drive.
   Também dá para guardar só o link (de uma pasta do Drive, de um site). */
'use strict';

const CATS_ARQ = { saude: ['🩺', 'Saúde'], documentos: ['🪪', 'Documentos'], casa: ['🏠', 'Casa'], carro: ['🚗', 'Carro'], escola: ['🎒', 'Escola'], financas: ['💰', 'Finanças'], trabalho: ['💼', 'Trabalho'], outros: ['📎', 'Outros'] };
const catArq = k => CATS_ARQ[k] || CATS_ARQ.outros;
const ARQ_MAX = 10 * 1024 * 1024;
/* A categoria sai do nome, quando dá: "Receita pediatra" → Saúde, "CNH Bruno" → Documentos */
const PISTAS_ARQ = [
  [/receita|exame|laudo|guia|plano de sa|carteirinha|vacina|atestado|consulta|pediatra|dentista|m[eé]dic|hospital|unimed|amil|bradesco sa|sulam/i, 'saude'],
  [/\b(rg|cpf|cnh|passaporte|certid[aã]o|identidade|t[ií]tulo de eleitor|reservista|visto|documento)\b/i, 'documentos'],
  [/boleto|nota fiscal|\bnf\b|comprovante|recibo|extrato|imposto|\birpf?\b|fatura|financiamento|empr[eé]stimo/i, 'financas'],
  [/escola|matr[ií]cula|boletim|uniforme|material escolar|creche|col[eé]gio/i, 'escola'],
  [/carro|ipva|crlv|licenciamento|seguro auto|multa|revis[aã]o|moto\b/i, 'carro'],
  [/aluguel|condom[ií]nio|manual|garantia|escritura|iptu|seguro residencial|loca[cç][aã]o|im[oó]vel/i, 'casa'],
  [/holerite|contracheque|crach[aá]|trabalho|f[eé]rias/i, 'trabalho']
];
const catPorNome = t => (PISTAS_ARQ.find(([r]) => r.test(t)) || [0, 'outros'])[1];
const ehDrive = u => /\b(drive|docs)\.google\.com\//i.test(u || '');
const tamTxt = n => n >= 1048576 ? fmt(n / 1048576, 1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const iconeArq = a => a.tipo === 'link' ? (ehDrive(a.url) ? '☁️' : '🔗') : /pdf/.test(a.mime) ? '📄' : /^image\//.test(a.mime) ? '🖼️' : /sheet|excel|csv/.test(a.mime) ? '📊' : /word|document|text/.test(a.mime) ? '📝' : '📎';
const anexosDe = liga => lista('arquivos').filter(a => a.liga === liga).sort((a, b) => String(a.em || '').localeCompare(String(b.em || '')));
const normBusca = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/* Links clicáveis em textos livres (nota do compromisso, comentários). Recebe texto já escapado. */
const linkar = h => h.replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]/g, u => `<a href="${u}" target="_blank" rel="noopener" class="link">${u.length > 48 ? u.slice(0, 45) + '…' : u}</a>`);

function ligaInfo(liga) {
  const [col, id] = String(liga || '').split(':'), x = col && S.d[col] && S.d[col].get(id);
  if (!x) return null;
  if (col === 'eventos') return { rot: `📅 ${x.titulo}`, k: 'evento' };
  if (col === 'tarefas') return { rot: `✅ ${x.titulo}`, k: 'tarefa' };
  if (col === 'lancamentos') return { rot: `💸 ${x.desc || 'Lançamento'} · ${fmtCurta(x.dia)}`, k: 'lanc' };
  return null;
}
function tagValidade(iso) {
  const n = N_diasEntre(hoje(), iso);
  if (n < 0) return `<span class="tag bad">venceu ${fmtCurta(iso)}</span>`;
  if (n === 0) return '<span class="tag bad">vence hoje</span>';
  if (n <= 30) return `<span class="tag warn">vence em ${n} ${plu(n, 'dia')}</span>`;
  return `<span class="tag">válido até ${fmtCurta(iso)}/${iso.slice(2, 4)}</span>`;
}
function linhaArquivo(a, semLiga) {
  const c = catArq(a.cat), lg = !semLiga && ligaInfo(a.liga), ps = (a.pessoas || []).slice(0, 3);
  const sub = [`<span>${c[0]} ${c[1]}</span>`, ps.length ? `<span>${ps.map(id => av(id, 16)).join('')} ${esc(ps.map(primeiroNome).join(', '))}</span>` : '',
    a.validade ? tagValidade(a.validade) : '', lg ? `<span>${esc(lg.rot)}</span>` : '',
    a.enviando ? '<span class="tag warm">enviando…</span>' : a.tipo === 'link' ? `<span>${ehDrive(a.url) ? 'Google Drive' : 'link'}</span>` : a.tam ? `<span>${tamTxt(a.tam)}</span>` : ''].filter(Boolean).join('');
  return `<button class="it${a.pend ? ' pend' : ''}" data-a="sheet" data-k="arquivo" data-id="${a.id}"><span class="em-tile">${iconeArq(a)}</span>
    <span class="main"><span class="t">${a.fixo ? '⭐ ' : ''}${esc(a.titulo)}</span><span class="s">${sub}</span></span><span class="muted">${ic('chev', 18)}</span></button>`;
}
/* Bloco "Anexos" dentro de um compromisso, tarefa ou lançamento */
function blocoAnexos(col, id) {
  const liga = col + ':' + id, l = anexosDe(liga);
  return `${secao('Anexos', l.length ? `<span class="tiny muted">${l.length}</span>` : '')}
    ${listaOu(l, a => linhaArquivo(a, true), col === 'eventos' ? '<p class="small muted">Receita, guia do plano, convite, ingresso: deixe aqui e os dois encontram na hora.</p>' : '')}
    <div class="grid2"><button class="btn ghost sm" data-a="anexar" data-liga="${liga}">${ic('clipe', 16)} Anexar arquivo</button><button class="btn ghost sm" data-a="novoLink" data-liga="${liga}">${ic('link', 16)} Colar link</button></div>`;
}
/* Categoria e pessoas sugeridas a partir de onde o arquivo foi anexado */
function preArq(liga) {
  const [col, id] = String(liga || '').split(':'), x = col && S.d[col] && S.d[col].get(id);
  if (!x) return { cat: '', pessoas: [] };
  if (col === 'eventos') return { cat: { saude: 'saude', escola: 'escola', trabalho: 'trabalho', casa: 'casa' }[x.tipo] || catPorNome(x.titulo), pessoas: [...(x.pessoas || [])] };
  if (col === 'tarefas') return { cat: { saude: 'saude', docs: 'documentos', carro: 'carro', dinheiro: 'financas', casa: 'casa', trabalho: 'trabalho' }[x.area] || catPorNome(x.titulo), pessoas: x.resp && x.resp !== 'ambos' && x.resp !== 'rodizio' ? [x.resp] : [] };
  return { cat: 'financas', pessoas: [] };
}
function tituloDoArquivo(nome, mime) {
  let t = String(nome || '').replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || /^(img|dsc|pxl|image|photo|foto|screenshot|captura|whatsapp image|scan|doc|document)[\s-]*[\d\s:.-]*(at[\d\s:.-]*)?$/i.test(t) || /^[\d\s:.-]+$/.test(t))
    t = (/^image\//.test(mime) ? 'Foto de ' : 'Documento de ') + fmtCurta(hoje());
  return (t[0].toUpperCase() + t.slice(1)).slice(0, 120);
}

/* ============================== escolher e enviar ============================== */
function escolherArquivos(fn) {
  const velho = $('#arqin'); if (velho) velho.remove();
  const el = document.createElement('input');
  el.type = 'file'; el.multiple = true; el.id = 'arqin';
  el.style.cssText = 'position:fixed;left:-1000px;top:0;opacity:0';
  el.addEventListener('change', () => { const l = [...el.files]; el.remove(); if (l.length) fn(l).catch(e => toast(e.message, 5000)); });
  document.body.appendChild(el);
  el.click();
}
/* Foto do celular (3 a 6 MB) vira um JPEG de até 2400 px: continua nítida para ler uma receita e sobe muito mais rápido */
async function reduzirImagem(f) {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(f.type) || f.size < 1.5 * 1048576) return f;
  let img;
  try { img = await createImageBitmap(f); }
  catch (e) { img = await new Promise((res, rej) => { const i = new Image(), u = URL.createObjectURL(f); i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = () => { URL.revokeObjectURL(u); rej(new Error('imagem')); }; i.src = u; }); }
  const w = img.width, h = img.height, k = Math.min(1, 2400 / Math.max(w, h));
  const cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
  const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
  const b = await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.85));
  if (!b || b.size >= f.size) return f;
  return new File([b], String(f.name || 'foto').replace(/\.[a-z0-9]+$/i, '') + '.jpg', { type: 'image/jpeg' });
}
async function enviarArquivos(files, liga, abrir) {
  const pre = preArq(liga), ids = [];
  for (const f0 of files) {
    let f = f0;
    try { f = await reduzirImagem(f0); } catch (e) { /* manda como veio */ }
    if (f.size > ARQ_MAX) { toast(`${f0.name}: ${tamTxt(f.size)} é grande demais (máximo 10 MB). Guarde no Google Drive e use "Colar link".`, 8000); continue; }
    if (!f.size) { toast(`${f0.name}: arquivo vazio.`); continue; }
    const id = uidNovo(), titulo = tituloDoArquivo(f0.name, f.type), nome = f.name || f0.name || 'arquivo';
    try { await idb.set('env:' + id, { blob: f, nome }); }
    catch (e) { toast('Sem espaço no aparelho para guardar o arquivo até ele subir.', 6000); continue; }
    guardarCopia(id, f, nome);
    enfileirar('enviarArquivo', { item: { id, titulo, tipo: 'arquivo', cat: pre.cat || catPorNome(titulo), pessoas: pre.pessoas, liga: liga || '', fixo: false, validade: '', nota: '', mime: f.type, tam: f.size } });
    ids.push(id);
  }
  if (!ids.length) return;
  if (abrir && ids.length === 1) { const a = S.d.arquivos.get(ids[0]); openSheet({ k: 'arquivo', id: a.id, f: formArq(a), novoArq: true }); toast('Dê um nome e uma categoria. O arquivo já está subindo.', 4000); return; }
  if (S.sheet) renderSheet();
  toast(ids.length === 1 ? (navigator.onLine ? 'Anexado. Enviando…' : 'Anexado. Sobe quando a internet voltar.') : `${ids.length} arquivos anexados. Enviando…`);
}

/* ============================== tela ============================== */
function scrArquivos() {
  const todos = lista('arquivos'), q = normBusca(S.arqBusca.trim()), h = hoje();
  const l = todos.filter(a => (!S.fArq || a.cat === S.fArq) && (!q || normBusca([a.titulo, a.nota, catArq(a.cat)[1], ...(a.pessoas || []).map(primeiroNome)].join(' ')).includes(q)))
    .sort((a, b) => String(b.em || '').localeCompare(String(a.em || '')));
  const venc = l.filter(a => a.validade && N_diasEntre(h, a.validade) <= 60).sort((a, b) => a.validade.localeCompare(b.validade));
  const fixos = l.filter(a => a.fixo && !venc.includes(a)), resto = l.filter(a => !a.fixo && !venc.includes(a));
  const cats = Object.keys(CATS_ARQ).filter(k => todos.some(a => a.cat === k));
  return `<div class="between"><h1 class="display">Arquivos</h1><span class="hrow"><button class="btn ghost sm" data-a="novoLink">${ic('link', 16)} Link</button><button class="btn sm" data-a="anexar" data-abrir="1">${ic('plus', 16, 2.4)} Arquivo</button></span></div>
    ${todos.length ? `<input class="in" id="arqbusca" data-i="arqbusca" type="search" placeholder="Buscar: carteirinha, RG do Pedro, contrato…" value="${esc(S.arqBusca)}" autocomplete="off" enterkeyhint="search">
    ${cats.length > 1 ? `<div class="chips scroll"><button class="chip ${!S.fArq ? 'on' : ''}" data-a="filtro" data-k="fArq" data-v="">Todos</button>${cats.map(k => `<button class="chip ${S.fArq === k ? 'on' : ''}" data-a="filtro" data-k="fArq" data-v="${S.fArq === k ? '' : k}">${catArq(k)[0]} ${catArq(k)[1]}</button>`).join('')}</div>` : ''}` : ''}
    ${venc.length ? secao('Validade perto do fim', `<span class="tiny muted">${venc.length}</span>`) + listaOu(venc, a => linhaArquivo(a)) : ''}
    ${fixos.length ? secao('Importantes', '<span class="tiny muted">abrem sem internet</span>') + listaOu(fixos, a => linhaArquivo(a)) : ''}
    ${resto.length ? secao(q || S.fArq ? 'Encontrados' : 'Todos', `<span class="tiny muted">${resto.length}</span>`) + listaOu(resto, a => linhaArquivo(a)) : ''}
    ${!todos.length ? `<div class="panel">${vazio('🗂️', 'Guarde aqui o que vocês sempre procuram na hora H, em vez de rolar a conversa do WhatsApp.')}
      <div class="chips">${['🩺 Carteirinha do plano', '💊 Receitas e exames', '🪪 RG e CPF das crianças', '📝 Contrato do aluguel', '🚗 Documento do carro', '📘 Manual do ar-condicionado'].map(x => `<span class="chip">${x}</span>`).join('')}</div>
      <button class="btn block" data-a="anexar" data-abrir="1">${ic('plus', 16, 2.4)} Guardar o primeiro arquivo</button></div>` : !l.length ? vazio('🔎', 'Nada encontrado.') : ''}
    <div class="note"><span class="small">${IOS ? 'No iPhone, "Arquivo" abre a Fototeca, a câmera ou o app Arquivos. Arquivo que chegou no WhatsApp: toque nele › Compartilhar › Salvar em Arquivos, e depois guarde aqui.' : 'Arquivos de até 10 MB. Fotos grandes são reduzidas sem perder a leitura. Maior que isso: guarde no Google Drive e use "Link".'} Marque ⭐ nos importantes: ficam no aparelho para abrir sem internet.</span></div>`;
}

/* ============================== painel ============================== */
function formArq(a, pre) {
  if (a) return { titulo: a.titulo, url: a.url || '', cat: a.cat || 'outros', pessoas: [...(a.pessoas || [])], validade: a.validade || '', fixo: !!a.fixo, nota: a.nota || '' };
  pre = pre || {};
  return { titulo: '', url: '', cat: pre.cat || '', pessoas: pre.pessoas || [], validade: '', fixo: false, nota: '' };
}
SH.arquivo = s => {
  const a = s.id && S.d.arquivos.get(s.id);
  if (s.id && !a) return sumiu('Arquivo');
  if (s.f) return editarArq(s, a);
  return verArq(s, a);
};
function previa(s, a) {
  if (s.erro) return `<div class="note warn"><span>${esc(s.erro)}</span><button class="link" data-a="tentarArq">Tentar de novo</button></div>`;
  if (!s.url) {
    if (!s.carregando) {
      s.carregando = true;
      pegarArquivo(a.id).then(c => { s.blob = c.blob; s.nome = c.nome; s.url = URL.createObjectURL(c.blob); }).catch(e => { s.erro = e.codigo === 'OFFLINE' ? 'Sem internet, e este arquivo ainda não foi aberto neste aparelho.' : e.message; })
        .finally(() => { s.carregando = false; if (S.sheet === s) renderSheet(); });
    }
    return `<div class="arqprev"><span class="small muted">Carregando…</span></div>`;
  }
  const mime = s.blob.type || a.mime || '';
  const vista = /^image\//.test(mime) ? `<img src="${s.url}" alt="${esc(a.titulo)}">`
    : /pdf/.test(mime) && LARGO() ? `<iframe src="${s.url}" title="${esc(a.titulo)}"></iframe>`
    : `<span class="arqtile">${iconeArq(a)}<span class="small muted">${esc(s.nome || '')} · ${tamTxt(s.blob.size)}</span></span>`;
  const comp = navigator.canShare && (() => { try { return navigator.canShare({ files: [new File([s.blob], s.nome || 'arquivo', { type: mime })] }); } catch (e) { return false; } })();
  const botoes = IOS && comp ? `<button class="btn" data-a="compArq">${ic('share', 16)} Abrir ou salvar</button><a class="btn ghost" href="${s.url}" download="${esc(s.nome || 'arquivo')}">Baixar</a>`
    : `<a class="btn" href="${s.url}" target="_blank" rel="noopener">Abrir</a>${comp ? `<button class="btn ghost" data-a="compArq">${ic('share', 16)} Compartilhar</button>` : `<a class="btn ghost" href="${s.url}" download="${esc(s.nome || 'arquivo')}">Baixar</a>`}`;
  return `<div class="arqprev">${vista}</div><div class="grid2">${botoes}</div>`;
}
function verArq(s, a) {
  s.estavel = true; // a sincronização não redesenha o painel (a prévia piscaria)
  const c = catArq(a.cat), lg = ligaInfo(a.liga), link = a.tipo === 'link', dono = pessoa(S.eu).admin && a.drive;
  return `${head(`${c[0]} ${c[1]}`, esc(a.titulo))}
    ${link ? `<a class="btn block" href="${esc(a.url)}" target="_blank" rel="noopener">${ic('link', 16)} ${ehDrive(a.url) ? 'Abrir no Google Drive' : 'Abrir o link'}</a><p class="tiny muted" style="word-break:break-all">${esc(a.url)}</p>`
      : a.enviando && !navigator.onLine ? `<div class="note warn"><span>Ainda não subiu: vai quando a internet voltar. Neste aparelho já dá para abrir.</span></div>` + previa(s, a) : previa(s, a)}
    <div class="panel soft">
      ${(a.pessoas || []).length ? `<div class="hrow" style="gap:10px">${ic('home', 18)}<span class="hrow" style="gap:6px">${a.pessoas.map(id => `${av(id, 22)} ${esc(primeiroNome(id))}`).join(' ')}</span></div>` : ''}
      ${lg ? `<div class="hrow" style="gap:10px">${ic('clipe', 18)}<button class="link" data-a="abrirLiga" data-v="${esc(a.liga)}">${esc(lg.rot)}</button></div>` : ''}
      ${a.validade ? `<div class="hrow" style="gap:10px">${ic('clock', 18)}<span>Validade: ${fmtCurta(a.validade)}/${a.validade.slice(0, 4)} ${tagValidade(a.validade)}</span></div>` : ''}
      ${a.nota ? `<p class="small" style="white-space:pre-wrap;margin:0">${linkar(esc(a.nota))}</p>` : ''}
      <p class="tiny muted" style="margin:0">${a.enviando ? 'Enviando' : 'Guardado'} por ${a.por === S.eu ? 'você' : esc(nomeDe(a.por))}${a.em ? ' em ' + fmtCurta(isoLocal(a.em)) : ''}${a.tam ? ' · ' + tamTxt(a.tam) : ''}.</p>
    </div>
    <div class="between"><span><b>⭐ Importante</b><br><span class="small muted">${link ? 'Fica no topo da lista' : 'Fica no topo e no aparelho, para abrir sem internet'}</span></span><button class="tog ${a.fixo ? 'on' : ''}" data-a="fixarArq" data-id="${a.id}" aria-pressed="${!!a.fixo}" aria-label="Importante"></button></div>
    <div class="grid2"><button class="btn ghost sm" data-a="editarArq">${ic('edit', 16)} Editar</button><button class="btn danger sm" data-a="excluirArq" data-id="${a.id}">${ic('trash', 16)} Excluir</button></div>
    ${dono ? `<p class="tiny muted">Está no seu Google Drive, na pasta "Rotina · Arquivos". <a class="link" href="https://drive.google.com/file/d/${esc(a.drive)}/view" target="_blank" rel="noopener">Ver no Drive</a></p>` : ''}`;
}
function editarArq(s, a) {
  const f = s.f, novoLink = s.novo === 'link', link = novoLink || (a && a.tipo === 'link');
  const ms = membros();
  return `${head(novoLink ? 'Guardar link' : s.novoArq ? 'Arquivo novo' : 'Editar', novoLink ? 'Link do Drive ou de um site' : esc(a.titulo))}
    ${link ? campo('Endereço', inp('url', f.url, 'type="url" inputmode="url" placeholder="Cole aqui: https://drive.google.com/…" autocomplete="off"')) + (novoLink ? '<p class="tiny muted">No Google Drive: toque nos ⋯ do arquivo ou da pasta › Compartilhar › Copiar link. Para a outra pessoa abrir, o arquivo precisa estar compartilhado com ela (ou com "qualquer pessoa com o link").</p>' : '') : ''}
    ${campo('Nome', inp('titulo', f.titulo, `maxlength="120" placeholder="${link ? 'Ex.: Pasta dos documentos da família' : 'Ex.: Carteirinha do plano da Ana'}" autocomplete="off"`))}
    ${grupo('Categoria', escolha('cat', f.cat, Object.entries(CATS_ARQ).map(([k, [e, n]]) => [k, `${e} ${n}`])))}
    ${grupo('De quem', `<div class="chips">${ms.map(p => `<button class="chip ${f.pessoas.includes(p.id) ? 'on' : ''}" data-a="arqPess" data-v="${p.id}">${av(p.id, 18)} ${esc(p.id === S.eu ? 'Eu' : primeiroNome(p.id))}</button>`).join('')}</div><p class="tiny muted">Nenhum marcado: é da família toda.</p>`)}
    ${grupo('Validade (opcional)', inp('validade', f.validade, 'type="date"') + '<p class="tiny muted">Passaporte, CNH, carteirinha, apólice: o app avisa 30 dias antes, 7 dias antes e no dia.</p>')}
    <div class="between"><span><b>⭐ Importante</b><br><span class="small muted">No topo da lista${link ? '' : ' e guardado no aparelho'}</span></span><button class="tog ${f.fixo ? 'on' : ''}" data-a="f" data-k="fixo" data-v="${f.fixo ? '' : '1'}" aria-pressed="${f.fixo}" aria-label="Importante"></button></div>
    <details ${f.nota ? 'open' : ''}><summary class="small muted">Observação</summary>${area('nota', f.nota, 'maxlength="500" placeholder="Ex.: número da carteirinha, senha do portal fica com a Ana" style="min-height:60px"')}</details>
    <button class="btn block" data-a="salvarArq">Salvar</button>
    ${s.novoArq ? `<button class="btn ghost block" data-a="close">Depois</button>` : ''}`;
}

/* ============================== ações ============================== */
Object.assign(A, {
  anexar: d => escolherArquivos(l => enviarArquivos(l, d.liga || '', !!d.abrir)),
  novoLink: d => {
    const pre = preArq(d.liga);
    openSheet({ k: 'arquivo', novo: 'link', liga: d.liga || '', f: formArq(null, pre), volta: S.sheet && S.sheet.k !== 'arquivo' ? S.sheet : null });
    setTimeout(() => focar('f-url'), 280);
  },
  arqPess: d => { const f = S.sheet.f; f.pessoas = f.pessoas.includes(d.v) ? f.pessoas.filter(x => x !== d.v) : [...f.pessoas, d.v]; renderSheet(); },
  editarArq: () => { const s = S.sheet, a = S.d.arquivos.get(s.id); if (!a) return; s.f = formArq(a); renderSheet(); },
  salvarArq: () => {
    const s = S.sheet, f = s.f, a = s.id && S.d.arquivos.get(s.id), link = s.novo === 'link' || (a && a.tipo === 'link');
    let url = String(f.url || '').trim();
    if (link) {
      if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
      if (!/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(url)) { toast('Cole um endereço que comece com https://'); focar('f-url'); return; }
    }
    const titulo = f.titulo.trim() || (link ? (ehDrive(url) ? 'Arquivo do Google Drive' : url.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0]) : '');
    if (!titulo) { toast('Dê um nome.'); focar('f-titulo'); return; }
    const item = { id: a ? a.id : uidNovo(), titulo, cat: f.cat || catPorNome(titulo), pessoas: f.pessoas, validade: N_dataValida(f.validade) ? f.validade : '', fixo: !!f.fixo, nota: String(f.nota || '').trim() };
    if (link) item.url = url;
    if (s.novo === 'link') Object.assign(item, { tipo: 'link', liga: s.liga || '' });
    if (s.volta) { S.sheet = s.volta; renderSheet(); } else if (a && !s.novoArq) { S.sheet = { k: 'arquivo', id: a.id }; renderSheet(); } else closeSheet();
    enfileirar('salvar', { col: 'arquivos', item });
    if (S.sheet) renderSheet();
    if (item.fixo) setTimeout(guardarImportantes, 1500);
    toast(a ? 'Salvo.' : 'Link guardado.');
  },
  fixarArq: d => {
    const a = S.d.arquivos.get(d.id); if (!a) return;
    enfileirar('salvar', { col: 'arquivos', item: { id: a.id, fixo: !a.fixo } });
    renderSheet(); toast(a.fixo ? 'Desmarcado.' : (a.tipo === 'link' ? 'Marcado como importante.' : 'Importante: fica guardado neste aparelho.'));
    if (!a.fixo) setTimeout(guardarImportantes, 1500);
  },
  excluirArq: d => {
    const a = S.d.arquivos.get(d.id); if (!a) return;
    if (!confirm(`Excluir "${a.titulo}"? Some para os dois.${a.tipo === 'arquivo' ? ' O arquivo vai para a lixeira do Google Drive (dá para recuperar por 30 dias).' : ''}`)) return;
    A.close(); enfileirar('excluir', { col: 'arquivos', id: a.id });
    idb.del('env:' + a.id).catch(() => { }); idb.del('arq:' + a.id).catch(() => { });
    toast('Excluído.');
  },
  abrirLiga: d => { const lg = ligaInfo(d.v); if (!lg) return; openSheet({ k: lg.k, id: d.v.split(':')[1], volta: S.sheet }); },
  tentarArq: () => { const s = S.sheet; s.erro = ''; renderSheet(); },
  compArq: async () => {
    const s = S.sheet; if (!s || !s.blob) return;
    const a = S.d.arquivos.get(s.id) || {};
    try { await navigator.share({ files: [new File([s.blob], s.nome || 'arquivo', { type: s.blob.type })], title: a.titulo }); }
    catch (e) { if (e.name !== 'AbortError') toast('Não deu para compartilhar daqui. Use "Baixar".'); }
  }
});
