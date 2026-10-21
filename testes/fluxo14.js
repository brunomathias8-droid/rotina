// 3.6.5: gráfico de evolução com todos os meses rotulados e parando no último saldo informado.
const { chromium } = require('playwright');
const fs = require('fs'); fs.mkdirSync(__dirname + '/fotos14', { recursive: true });
const erros = []; const ok = (c, m) => { if (!c) { erros.push(m); console.log('  ✗', m); } else console.log('  ✓', m); };
(async () => {
  const b = await chromium.launch();
  for (const [est, w] of [['editorial', 1180], ['', 390]]) {
    const c = await b.newContext({ viewport: { width: w, height: 820 } });
    await c.addInitScript(e => localStorage.setItem('rotina_estilo', e), est);
    const p = await c.newPage(); p.on('pageerror', e => erros.push('pageerror ' + e.message));
    await p.goto('http://localhost:8787/'); if (false && await p.locator('text=Primeiro acesso').isVisible()) { await p.click('text=Primeiro acesso'); await p.fill('#lconvite', fs.readFileSync(__dirname + '/convite.txt', 'utf8')); } await p.fill('#lnome', 'Bruno'); await p.fill('#lpin', '1234'); await p.click('button[type=submit]'); await p.waitForSelector('nav button');
    await p.evaluate(() => {
      if (patrimonio().some(x => x.nome === 'CDB teste')) return;
      const m = N_mes(hoje()), d = k => N_diaDoMes(N_somaMes(m, k), 31);
      [['CDB teste', [61356737, 60000000, 59000000]], ['LCI teste', [30000000, 30500000, 31200000]]].forEach(([nome, vs]) =>
        enfileirar('salvar', { col: 'patrimonio', item: { id: uidNovo(), nome, classe: 'rendafixa', inst: 'X', ativo: true, hist: vs.map((v, i) => [d(i - 5), v, new Date().toISOString()]) } }));
    });
    await p.waitForFunction(() => S.fila.length === 0, null, { timeout: 20000 });
    for (const fv of ['investimentos', 'patrimonio']) {
      await p.evaluate(v => { S.tab = 'financas'; S.fv = v; render(false); }, fv);
      const g = p.locator('#main svg.graf').first();
      const meses = await g.locator('text.g-eixo').allTextContents();
      const esperados = await p.evaluate(() => [-5, -4, -3].map(k => mesCurto(N_somaMes(N_mes(hoje()), k))));
      ok(esperados.every(m => meses.includes(m)), `${fv} ${w}px: rótulos ${esperados.join(', ')}`);
      ok(!meses.includes(await p.evaluate(() => mesCurto(N_mes(hoje())))), `${fv} ${w}px: linha para no último saldo`);
      await g.screenshot({ path: `fotos14/${fv}-${w}.png` });
    }
    await c.close();
  }
  await b.close(); console.log(erros.length ? 'FALHAS: ' + erros.join(' | ') : 'TUDO OK'); process.exit(erros.length ? 1 : 0);
})();
