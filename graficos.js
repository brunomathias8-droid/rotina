/* graficos.js — gráficos em SVG desenhados à mão: colunas por mês, linha do patrimônio, barra empilhada e mini colunas.
   Regras: barras finas com ponta arredondada saindo da base, linha de 2px, grade discreta, legenda sempre que houver
   mais de uma série, cores só nas marcas (texto usa as cores de texto) e todo valor também aparece no toque e na tabela. */
'use strict';

const VIZ = { rec: 'var(--viz-1)', desp: 'var(--viz-2)', inv: 'var(--viz-3)' };
/** "R$ 12 mil", "R$ 1,2 mi", "R$ 850" para eixos e rótulos curtos. */
function compacto(c) {
  const v = Math.abs(c) / 100, s = c < 0 ? '−' : '';
  const dec = (x, lim) => x >= lim || Math.abs(x - Math.round(x)) < .05 ? 0 : 1;
  if (v >= 1e6) return `${s}R$ ${fmt(v / 1e6, dec(v / 1e6, 10))} mi`;
  if (v >= 1e3) return `${s}R$ ${fmt(v / 1e3, dec(v / 1e3, 10))} mil`;
  return `${s}R$ ${fmt(v, 0)}`;
}
/** Teto "redondo" do eixo e o passo das 3 marcas. */
function eixo(max) {
  if (max <= 0) return { max: 100000, passo: 50000 };
  const bruto = max / 3, pot = Math.pow(10, Math.floor(Math.log10(bruto)));
  const passo = [1, 2, 2.5, 5, 10].map(x => x * pot).find(x => x >= bruto);
  return { max: passo * Math.ceil(max / passo), passo };
}
const mesCurto = ref => MESES[+ref.slice(5, 7) - 1].slice(0, 3);
const legenda = itens => `<div class="leg">${itens.map(([cor, nome]) => `<span><i style="background:${cor}"></i>${esc(nome)}</span>`).join('')}</div>`;
/** Coluna com ponta de 4px arredondada e base reta. */
function colunaPath(x, y, w, h) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
const dica = linhas => esc(JSON.stringify(linhas));

/**
 * Colunas agrupadas por mês. meses: ['2026-05', …]; series: [{ nome, cor, vals: [centavos] }].
 * Cada mês tem uma área de toque do tamanho da coluna inteira, com todos os valores.
 */
function grafColunas(meses, series, rotulo) {
  const W = 340, H = 168, esq = 52, base = H - 22, topo = 10, larg = W - esq - 4;
  const { max, passo } = eixo(Math.max(1, ...series.flatMap(s => s.vals)));
  const y = v => base - (Math.max(0, v) / max) * (base - topo);
  const banda = larg / meses.length, bw = Math.min(14, (banda - 10) / series.length - 2);
  let svg = '';
  for (let t = 0; t <= max + 1; t += passo) svg += `<line x1="${esq}" x2="${W}" y1="${y(t)}" y2="${y(t)}" class="g-grade"/><text x="${esq - 6}" y="${y(t) + 4}" class="g-eixo" text-anchor="end">${compacto(t)}</text>`;
  meses.forEach((m, i) => {
    const x0 = esq + i * banda + (banda - series.length * (bw + 2) + 2) / 2;
    series.forEach((s, j) => { const v = Math.max(0, s.vals[i]); svg += `<path d="${colunaPath(x0 + j * (bw + 2), y(v), bw, base - y(v))}" fill="${s.cor}"/>`; });
    svg += `<text x="${esq + i * banda + banda / 2}" y="${H - 6}" class="g-eixo" text-anchor="middle">${mesCurto(m)}</text>`;
    const linhas = [fmtMes(m), ...series.map(s => [s.cor, s.nome, reais(s.vals[i])])];
    svg += `<rect x="${esq + i * banda}" y="0" width="${banda}" height="${base}" fill="transparent" class="g-alvo" tabindex="0" data-tip="${dica(linhas)}" aria-label="${esc(fmtMes(m))}: ${esc(series.map(s => s.nome + ' ' + reais(s.vals[i])).join(', '))}"/>`;
  });
  svg += `<line x1="${esq}" x2="${W}" y1="${base}" y2="${base}" class="g-base"/>`;
  const tabela = `<details class="g-tab"><summary>Ver em tabela</summary><table class="tb"><tr><th>Mês</th>${series.map(s => `<th>${esc(s.nome)}</th>`).join('')}</tr>${meses.map((m, i) => `<tr><td>${fmtMes(m)}</td>${series.map(s => `<td>${reais(s.vals[i])}</td>`).join('')}</tr>`).join('')}</table></details>`;
  return `${series.length > 1 ? legenda(series.map(s => [s.cor, s.nome])) : ''}<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(rotulo || 'Gráfico por mês')}">${svg}</svg>${tabela}`;
}

