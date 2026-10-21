// Troca de estilo pelo perfil: aplica na hora, fica guardado no aparelho e não afeta o outro aparelho.
const { chromium } = require('playwright');
const erros = []; const ok = (c, m) => { if (!c) { erros.push(m); console.log('  ✗', m); } else console.log('  ✓', m); };
(async () => {
  const b = await chromium.launch(), c = await b.newContext({ viewport: { width: 390, height: 844 } }), p = await c.newPage();
  p.on('pageerror', e => erros.push('pageerror ' + e.message));
  await p.goto('http://localhost:8787/'); await p.fill('#lnome', 'Bruno'); await p.fill('#lpin', '1234'); await p.click('button[type=submit]'); await p.waitForSelector('nav button');
  ok(await p.evaluate(() => document.querySelector('#app').dataset.estilo) === 'classico', 'começa no Clássico');
  await p.click('#top button[data-k="perfil"]'); await p.click('.sheet button[data-a="estilo"][data-v="editorial"]');
  ok(await p.evaluate(() => document.querySelector('#app').dataset.estilo) === 'editorial', 'Perfil › Estilo › Editorial aplica na hora');
  await p.reload(); await p.waitForSelector('nav button');
  ok(await p.evaluate(() => document.querySelector('#app').dataset.estilo) === 'editorial', 'continua Editorial depois de reabrir');
  const p2 = await (await b.newContext()).newPage(); await p2.goto('http://localhost:8787/');
  ok(await p2.evaluate(() => document.querySelector('#app').dataset.estilo) === 'classico', 'outro aparelho continua no Clássico');
  await b.close(); console.log(erros.length ? 'PROBLEMAS' : 'Tudo certo, nenhum erro no console.');
})();
