const { chromium } = require('playwright');
const ok = (c, m) => console.log(c ? '  ✓' : '  ✗', m);
(async () => {
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 600, height: 700 } })).newPage();
  await p.addInitScript(() => localStorage.setItem('rotina_estilo', 'editorial'));
  await p.goto('http://localhost:8787/'); await p.fill('#lnome', 'Bruno'); await p.fill('#lpin', '1234'); await p.click('button[type=submit]'); await p.waitForSelector('nav button');
  const r = await p.evaluate(() => { const m = metas().find(x => x.metrica === 'cartao'); const pr = progressoMeta(m); openSheet({ k: 'meta', id: m.id }); return pr; });
  await new Promise(x => setTimeout(x, 300));
  const w = await p.evaluate(() => document.querySelector('.sheet .bar i').style.width);
  ok(r.atual > r.alvo && r.pct === 1 && w === '100%' && r.cor === 'var(--bad)', `passou do limite: barra cheia (${w}) e vermelha`);
  await p.screenshot({ path: __dirname + '/fotos8/02-barra.png' });
  const r2 = await p.evaluate(() => progressoMeta({ tipo: 'reduzir', metrica: 'cartao', alvo: 2000000, em: new Date().toISOString() }));
  ok(Math.abs(r2.pct - r2.atual / 2000000) < 1e-9 && r2.cor === 'var(--accent)', `dentro do limite: barra = ${Math.round(r2.pct * 100)}% do limite usado`);
  await b.close();
})();