/**
 * Colunas empilhadas por mês (ex.: faturas de cada cartão). series: [{ nome, cor, vals }].
 * sel: mês em destaque; depoisDe: meses depois dele aparecem mais claros (futuro já comprometido); acao: data-a ao tocar na coluna.
 */
function grafEmpilhado(meses, series, { sel, depoisDe, acao, rotulo, alt } = {}) {
  const W = 340, H = alt || 170, esq = 52, base = H - 22, topo = 10, larg = W - esq - 4;
  const tot = meses.map((m, i) => series.reduce((a, s) => a + Math.max(0, s.vals[i]), 0));
  const { max, passo } = eixo(Math.max(1, ...tot));
  const y = v => base - (v / max) * (base - topo), banda = larg / meses.length, bw = Math.min(16, banda - 8);
  let svg = '';
  for (let t = 0; t <= max + 1; t += passo) svg += `<line x1="${esq}" x2="${W}" y1="${y(t)}" y2="${y(t)}" class="g-grade"/><text x="${esq - 6}" y="${y(t) + 4}" class="g-eixo" text-anchor="end">${compacto(t)}</text>`;
  meses.forEach((m, i) => {
    const x0 = esq + i * banda, xb = x0 + (banda - bw) / 2, fut = depoisDe && m > depoisDe;
    if (m === sel) svg += `<rect x="${x0 + 1}" y="${topo - 6}" width="${banda - 2}" height="${base - topo + 6}" rx="6" class="g-sel"/>`;
    let acc = 0;
    const vis = series.filter(s => s.vals[i] > 0);
    vis.forEach((s, j) => {
      const v = s.vals[i], y1 = y(acc + v), h = y(acc) - y1;
      svg += j === vis.length - 1 ? `<path d="${colunaPath(xb, y1, bw, h)}" fill="${s.cor}"${fut ? ' fill-opacity=".45"' : ''}/>` : `<rect x="${xb}" y="${y1}" width="${bw}" height="${Math.max(0, h - 1)}" fill="${s.cor}"${fut ? ' fill-opacity=".45"' : ''}/>`;
      acc += v;
    });
    svg += `<text x="${x0 + banda / 2}" y="${H - 6}" class="g-eixo${m === sel ? ' g-eixo-sel' : ''}" text-anchor="middle">${mesCurto(m)}</text>`;
    const linhas = [fmtMes(m) + (fut ? ' · já comprometido' : ''), ...series.filter(s => s.vals[i]).map(s => [s.cor, s.nome, reais(s.vals[i])]), ['', 'Total', reais(tot[i])]];
    svg += `<rect x="${x0}" y="0" width="${banda}" height="${base}" fill="transparent" class="g-alvo" tabindex="0"${acao ? ` data-a="${acao}" data-v="${m}" style="cursor:pointer"` : ''} data-tip="${dica(linhas)}" aria-label="${esc(fmtMes(m))}: ${reais(tot[i])}"/>`;
  });
  svg += `<line x1="${esq}" x2="${W}" y1="${base}" y2="${base}" class="g-base"/>`;
  const tabela = `<details class="g-tab"><summary>Ver em tabela</summary><table class="tb"><tr><th>Mês</th>${series.map(s => `<th>${esc(s.nome)}</th>`).join('')}<th>Total</th></tr>${meses.map((m, i) => `<tr><td>${fmtMes(m)}</td>${series.map(s => `<td>${reais(s.vals[i])}</td>`).join('')}<td><b>${reais(tot[i])}</b></td></tr>`).join('')}</table></details>`;
  return `${series.length > 1 ? legenda(series.map(s => [s.cor, s.nome])) : ''}<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(rotulo || 'Gráfico por mês')}">${svg}</svg>${tabela}`;
}

