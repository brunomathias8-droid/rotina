// 3.8.1: Contas num card só (vencidas no topo), valor diferente só neste mês, filtros do Extrato com contagem
// e aviso quando a busca esconde tudo, e a lista completa de gastos que se repetem. Roda depois do fluxo3.
const { chromium } = require('playwright');
const fs = require('fs');
const DIR = __dirname + '/fotos18/'; fs.mkdirSync(DIR, { recursive: true });
const erros = []; let n = 0;
const espera = ms => new Promise(r => setTimeout(r, ms));
function ok(c, m) { if (!c) { erros.push('FALHOU: ' + m); console.log('  ✗', m); } else console.log('  ✓', m); }
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'pt-BR', timezoneId: 'America/Fortaleza' });
  const p = await c.newPage();
  p.on('pageerror', e => erros.push('pageerror ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.push('console ' + m.text()); });
  p.on('dialog', d => d.accept());
  const foto = async nome => { await espera(300); await p.screenshot({ path: DIR + String(++n).padStart(2, '0') + '-' + nome + '.png' }); };
  const fila = () => p.waitForFunction(() => S.fila.length === 0, null, { timeout: 20000 });
  await p.goto('http://localhost:8787/'); await p.fill('#lnome', 'Bruno'); await p.fill('#lpin', '1234'); await p.click('button[type=submit]'); await p.waitForSelector('nav button');
  await p.evaluate(() => {
    const m = N_mes(hoje()), k = 'cart18aaaaaa';
    enfileirar('salvar', { col: 'contas', item: { id: 'conta18luzzz', tipo: 'saida', nome: 'Luz 18', v: 40000, vence: 1, cat: 'contas', forma: 'boleto', ativa: true } });
    enfileirar('salvar', { col: 'contas', item: { id: 'conta18netty', tipo: 'saida', nome: 'Internet 18', v: 12000, vence: 28, cat: 'contas', forma: 'pix', ativa: true } });
    enfileirar('salvar', { col: 'cartoes', item: { id: k, nome: 'Cartão 18', fecha: 1, vence: 8, ativo: true, limite: 100000 } });
    enfileirar('lote', { col: 'lancamentos', itens: [-3, -2, -1].map(i => ({ id: uidNovo(), tipo: 'saida', forma: 'cartao', cartao: k, dia: N_somaMes(m, i) + '-02', v: 3990, desc: 'STREAM DEZOITO', cat: 'assinaturas', pago: true }))
      .concat([-3, -2, -1].map(i => ({ id: uidNovo(), tipo: 'saida', forma: 'cartao', cartao: k, dia: N_somaMes(m, i) + '-02', v: 2500, desc: 'NUVEM DEZOITO', cat: 'assinaturas', pago: true })))
      .concat([{ id: uidNovo(), tipo: 'entrada', dia: m + '-01', v: 500000, desc: 'Salário dezoito', cat: 'salario', pago: true, carteira: '' }]) });
  });
  await fila();

  console.log('1. Contas: um card só, vencidas no topo');
  await p.evaluate(() => { S.tab = 'financas'; S.fv = 'contas'; S.mes = N_mes(hoje()); render(false); });
  ok(!(await p.locator('#main .sec h2').allInnerTexts()).includes('Vencidas'), 'não há mais a seção separada de vencidas');
  const ordem = await p.locator('#main .sec:has-text("A pagar") + .lst .it .t').allInnerTexts();
  ok(ordem.indexOf('Luz 18') >= 0 && ordem.indexOf('Luz 18') < ordem.indexOf('Internet 18'), 'vencida (Luz) vem antes da que ainda vai vencer');
  ok(await p.locator('#main .it.venc', { hasText: 'Luz 18' }).count() === 1 && await p.locator('#main .it', { hasText: 'Luz 18' }).locator('.tag.bad').count() === 1, 'vencida continua marcada em vermelho');
  ok(await p.locator('#main .sec', { hasText: 'A pagar' }).locator('.tag.bad', { hasText: 'vencida' }).isVisible(), 'título mostra quantas estão vencidas');
  await foto('contas');

  console.log('2. Valor diferente só neste mês');
  const antes = await p.evaluate(() => previsaoMes(N_mes(hoje())).desp);
  await p.locator('#main .it', { hasText: 'Luz 18' }).locator('button[data-a="sheet"]', { hasText: 'outro valor' }).click(); await espera(300);
  ok(await p.locator('.sheet .valor-mes').isVisible(), 'a conta abre com "Valor de" do mês');
  await p.fill('#f-vmes', '1.000,00'); await foto('valor-mes');
  await p.click('.sheet button[data-a="valorMes"]'); await fila();
  const d = await p.evaluate(() => { const x = agendaMes(N_mes(hoje())).find(x => x.nome === 'Luz 18'); return { v: x.v, st: x.status, normal: S.d.contas.get('conta18luzzz').v }; });
  ok(d.v === 100000 && d.normal === 40000 && d.st === 'vencido', 'este mês R$ 1.000, o de sempre continua R$ 400 ' + JSON.stringify(d));
  ok(await p.locator('#main .it', { hasText: 'Luz 18' }).locator('text=normal R$ 400,00').isVisible(), 'a linha mostra o valor normal');
  const depois = await p.evaluate(() => previsaoMes(N_mes(hoje())).desp);
  ok(depois - antes === 60000, 'previsão do mês soma a diferença uma vez só (+R$ 600)');
  await p.locator('#main .it', { hasText: 'Luz 18' }).locator('button[data-a="pagar"]').click(); await fila();
  const pg = await p.evaluate(() => { const l = lancs().find(l => l.conta === 'conta18luzzz'); return [l.pago, l.v]; });
  ok(pg[0] === true && pg[1] === 100000, 'Pagar paga os R$ 1.000');
  await p.evaluate(() => sincronizar(true)); await espera(800);
  ok(await p.evaluate(() => agendaMes(N_mes(hoje())).find(x => x.nome === 'Luz 18').status === 'pago' && N_somaMes(N_mes(hoje()), 1) && agendaMes(N_somaMes(N_mes(hoje()), 1)).find(x => x.nome === 'Luz 18').v === 40000), 'no mês seguinte volta ao valor normal');

  console.log('3. Extrato: filtros com contagem e busca que esconde tudo');
  await p.evaluate(() => { S.fv = 'extrato'; S.fExt = 'tudo'; S.busca = ''; render(false); });
  const rec = await p.locator('#main .chip[data-v="entrada"] .n').innerText();
  ok(+rec >= 1, 'chip Receitas mostra quantos há: ' + rec);
  await p.fill('#busca', 'stream dezoito'); await espera(300);
  await p.click('#main .chip[data-v="entrada"]'); await espera(200);
  ok(await p.locator('#main', { hasText: 'Nenhum lançamento em' }).isVisible(), 'quando a busca esconde tudo, diz por quê');
  await foto('extrato-vazio');
  await p.click('#main button[data-a="limparBusca"]'); await espera(200);
  ok(await p.inputValue('#busca') === '' && (await p.locator('#extlista .it').count()) === +rec, 'Limpar a busca volta a mostrar as receitas');
  await p.fill('#busca', 'stream dezoito'); await espera(300); await p.click('#main .chip[data-v="tudo"]'); await espera(200);
  await p.click('#main button[data-a="buscaMes"][data-v="1"]'); await espera(200);
  ok((await p.locator('#extlista .it').count()) === 3, 'busca em todos os meses acha os 3');
  ok(await p.evaluate(() => { const e = document.querySelector('#main .seg.mini'); return e && e.getBoundingClientRect().width < 300; }), 'escolha "este mês / todos os meses" não ocupa a largura toda');

  console.log('4. Gastos que se repetem: lista completa');
  await p.evaluate(() => { S.fv = 'analises'; S.busca = ''; render(false); });
  await p.locator('#main .it', { hasText: 'STREAM DEZOITO' }).click(); await espera(300);
  ok(await p.locator('.sheet .h1', { hasText: 'Gastos que se repetem' }).isVisible(), 'tocar abre a lista completa');
  ok(await p.locator('.sheet details[open]', { hasText: 'STREAM DEZOITO' }).count() === 1 && await p.locator('.sheet details', { hasText: 'NUVEM DEZOITO' }).count() === 1, 'o tocado vem aberto e os outros estão na lista');
  ok(await p.locator('.sheet details[open] .lst .it').count() === 3, 'mostra os lançamentos de cada mês');
  await foto('repetem');
  ok(await p.evaluate(() => { const m = document.querySelector('.sheet'); return m.scrollWidth <= m.clientWidth + 1; }), 'sem rolagem lateral');
  await b.close();
  console.log(erros.length ? '\nPROBLEMAS:\n' + erros.join('\n') : '\nTudo certo, nenhum erro no console.');
})().catch(e => { console.error('ERRO', String(e).split('\n').slice(0, 3).join(' | ')); console.log(erros.join('\n')); process.exit(1); });
