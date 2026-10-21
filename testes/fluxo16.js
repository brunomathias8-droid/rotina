// 3.7: Compras em duas partes. Para comprar (opções com link e preço, orçamento, prazo, "Comprei" vira lançamento)
// e Mercado (itens da casa que voltam para a lista quando acabam). Roda depois do fluxo3.
const { chromium } = require('playwright');
const fs = require('fs');
const DIR = __dirname + '/fotos16/'; fs.mkdirSync(DIR, { recursive: true });
const erros = []; let n = 0;
const espera = ms => new Promise(r => setTimeout(r, ms));
function ok(c, m) { if (!c) { erros.push('FALHOU: ' + m); console.log('  ✗', m); } else console.log('  ✓', m); }
const ML = 'https://www.mercadolivre.com.br/robo-aspirador-de-po-v50-10000pa-varre-aspira/p/MLB74423603?pdp_filters=item_id:MLB7398615566';
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[390, 844], [1366, 768]]) {
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 900 ? 2 : 1, locale: 'pt-BR', timezoneId: 'America/Fortaleza' });
    const p = await c.newPage();
    p.on('pageerror', e => erros.push('pageerror ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.push('console ' + m.text()); });
    p.on('dialog', d => d.accept());
    const foto = async nome => { await espera(300); await p.screenshot({ path: DIR + String(++n).padStart(2, '0') + `-${w}-${nome}.png` }); };
    const fila = () => p.waitForFunction(() => S.fila.length === 0, null, { timeout: 20000 });
    await p.goto('http://localhost:8787/'); await p.fill('#lnome', 'Bruno'); await p.fill('#lpin', '1234'); await p.click('button[type=submit]'); await p.waitForSelector('nav button');
    await p.locator('nav button', { hasText: 'Compras' }).click(); await espera(200);
    if (w === 390) {
      console.log('1. Para comprar: item, opções, orçamento');
      ok(await p.locator('#main .seg button.on', { hasText: 'Para comprar' }).isVisible(), 'abre em Para comprar');
      await foto('vazio');
      await p.fill('#planotxt', 'robô aspirador'); await p.press('#planotxt', 'Enter'); await espera(300);
      ok(await p.locator('.sheet .h1', { hasText: 'Robô aspirador' }).isVisible(), 'item criado e aberto para completar');
      await p.click('.sheet button[data-a="novaOpcao"]');
      await p.fill('#f-url', ML); await p.fill('#f-p', '1.899,90');
      await p.click('.sheet button[data-a="salvarOpcao"]'); await fila();
      const op = await p.evaluate(() => { const c = planos().find(c => c.item === 'Robô aspirador'); return opcoesDe(c)[0]; });
      ok(op.loja === 'Mercado Livre' && /^Robo aspirador de po v50/.test(op.n) && op.p === 189990, 'link do Mercado Livre vira nome e loja sozinhos ' + JSON.stringify([op.n, op.loja, op.p]));
      await p.click('.sheet button[data-a="novaOpcao"]'); await p.fill('#f-n', 'Lydsto R1D'); await p.fill('#f-p', '1.450,00'); await p.fill('#f-loja', 'Amazon');
      await p.click('.sheet button[data-a="salvarOpcao"]'); await fila();
      await p.click('.sheet button[data-a="editarPlano"]');
      await p.fill('#f-orc', '2.000,00'); await p.fill('#f-prazo', await p.evaluate(() => N_somaDias(hoje(), 5)));
      await p.click('.sheet button[data-k="prio"][data-v="alta"]');
      await p.click('.sheet button[data-a="salvarPlano"]'); await fila();
      ok(await p.locator('.sheet', { hasText: 'Orçamento R$ 2.000,00' }).isVisible() && await p.locator('.sheet .tag', { hasText: 'logo' }).isVisible(), 'orçamento e prioridade aparecem no item');
      ok(await p.locator('.sheet', { hasText: 'Fotos e referências' }).isVisible(), 'dá para anexar fotos e referências');
      await foto('item');
      await p.evaluate(() => closeSheet()); await espera(200);
      await p.fill('#planotxt', 'https://www.tokstok.com.br/quadro-decorativo-abstrato-azul-60x90/p'); await p.press('#planotxt', 'Enter'); await fila();
      ok(await p.evaluate(() => planos().some(c => c.item === 'Quadro decorativo abstrato azul 60x90' && opcoesDe(c)[0].loja === 'Tok&Stok')), 'colar só o link cria o item com o nome do produto');
      await p.evaluate(() => closeSheet()); await espera(200);
      const txt = await p.locator('#main').innerText();
      ok(txt.includes('Logo') && txt.includes('2 opções') && txt.includes('até R$ 2.000,00'), 'lista agrupa por prioridade e mostra opções e preço');
      ok(await p.locator('#main .stat', { hasText: 'Deve custar' }).isVisible(), 'total do que deve custar');
      await foto('lista');

      console.log('2. Comprei vira lançamento');
      await p.locator('#main .it', { hasText: 'Robô aspirador' }).click(); await espera(300);
      await p.locator('.sheet .it', { hasText: 'Lydsto' }).locator('button[data-a="comprei"]').click(); await espera(300);
      ok(await p.inputValue('#f-v') === '1.450,00' && await p.inputValue('#f-desc') === 'Robô aspirador', 'lançamento vem com o valor da opção escolhida e a descrição');
      ok(await p.locator('.sheet .note', { hasText: 'sai de Para comprar' }).isVisible(), 'avisa que o item sai da lista ao salvar');
      await foto('comprei');
      await p.click('.sheet button[data-a="salvarLanc"]'); await fila();
      const comp = await p.evaluate(() => { const c = planos().find(c => c.item === 'Robô aspirador'), l = S.d.lancamentos.get(c.lanc); return [c.comprado, !!l, l && l.v, l && l.cat, /Amazon/.test(l && l.nota)]; });
      ok(comp[0] && comp[1] && comp[2] === 145000 && comp[3] === 'compras' && comp[4], 'item comprado, ligado ao lançamento de R$ 1.450 em Compras ' + JSON.stringify(comp));
      ok(await p.locator('#main details', { hasText: 'Comprados' }).isVisible(), 'vai para Comprados');
      await p.evaluate(() => sincronizar(true)); await espera(800);
      ok(await p.evaluate(() => { const c = planos().find(c => c.item === 'Robô aspirador'); return c.comprado && c.orc === 200000 && c.prio === 'alta' && opcoesDe(c).length === 2; }), 'tudo guardado no servidor');
    }

    console.log(`3. Mercado ${w}px: item da casa`);
    await p.click('#main button[data-a="compraAba"][data-v="mercado"]'); await espera(200);
    if (w === 390) {
      await p.fill('#comptxt', 'café, arroz'); await p.press('#comptxt', 'Enter'); await fila();
      await p.locator('#main .it', { hasText: 'Café' }).locator('button.main').click(); await espera(250);
      await p.click('.sheet button.tog[data-k="fixo"]'); await p.click('.sheet button[data-a="salvarCompra"]'); await fila();
      await p.locator('#main .it', { hasText: 'Café' }).locator('button.ck').click(); await fila();
      await p.locator('#main .it', { hasText: 'Arroz' }).locator('button.ck').click(); await fila();
      ok(await p.locator('#main button[data-a="acabou"]', { hasText: 'Café' }).isVisible(), 'café comprado vai para Itens da casa');
      await p.click('#main button[data-a="limparCompras"]'); await fila(); await p.evaluate(() => sincronizar()); await espera(600);
      ok(await p.evaluate(() => mercado().some(c => c.item === 'Café') && !mercado().some(c => c.item === 'Arroz')), 'Limpar tira o arroz e guarda o café');
      ok(await p.evaluate(() => planos().length === 2), 'Limpar não mexe em Para comprar');
      await p.click('#main button[data-a="acabou"]'); await fila();
      ok(await p.evaluate(() => !mercado().find(c => c.item === 'Café').comprado), 'acabou: café volta para a lista com um toque');
    }
    await foto('mercado');
    ok(await p.evaluate(() => { const m = document.querySelector('#main'); return m.scrollWidth <= m.clientWidth + 1; }), `sem rolagem lateral (${w}px)`);

    console.log(`4. Hoje ${w}px`);
    await p.locator('nav button', { hasText: 'Hoje' }).click(); await espera(250);
    ok(await p.locator('#main', { hasText: 'no mercado' }).isVisible() && await p.locator('#main', { hasText: 'para comprar' }).isVisible(), 'Hoje mostra mercado e Para comprar');
    ok(await p.locator('#main .stat', { hasText: 'Saldo previsto' }).isVisible(), 'Hoje mostra o saldo previsto do mês');
    await foto('hoje');
    await c.close();
  }
  await b.close();
  console.log(erros.length ? '\nPROBLEMAS:\n' + erros.join('\n') : '\nTudo certo, nenhum erro no console.');
})().catch(e => { console.error('ERRO', String(e).split('\n').slice(0, 3).join(' | ')); console.log(erros.join('\n')); process.exit(1); });