/** Linha de uma série só (patrimônio). pontos: [{ ref, v }]. Toque mostra o valor do mês mais perto. */
function grafLinha(pontos, rotulo, nome = 'patrimônio') {
  const n = pontos.length, poucos = n <= 4, W = 340, H = poucos ? 168 : 156, esq = 60, dir = 10, base = H - 24, topo = poucos ? 30 : 14;
  // Linha não precisa começar no zero: o eixo abraça os valores para a variação aparecer
  const vals = pontos.map(p => p.v), mn = Math.min(...vals), mx = Math.max(...vals), { passo } = eixo(Math.max(mx - mn, Math.abs(mx) * .1, 100000));
  const lo = Math.floor(mn / passo) * passo, hi = Math.max(Math.ceil(mx / passo) * passo, lo + passo);
  // Meio passo de folga nas pontas: todo mês ganha rótulo centralizado embaixo do seu ponto
  const folga = n < 2 ? 0 : Math.min(18, (W - esq - dir) / (n - 1) / 2), larg = W - esq - dir - 2 * folga;
  const x = i => esq + folga + (n < 2 ? larg / 2 : i * larg / (n - 1));
  const y = v => base - (v - lo) / (hi - lo || 1) * (base - topo);
  let svg = '';
  const marcas = []; for (let t = lo; t <= hi + 1; t += passo) marcas.push(t);
  (marcas.length <= 4 ? marcas : [lo, hi]).forEach(t => { svg += `<line x1="${esq}" x2="${W}" y1="${y(t)}" y2="${y(t)}" class="g-grade"/><text x="${esq - 6}" y="${y(t) + 4}" class="g-eixo" text-anchor="end">${compacto(t)}</text>`; });
  const d = pontos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  svg += `<path d="${d}V${base}H${x(0)}Z" fill="var(--viz-1)" opacity=".1"/><path d="${d}" fill="none" stroke="var(--viz-1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  // Rótulo de todos os meses (com mais de 12, um sim um não); o ano aparece no toque e na tabela
  const cada = n > 12 ? 2 : 1;
  pontos.forEach((p, i) => {
    const ult = i === n - 1;
    svg += `<circle cx="${x(i)}" cy="${y(p.v)}" r="${ult ? 4 : 2.5}" fill="${ult ? 'var(--viz-1)' : 'var(--s1)'}" stroke="var(--viz-1)" stroke-width="${ult ? 2 : 1.5}"/>`;
    if (i % cada === 0 || ult) svg += `<text x="${x(i)}" y="${H - 8}" class="g-eixo${ult ? ' g-eixo-sel' : ''}" text-anchor="middle">${mesCurto(p.ref)}</text>`;
    if (poucos) svg += `<text x="${Math.min(W - 24, Math.max(esq + 24, x(i)))}" y="${y(p.v) - 9}" class="g-eixo${ult ? ' g-eixo-sel' : ''}" text-anchor="middle">${compacto(p.v)}</text>`;
  });
  svg += `<g class="g-cruz" hidden><line y1="${topo}" y2="${base}" class="g-cruzl"/><circle r="4" fill="var(--viz-1)" stroke="var(--s1)" stroke-width="2"/></g>`;
  const pts = pontos.map((p, i) => [x(i), y(p.v), fmtMes(p.ref), reais(p.v)]);
  svg += `<rect x="${esq}" y="0" width="${W - esq}" height="${base}" fill="transparent" class="g-linha" data-nome="${esc(nome)}" data-pts="${esc(JSON.stringify(pts))}"/>`;
  const tabela = `<details class="g-tab"><summary>Ver em tabela</summary><table class="tb">${pontos.map((p, i) => { const dv = i ? p.v - pontos[i - 1].v : null; return `<tr><td>${fmtMes(p.ref)}</td><td>${reais(p.v)}</td><td class="${dv > 0 ? 'c-good' : dv < 0 ? 'c-bad' : 'muted'}">${dv == null ? '' : (dv >= 0 ? '+' : '−') + reais(Math.abs(dv))}</td></tr>`; }).join('')}</table></details>`;
  return `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(rotulo || 'Evolução')}">${svg}</svg>${tabela}`;
}

/** Barra empilhada horizontal (100% = a renda). partes: [{ nome, cor, v (centavos), pct, meta }]. */
function grafPilha(partes, total) {
  const soma = partes.reduce((a, p) => a + Math.max(0, p.v), 0), base = Math.max(total, soma, 1);
  const segs = partes.filter(p => p.v > 0).map(p => `<i style="flex:${p.v / base};background:${p.cor}" tabindex="0" data-tip="${dica([p.nome, [p.cor, Math.round(p.pct) + '% da renda', reais(p.v)], ['', 'meta', p.meta + '%']])}"></i>`).join('');
  const resto = base - soma;
  return `<div class="pilha">${segs}${resto > 0 ? `<i style="flex:${resto / base};background:var(--s3)" data-tip="${dica(['Sobrou', ['', 'sem destino', reais(resto)]])}"></i>` : ''}</div>
    <div class="pilha-leg">${partes.map(p => `<div><span class="hrow" style="gap:6px"><i style="background:${p.cor}"></i><span>${esc(p.nome)}</span></span><b class="num">${Math.round(p.pct)}%</b><span class="tiny muted">meta ${p.meta}%</span></div>`).join('')}</div>`;
}

