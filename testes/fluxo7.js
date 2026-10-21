// 3.3.1: data de anexo não é "documento vencendo". Roda depois do fluxo3.
const { chromium } = require('playwright');
const fs = require('fs');
const URL = 'http://localhost:8787/', DIR = __dirname + '/fotos7/';
fs.mkdirSync(DIR, { recursive: true });
const erros = []; let n = 0;
const espera = ms => new Promise(r => setTimeout(r, ms));
function ok(c, m) { if (!c) { erros.push('FALHOU: ' + m); console.log('  ✗', m); } else console.log('  ✓', m); }
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1234, height: 700 }, locale: 'pt-BR', timezoneId: 'America/Fortaleza' });
  const p = await c.newPage();
  p.on('pageerror', e => erros.push('pageerror ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.push('console ' + m.text()); });
  const foto = async nome => { await espera(300); await p.screenshot({ path: DIR + String(++n).padStart(2, '0') + '-' + nome + '.png' }); };
  const filaVazia = () => p.waitForFunction(() => S.fila.length === 0, null, { timeout: 20000 });
  await p.goto(URL); await p.fill('#lnome', 'Bruno'); await p.fill('#lpin', '1234'); await p.click('button[type=submit]'); await p.waitForSelector('nav button');
  // Como no print: tarefa sem prazo + link anexado com data daqui a 11 dias; e um passaporte de verdade vencendo
  const ids = await p.evaluate(() => {
    const t = uidNovo(), l = uidNovo(), d = uidNovo(), v = N_somaDias(hoje(), 11);
    enfileirar('salvar', { col: 'tarefas', item: { id: t, titulo: 'Comprar quadro da sala', resp: S.eu, prox: '', freq: '', itens: [], nota: '', alta: false, peso: 2 } });
    enfileirar('salvar', { col: 'arquivos', item: { id: l, titulo: 'Quadro bar', tipo: 'link', url: 'https://loja.example/quadro', cat: 'casa', pessoas: [S.eu], liga: 'tarefas:' + t, validade: v, fixo: false, nota: '' } });
    enfileirar('salvar', { col: 'arquivos', item: { id: d, titulo: 'Passaporte do Bruno', tipo: 'link', url: 'https://gov.example/passaporte', cat: 'documentos', pessoas: [S.eu], liga: '', validade: N_somaDias(hoje(), 20), fixo: false, nota: '' } });
    return { t, l, d, v };
  });
  await filaVazia(); await p.evaluate(() => { S.tab = 'hoje'; render(false); });
  const hojeTxt = await p.locator('#main').innerText();
  ok(!hojeTxt.includes('Quadro bar'), 'Hoje não mostra o anexo da tarefa como documento vencendo');
  ok(hojeTxt.includes('Documentos para renovar') && hojeTxt.includes('Passaporte do Bruno'), 'Hoje continua mostrando o passaporte em "Documentos para renovar"');
  await foto('hoje');
  await p.evaluate(id => openSheet({ k: 'arquivo', id }), ids.l); await espera(300);
  ok(await p.locator('.sheet', { hasText: 'Prazo é da tarefa' }).isVisible() && !(await p.locator('.sheet .tag', { hasText: 'vence em' }).count()), 'no anexo, a data aparece como prazo da tarefa, sem "vence em"');
  await foto('anexo-com-data');
  await p.click('.sheet button[data-a="dataParaTarefa"]'); await filaVazia(); await espera(200);
  const r = await p.evaluate(x => ({ prox: S.d.tarefas.get(x.t).prox, val: S.d.arquivos.get(x.l).validade }), ids);
  ok(r.prox === ids.v && !r.val, '"Usar como prazo da tarefa" passa a data para a tarefa e tira do anexo');
  await p.click('.sheet button[data-a="editarArq"]'); await espera(200);
  ok(!(await p.locator('#f-validade').count()) && await p.locator('.sheet', { hasText: 'O prazo fica na tarefa' }).isVisible(), 'formulário de anexo não pede validade');
  await p.evaluate(() => closeSheet());
  await p.evaluate(() => openSheet({ k: 'arquivo', novo: 'link', liga: '', f: formArq(null, {}) })); await espera(200);
  ok(await p.locator('#f-validade').count() === 1, 'documento solto continua com o campo Validade');
  await p.evaluate(() => closeSheet());
  const dia7 = await p.evaluate(x => N_somaDias(hoje(), 4), ids); // anexo agora sem data; passaporte faz 7 dias antes em hoje+13
  const pass7 = await p.evaluate(() => N_somaDias(hoje(), 13));
  const av = await (await fetch(`http://localhost:8787/__avisos?hora=8&dia=${pass7}`)).text();
  ok(/Passaporte do Bruno vence em 7 dias/.test(av) && !/Quadro bar/.test(av), 'aviso de validade só para documento solto');
  // anexo antigo com data, mas avisos do servidor: recoloca a data no anexo e confere que o servidor não avisa
  await p.evaluate(x => enfileirar('salvar', { col: 'arquivos', item: { id: x.l, validade: N_somaDias(hoje(), 7) } }), ids); await filaVazia();
  const av2 = await (await fetch(`http://localhost:8787/__avisos?hora=8&dia=${await p.evaluate(() => N_somaDias(hoje(), 0))}`)).text();
  ok(!/Quadro bar/.test(av2), 'servidor não avisa "vence" de anexo de tarefa');
  await b.close();
  console.log(erros.length ? '\nPROBLEMAS:\n' + erros.join('\n') : '\nTudo certo, nenhum erro no console.');
})().catch(e => { console.error('ERRO NO TESTE', String(e).split('\n').slice(0, 3).join(' | ')); console.log(erros.join('\n')); process.exit(1); });
