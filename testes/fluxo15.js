// 3.8: base de Finanças. Fila Revisar (categoria por loja, aprende para as próximas), possíveis repetidos,
// receita que cai sozinha no dia, viagem/projeto e reembolso no lançamento. Roda depois do fluxo3.
const { chromium } = require('playwright');
const fs = require('fs');
const DIR = __dirname + '/fotos15/'; fs.mkdirSync(DIR, { recursive: true });
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

  console.log('1. Despesas sem categoria viram uma fila por loja');
  await p.evaluate(() => {
    const k = uidNovo(), h = hoje(), m = N_mes(h), conta = uidNovo();
    enfileirar('salvar', { col: 'patrimonio', item: { id: conta, nome: 'Conta 15', classe: 'conta', nat: 'ativo', ativo: true, hist: [[h, 100000, new Date().toISOString()]] } });
    enfileirar('salvar', { col: 'cartoes', item: { id: k, nome: 'Cartão 15', fecha: 3, vence: 10, ativo: true, limite: 1000000 } });
    const L = (desc, v, cat, extra) => ({ id: uidNovo(), tipo: 'saida', forma: 'cartao', cartao: k, dia: m + '-02', v, desc, cat, pago: true, nota: '', ...extra });
    enfileirar('lote', { col: 'lancamentos', itens: [
      L('HEALTH CENTER LTDA EPP', 30000, 'outros'), L('HEALTH CENTER LTDA EPP', 30000, 'outros', { dia: N_somaMes(m, -1) + '-02' }), L('PG *HEALTH CENTER LTDA EPP', 31000, ''),
      L('LOJA SEM NOME', 5000, 'outros'), L('PADARIA BOM PAO', 1200, 'mercado'), L('PADARIA BOM PAO', 1500, 'outros', { nota: 'categoria a confirmar' }),
      L('JANELA DO ARMAZEM', 1700, 'mercado'), L('JANELA DO ARMAZEM', 1700, 'mercado')] });
  });
  await fila();
  const rev = await p.evaluate(() => filaRevisar().map(g => [g.k, g.ls.length, g.sug]));
  ok(rev.some(g => g[0] === 'health center ltda' && g[1] === 3), 'Health Center (com e sem "PG *") é uma loja só, com 3 lançamentos ' + JSON.stringify(rev));
  ok(rev.find(g => g[0] === 'padaria bom pao')[2] === 'mercado', 'sugestão vem do que já foi usado para a mesma loja (padaria → mercado)');
  await p.evaluate(() => { S.tab = 'financas'; S.fv = 'resumo'; S.mes = N_mes(hoje()); render(false); });
  ok(await p.locator('#main .note', { hasText: 'sem categoria certa' }).isVisible(), 'Resumo avisa que há despesas para revisar');
  await p.locator('#main .note', { hasText: 'sem categoria certa' }).locator('button').click(); await espera(200);
  ok(await p.locator('#main .chip.on', { hasText: 'Revisar' }).isVisible(), 'o link abre Extrato › Revisar');
  await foto('revisar');

  console.log('2. Um toque categoriza a loja inteira e vira regra');
  const g = p.locator('#main .panel.rev', { hasText: 'HEALTH CENTER' });
  await g.locator('button[data-a="revVer"]').click();
  await espera(150);
  await p.locator('#main .panel.rev', { hasText: 'HEALTH CENTER' }).locator('button[data-cat="saude"]').click();
  await fila(); await p.evaluate(() => sincronizar()); await espera(800);
  const hc = await p.evaluate(() => lancs().filter(l => lojaDe(l.desc) === 'health center ltda').map(l => l.cat));
  ok(hc.length === 3 && hc.every(x => x === 'saude'), 'os 3 lançamentos foram para Saúde ' + JSON.stringify(hc));
  ok(await p.evaluate(() => (S.casa.regras || {})['health center ltda'] === 'saude'), 'a regra ficou guardada no servidor (vale para os dois aparelhos)');
  ok(await p.evaluate(() => sugerirCat('HEALTH CENTER LTDA EPP 03/10')) === 'saude', 'próxima fatura importada já vem com Saúde');
  await p.locator('#main .panel.rev', { hasText: 'PADARIA' }).locator('button[data-cat="mercado"]').click(); await fila();
  ok(await p.evaluate(() => !filaRevisar().some(g => g.k === 'padaria bom pao')), 'sugestão aceita com um toque');
  ok(await p.evaluate(() => { const l = lancs().find(l => l.desc === 'PADARIA BOM PAO' && l.v === 1500); return l.cat === 'mercado' && !/confirmar/.test(l.nota); }), '"categoria a confirmar" sai da observação');
  await p.locator('#main .panel.rev', { hasText: 'LOJA SEM NOME' }).locator('button[data-a="revVer"]').click(); await espera(150);
  await p.locator('#main .panel.rev', { hasText: 'LOJA SEM NOME' }).locator('button[data-cat="outros"]').click(); await fila();
  ok(await p.evaluate(() => !filaRevisar().some(g => ['loja sem nome', 'health center ltda', 'padaria bom pao'].includes(g.k))), '"É outros mesmo" tira da fila e não volta');
  await foto('revisado');

  console.log('3. Possíveis repetidos');
  const dups = await p.evaluate(() => possiveisDuplicados().map(d => d.ls.length));
  ok(dups.length === 1 && dups[0] === 2, 'Janela do Armazém, mesmo dia e valor, aparece como possível repetido');
  await p.locator('#main button[data-a="dupOk"]').click(); await espera(200);
  ok(await p.evaluate(() => possiveisDuplicados().length) === 0, '"Não é repetido" esconde o aviso');
  ok(await p.evaluate(() => possiveisDuplicados().length) === 0 && await p.evaluate(() => lancs().filter(l => l.desc === 'JANELA DO ARMAZEM').length) === 2, 'e não apaga nada');

  console.log('4. Receita que cai sozinha no dia');
  await p.evaluate(() => { S.fv = 'contas'; render(false); });
  await p.evaluate(() => openSheet({ k: 'conta' }));
  await p.locator('.sheet .seg button', { hasText: 'Receita' }).click();
  await p.fill('#f-nome', 'Salário teste'); await p.fill('#f-v', '5.000,00'); await p.fill('#f-vence', '1');
  ok(await p.locator('.sheet', { hasText: 'Cai sozinho no dia' }).isVisible(), 'opção "Cai sozinho no dia" na receita fixa');
  await p.locator('.sheet button.tog[data-k="auto"]').click();
  await foto('receita-auto');
  await p.locator('.sheet button[data-a="salvarConta"]').click(); await fila(); await espera(300);
  const auto = await p.evaluate(() => lancs().filter(l => l.desc === 'Salário teste').map(l => [l.pago, l.ref, l.v, l.id.slice(0, 2)]));
  ok(auto.length === 1 && auto[0][0] === true && auto[0][2] === 500000 && auto[0][3] === 'au', 'lançada como recebida no mês ' + JSON.stringify(auto));
  ok(await p.evaluate(() => { const c = recorrentes().find(c => c.nome === 'Salário teste'); return c.autoDesde === N_mes(hoje()) && !lancs().some(l => l.conta === c.id && l.ref === N_somaMes(N_mes(hoje()), -1)); }), 'não preenche o mês anterior (só a partir de quando ligou)');
  await p.evaluate(() => sincronizar(true)); await espera(800); await p.evaluate(() => lancarAutomaticos()); await fila();
  ok(await p.evaluate(() => lancs().filter(l => l.desc === 'Salário teste').length) === 1, 'sincronizar de novo não duplica');
  ok(await p.locator('#main', { hasText: 'automático' }).isVisible(), 'lista de contas fixas mostra "automático"');
  ok(await p.evaluate(() => resumoMes(N_mes(hoje())).rec >= 500000), 'a receita entra no Resumo do mês');

  console.log('5. Viagem/projeto e reembolso');
  await p.evaluate(() => A.novoLanc({ tipo: 'saida' }));
  await espera(300);
  await p.fill('#f-v', '1.200,00'); await p.fill('#f-desc', 'Hotel Bruxelas');
  await p.locator('.sheet summary', { hasText: 'Viagem, projeto ou reembolso' }).click();
  await p.fill('#f-proj', 'Bruxelas 2026'); await p.fill('#f-reemb', 'Eliane');
  await p.locator('.sheet button[data-a="salvarLanc"]').click(); await fila();
  const l = await p.evaluate(() => { const l = lancs().find(l => l.desc === 'Hotel Bruxelas'); return [l.proj, l.reemb, l.reembOk]; });
  ok(l[0] === 'Bruxelas 2026' && l[1] === 'Eliane' && l[2] === false, 'projeto e reembolso guardados ' + JSON.stringify(l));
  ok(await p.evaluate(() => aReceberDeTerceiros()[0].nome === 'Eliane' && aReceberDeTerceiros()[0].v === 120000), 'Eliane deve R$ 1.200');

  ok(await p.evaluate(() => { const m = document.querySelector('#main'); return m.scrollWidth <= m.clientWidth + 1; }), 'sem rolagem lateral');
  await b.close();
  console.log(erros.length ? '\nPROBLEMAS:\n' + erros.join('\n') : '\nTudo certo, nenhum erro no console.');
})().catch(e => { console.error('ERRO', String(e).split('\n').slice(0, 3).join(' | ')); console.log(erros.join('\n')); process.exit(1); });
