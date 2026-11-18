// 3.9: a Luar, coach financeira. Conversa no app (com ferramentas), perfil e caderno, Telegram vinculado por código,
// mensagens de turno por push e Telegram, cartão na tela Hoje. A API da Anthropic, o Telegram e o Banco Central são simulados. Roda depois do fluxo3.
const { chromium } = require('playwright');
const fs = require('fs');
const DIR = __dirname + '/fotos19/'; fs.mkdirSync(DIR, { recursive: true });
const erros = []; let n = 0;
const espera = ms => new Promise(r => setTimeout(r, ms));
function ok(c, m) { if (!c) { erros.push('FALHOU: ' + m); console.log('  ✗', m); } else console.log('  ✓', m); }
const luar = q => fetch('http://localhost:8787/__luar?' + q).then(r => r.json());
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'pt-BR', timezoneId: 'America/Fortaleza' });
  const p = await c.newPage();
  p.on('pageerror', e => erros.push('pageerror ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.push('console ' + m.text()); });
  const foto = async nome => { await espera(300); await p.screenshot({ path: DIR + String(++n).padStart(2, '0') + '-' + nome + '.png' }); };
  await p.goto('http://localhost:8787/'); await p.fill('#lnome', 'Bruno'); await p.fill('#lpin', '1234'); await p.click('button[type=submit]'); await p.waitForSelector('nav button');
  await luar(''); // limpa o registro de chamadas

  console.log('1. Sem chave: a Luar aparece desligada');
  await p.evaluate(() => { S.tab = 'financas'; S.fv = 'luar'; render(false); });
  await p.waitForSelector('#main .luar-topo');
  ok(await p.locator('#main .note.warn', { hasText: 'desligada' }).isVisible(), 'avisa que falta a chave');
  ok(await p.locator('#main .chip.on', { hasText: 'Luar' }).isVisible(), 'aba Luar em Finanças');

  console.log('2. Conversa');
  await luar('chave=1&telegram=1');
  await p.click('#main button[data-a="sheet"][data-k="luarAjustes"]'); await p.click('.sheet [data-a="close"]');
  await p.evaluate(() => A.luarRecarregar()); await p.waitForSelector('#luartxt');
  ok(await p.locator('#main .note.warn', { hasText: 'Preencher o perfil' }).isVisible(), 'pede o perfil da família');
  await p.fill('#luartxt', 'Como estamos este mês?'); await p.click('.luar-form button[type=submit]');
  await p.locator('.bolha.luar', { hasText: 'Luar responde' }).waitFor({ timeout: 15000 });
  ok(await p.locator('.bolha.luar', { hasText: 'Como estamos este mês? (li os dados)' }).isVisible(), 'Luar responde com os dados da casa no contexto');
  ok(await p.locator('.bolha.eu', { hasText: 'Como estamos este mês?' }).isVisible(), 'minha fala fica na conversa');
  let r = await luar('');
  ok(r.anthropic.length === 1 && r.anthropic[0].model === 'claude-opus-5-5' && r.anthropic[0].effort === 'low' && r.anthropic[0].tools === 4 && r.anthropic[0].fallbacks === 'default', 'chama o modelo certo, com ferramentas e fallback');
  ok(r.anthropic[0].sys.length === 2 && /\[Bruno\] Como estamos/.test(r.anthropic[0].ultima), 'persona e dados separados; quem fala vai entre colchetes');

  console.log('3. Ferramenta: definir teto');
  await p.fill('#luartxt', 'Define um teto de delivery para nós'); await p.press('#luartxt', 'Tab'); await p.click('.luar-form button[type=submit]');
  await p.locator('.bolha.luar', { hasText: 'Teto do delivery definido' }).waitFor({ timeout: 15000 });
  r = await luar('');
  ok(r.anthropic.length === 2 && r.anthropic[1].papeis.endsWith('assistant,user') && /tool_result/.test(r.anthropic[1].ultima), 'devolve o resultado da ferramenta para o modelo');
  ok(r.categorias.some(c => c.id === 'delivery' && c.orc === 80000), 'teto de delivery gravado (R$ 800)');
  ok(await p.locator('.bolha.luar', { hasText: 'R$ 800,00 por mês' }).isVisible(), 'resposta confirma o teto');
  await foto('conversa');

  console.log('4. Ajustes: perfil e caderno');
  await p.click('#main button[data-a="sheet"][data-k="luarAjustes"]');
  await p.fill('#f-perfil', 'Casal com dois filhos pequenos. Teste dezenove.');
  await p.fill('#f-caderno', 'Combinado de teste: zero delivery na semana');
  await p.click('.sheet button[data-a="luarSalvarAjustes"]'); await espera(500);
  r = await luar('');
  ok(r.caderno === 'Combinado de teste: zero delivery na semana', 'caderno guardado');

  console.log('5. Telegram');
  await p.click('.sheet button[data-a="luarTelegram"]'); await p.waitForSelector('.sheet .note b');
  const cod = (await p.locator('.sheet .note', { hasText: '/vincular' }).innerText()).match(/\/vincular (\d{6})/)[1];
  ok(await p.locator('.sheet .note', { hasText: '@luar_teste_bot' }).isVisible(), 'mostra o código e o @ do bot');
  await foto('ajustes');
  r = await luar('tg=555&texto=' + encodeURIComponent('/vincular ' + cod));
  ok(r.telegram.length === 1 && r.telegram[0].chat_id === '555' && /Pronto, Bruno/.test(r.telegram[0].text), 'vincula o chat com o código');
  r = await luar('tg=555&texto=' + encodeURIComponent('/vincular ' + cod));
  ok(/inválido/.test(r.telegram[0].text), 'código não serve duas vezes');
  r = await luar('tg=555&texto=' + encodeURIComponent('oi luar, pelo telegram'));
  ok(r.telegram.length === 1 && /Luar responde: oi luar, pelo telegram/.test(r.telegram[0].text), 'conversa pelo Telegram');
  r = await luar('tg=777&texto=' + encodeURIComponent('quanto vocês ganham?'));
  ok(r.telegram.length === 1 && /particular/.test(r.telegram[0].text) && r.anthropic.length === 0, 'chat desconhecido não chega na Luar');
  console.log('5b. Bancos (Pluggy, paginação por cursor)');
  await luar('banco=1');
  await p.click('.sheet [data-a="close"]'); await p.evaluate(() => A.luarRecarregar()); await espera(800);
  await p.click('#main button[data-a="sheet"][data-k="luarAjustes"]');
  await p.click('.sheet button[data-a="luarBanco"]'); await p.locator('.sheet .note', { hasText: '3 transações' }).waitFor({ timeout: 15000 });
  r = await luar('contexto=1');
  ok(r.pluggy.some(u => u.includes('/v2/transactions') && u.includes('after=CUR1')) && !r.pluggy.some(u => u.startsWith('/transactions')), 'usa /v2/transactions e segue o cursor até o fim');
  ok(/Conta corrente: saldo R\$ 1\.234,50/.test(r.contexto) && /Delivery\/restaurante no banco: 1 compras, R\$ 89,90/.test(r.contexto) && /entradas R\$ 5\.000,00/.test(r.contexto), 'Luar lê saldo, delivery e entradas do banco');
  await p.click('.sheet button[data-a="luarBanco"]'); await espera(1500);
  ok(await p.locator('.sheet .note', { hasText: '3 transações' }).isVisible(), 'buscar de novo não duplica');
  await p.click('.sheet [data-a="close"]');

  console.log('6. Turnos');
  const dia = await p.evaluate(() => hoje());
  r = await luar('turno=1&hora=13&dia=' + dia);
  ok(r.anthropic.length === 1 && r.push.length === 0 && r.telegram.length === 0, 'à tarde, sem nada relevante, ela fica quieta (PULAR)');
  r = await luar('turno=1&hora=8&dia=' + dia);
  ok(r.push.length === 2 && r.push.every(l => /\[luar\] → Luar · (bom dia|fechamento do mês) \| Bom dia, casa\. Delivery/.test(l)), 'de manhã manda push para os dois, sem asteriscos: ' + r.push[0]);
  ok(r.telegram.length === 1 && r.telegram[0].chat_id === '555', 'e no Telegram vinculado');
  r = await luar('turno=1&hora=8&dia=' + dia);
  ok(r.anthropic.length === 0 && r.push.length === 0, 'uma vez só por turno');
  r = await luar('turno=1&hora=10&dia=' + dia);
  ok(r.anthropic.length === 0, 'fora dos turnos não chama a API');

  console.log('7. Conversa com tudo e cartão em Hoje');
  await p.evaluate(() => A.luarRecarregar()); await p.locator('.bolha.luar', { hasText: 'Bom dia, casa' }).waitFor({ timeout: 15000 });
  ok(await p.locator('.bolha.luar', { hasText: 'Luar · aviso' }).count() === 1 && await p.locator('.bolha', { hasText: 'Telegram' }).count() >= 1, 'avisos e Telegram aparecem na conversa do app');
  ok(await p.locator('.bolha.luar b', { hasText: 'Delivery' }).count() === 1, 'negrito da Luar vira <b>');
  await foto('conversa-completa');
  await p.evaluate(() => { S.tab = 'hoje'; render(false); });
  ok(await p.locator('#main .luar-hoje', { hasText: 'Bom dia, casa' }).isVisible(), 'Hoje mostra a última mensagem da Luar');
  await foto('hoje');
  await p.click('#main .luar-hoje'); await espera(200);
  ok(await p.evaluate(() => S.tab === 'financas' && S.fv === 'luar'), 'tocar no cartão abre a Luar');
  ok(await p.evaluate(() => { const m = document.querySelector('#main'); return m.scrollWidth <= m.clientWidth + 1; }), 'sem rolagem lateral');
  await b.close();
  console.log(erros.length ? '\nPROBLEMAS:\n' + erros.join('\n') : '\nTudo certo, nenhum erro no console.');
})().catch(e => { console.error('ERRO', String(e).split('\n').slice(0, 3).join(' | ')); console.log(erros.join('\n')); process.exit(1); });