/** Mini colunas dos últimos meses de uma meta, com a linha do alvo. Bate a meta: cor de destaque; não bate: cinza. */
function grafMini(serie, alvo, bom) {
  const W = 150, H = 44, n = serie.length, bw = 14, gap = (W - n * bw) / (n + 1);
  const max = Math.max(alvo, ...serie.map(s => s.v), 1), y = v => H - 12 - Math.max(0, v) / max * (H - 16);
  let svg = `<line x1="0" x2="${W}" y1="${y(alvo)}" y2="${y(alvo)}" class="g-alvoln"/>`;
  serie.forEach((s, i) => {
    const xx = gap + i * (bw + gap), ok = bom(s.v);
    svg += `<path d="${colunaPath(xx, y(s.v), bw, H - 12 - y(s.v))}" fill="${ok ? 'var(--accent)' : 'var(--s3)'}"/><text x="${xx + bw / 2}" y="${H - 1}" class="g-eixo" text-anchor="middle">${mesCurto(s.ref)[0].toUpperCase()}</text>`;
    svg += `<rect x="${xx - gap / 2}" y="0" width="${bw + gap}" height="${H}" fill="transparent" tabindex="0" data-tip="${dica([fmtMes(s.ref), ['', ok ? 'dentro da meta' : 'fora da meta', reais(s.v)]])}"/>`;
  });
  return `<svg class="graf mini" viewBox="0 0 ${W} ${H}" role="img" aria-label="Últimos ${n} meses">${svg}</svg>`;
}

/* ---------- dica flutuante (toque, mouse e teclado) ---------- */
function mostrarDica(el, linhas, px, py) {
  let t = $('#dica');
  if (!t) { t = document.createElement('div'); t.id = 'dica'; t.className = 'dica'; $('#app').appendChild(t); }
  t.textContent = '';
  linhas.forEach((l, i) => {
    const row = document.createElement('div');
    if (typeof l === 'string') { row.className = 'dica-t'; row.textContent = l; }
    else {
      const [cor, nome, val] = l, k = document.createElement('i'), b = document.createElement('b'), s = document.createElement('span');
      if (cor) k.style.background = cor; else k.style.visibility = 'hidden';
      b.textContent = val; s.textContent = nome; row.append(k, b, s);
    }
    t.appendChild(row);
  });
  const app = $('#app').getBoundingClientRect();
  t.hidden = false;
  const w = t.offsetWidth, h = t.offsetHeight;
  t.style.left = clamp(px - app.left - w / 2, 8, app.width - w - 8) + 'px';
  t.style.top = Math.max(8, py - app.top - h - 14) + 'px';
}
function esconderDica() { const t = $('#dica'); if (t) t.hidden = true; document.querySelectorAll('.g-cruz').forEach(g => g.setAttribute('hidden', '')); }
function aoApontar(e) {
  const el = e.target.closest && e.target.closest('[data-tip], .g-linha');
  if (!el) { if (e.type === 'pointerdown') esconderDica(); return; }
  const r = el.getBoundingClientRect();
  if (el.classList.contains('g-linha')) {
    const pts = JSON.parse(el.dataset.pts), svg = el.ownerSVGElement, vb = svg.viewBox.baseVal, sr = svg.getBoundingClientRect();
    const sx = vb.width / sr.width, px = (e.clientX - sr.left) * sx;
    let k = 0; pts.forEach((p, i) => { if (Math.abs(p[0] - px) < Math.abs(pts[k][0] - px)) k = i; });
    const g = svg.querySelector('.g-cruz'); g.removeAttribute('hidden');
    g.querySelector('line').setAttribute('x1', pts[k][0]); g.querySelector('line').setAttribute('x2', pts[k][0]);
    g.querySelector('circle').setAttribute('cx', pts[k][0]); g.querySelector('circle').setAttribute('cy', pts[k][1]);
    mostrarDica(el, [pts[k][2], ['var(--viz-1)', el.dataset.nome || 'patrimônio', pts[k][3]]], sr.left + pts[k][0] / sx, sr.top + pts[k][1] / sx);
    return;
  }
  mostrarDica(el, JSON.parse(el.dataset.tip), e.clientX || r.left + r.width / 2, r.top);
}
document.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') aoApontar(e); });
document.addEventListener('pointerdown', aoApontar);
document.addEventListener('focusin', e => { if (e.target.dataset && e.target.dataset.tip) aoApontar({ target: e.target, clientX: 0, type: 'focus' }); });
document.addEventListener('focusout', esconderDica);
document.addEventListener('scroll', esconderDica, true);
