// Versão 3.3: importar fatura do cartão. Roda depois do fluxo3 (Bruno 1234).
const { chromium } = require('playwright');
const fs = require('fs');
const XLSX = require('xlsx');
const URL = 'http://localhost:8787/', DIR = __dirname + '/fotos6/';
fs.mkdirSync(DIR, { recursive: true });
const erros = []; let n = 0;
const espera = ms => new Promise(r => setTimeout(r, ms));
function ok(c, m) { if (!c) { erros.push('FALHOU: ' + m); console.log('  ✗', m); } else console.log('  ✓', m); }
const json = async u => (await fetch('http://localhost:8787' + u)).json();

(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'pt-BR', timezoneId: 'America/Fortaleza', acceptDownloads: true });
  await c.route('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(require.resolve('xlsx/dist/xlsx.full.min.js')) }));
  const p = await c.newPage();
  p.on('pageerror', e => erros.push('pageerror ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.push('console ' + m.text()); });
  p.on('dialog', d => d.accept());
  const foto = async nome => { await espera(300); await p.screenshot({ path: DIR + String(++n).padStart(2, '0') + '-' + nome + '.png' }); };
  const filaVazia = () => p.waitForFunction(() => S.fila.length === 0, null, { timeout: 30000 });
  const escolher = async (nome, buffer) => { const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('.sheet button[data-a="impArquivo"]')]); await fc.setFiles([{ name: nome, mimeType: 'application/octet-stream', buffer }]); await p.waitForFunction(() => S.sheet && S.sheet.rows, null, { timeout: 15000 }); await espera(200); };
  await p.goto(URL); await p.fill('#lnome', 'Bruno'); await p.fill('#lpin', '1234'); await p.click('button[type=submit]'); await p.waitForSelector('nav button');

  // Cartão novo: fecha dia 3, vence dia 10
  const K = await p.evaluate(() => { const id = uidNovo(); enfileirar('salvar', { col: 'cartoes', item: { id, nome: 'Roxinho', cor: '#8A05BE', limite: 1000000, fecha: 3, vence: 10, ativo: true } }); return id; });
  await filaVazia();
  const D = await p.evaluate(k => { const c = S.d.cartoes.get(k), ref = N_faturaRef(c, hoje()), f = N_fechamento(c, ref); const ini = N_somaDias(N_fechamento(c, N_somaMes(ref, -1)), 0);
    return { ref, ini, d1: N_somaDias(ini, 1), d2: N_somaDias(ini, 4), d3: N_somaDias(ini, 9), d4: N_somaDias(ini, 15), antiga: N_somaDias(ini, -55), prox: N_somaMes(ref, 1) }; }, K);
  console.log('   fatura de teste:', D.ref, 'compras a partir de', D.ini);

  console.log('1. Abrir o importador e baixar o modelo');
  await p.evaluate(() => { S.tab = 'financas'; S.fv = 'cartoes'; render(false); });
  await p.click(`#main button[data-a="importarFatura"][data-id="${K}"]`); await espera(300);
  ok(await p.locator('.sheet', { hasText: 'Importar fatura' }).isVisible(), 'cartão tem "Importar fatura"');
  await foto('importar-inicio');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.sheet button[data-a="impModelo"]')]);
  const modelo = fs.readFileSync(await dl.path(), 'utf8');
  ok(dl.suggestedFilename() === 'rotina-fatura-modelo.csv' && modelo.includes('Data;Descrição;Valor;Categoria;Parcela;Observação'), 'planilha modelo baixa com as colunas certas');

  console.log('2. CSV exportado pelo banco (estilo Nubank)');
  const csv = ['date,title,amount',
    `${D.d1},Uber *Trip,23.50`, `${D.d2},iFood *Restaurante,58.90`, `${D.d2},Netflix.com,55.90`,
    `${D.antiga},Magazine Luiza - Parcela 3/10,350.00`, `${D.d3},Pagamento recebido,-1200.00`,
    `${D.d3},Estorno Amazon,-89.90`, `${D.d4},IOF de compra internacional,4.12`, `${D.d4},Supermercado Extra,412.37`].join('\n');
  await escolher('Nubank_fatura.csv', Buffer.from(csv));
  const st = await p.evaluate(() => ({ v: S.sheet.v, rows: S.sheet.rows.map(r => [r.desc, r.v, r.cat, r.parc, r.st, r.inc]) }));
  ok(st.v === D.ref, `fatura reconhecida pelas datas (${st.v})`);
  const row = t => st.rows.find(r => r[0].startsWith(t));
  ok(row('Uber')[2] === 'transporte' && row('iFood')[2] === 'delivery' && row('Netflix')[2] === 'assinaturas' && row('Supermercado')[2] === 'mercado' && row('IOF')[2] === 'impostos', 'categorias adivinhadas (Uber, iFood, Netflix, mercado, IOF)');
  ok(row('Magazine Luiza')[3] === '3/10' && row('Magazine Luiza')[0] === 'Magazine Luiza', 'parcela 3/10 separada do nome');
  ok(row('Pagamento')[4] === 'pag' && !row('Pagamento')[5], 'pagamento da fatura fica de fora');
  ok(row('Estorno')[4] === 'cred' && row('Estorno')[1] === -8990 && row('Estorno')[5], 'estorno entra como crédito');
  const esperado = 2350 + 5890 + 5590 + 35000 - 8990 + 412 + 41237;
  await p.fill('#f-total', (esperado / 100).toFixed(2).replace('.', ','));
  ok(await p.locator('#impconf', { hasText: 'Bate com o banco' }).isVisible(), 'total digitado bate com o banco');
  await p.fill('#f-total', ((esperado + 1000) / 100).toFixed(2).replace('.', ','));
  ok(await p.locator('#impconf', { hasText: 'faltam R$ 10,00' }).isVisible(), 'diferença aparece quando não bate');
  await p.locator('.sheet select[data-i^="impcat"]').nth(2).selectOption('lazer');
  await foto('revisao');
  await p.click('.sheet button[data-a="impLancar"]'); await filaVazia(); await espera(300);
  const fat = await p.evaluate(([k, r]) => { const c = S.d.cartoes.get(k), f = fatura(c, r); return { total: f.total, n: f.compras.length, netflix: f.compras.find(l => l.desc.startsWith('Netflix')).cat, futuras: [1, 2, 7].map(i => fatura(c, N_somaMes(r, i)).compras.filter(l => l.desc === 'Magazine Luiza').map(l => l.parc).join()) }; }, [K, D.ref]);
  ok(fat.total === esperado && fat.n === 7, `fatura no app: ${fat.n} lançamentos, ${(fat.total / 100).toFixed(2)} (esperado ${(esperado / 100).toFixed(2)})`);
  ok(fat.netflix === 'lazer', 'categoria trocada na revisão foi respeitada');
  ok(fat.futuras.join('|') === '4/10|5/10|10/10', 'parcelas futuras nas faturas certas (4/10, 5/10 … 10/10)');
  ok(await p.evaluate(() => S.sheet && S.sheet.k === 'fatura'), 'depois de importar, mostra a fatura');
  await foto('fatura-importada');
  const plan = await json('/__planilha'), cab = plan.Lancamentos[0];
  ok(cab.includes('Fatura') && plan.Lancamentos.slice(1).filter(l => l[cab.indexOf('Fatura')] === D.ref).length === 7, 'planilha guarda a fatura de cada compra (coluna Fatura)');

  console.log('3. Importar de novo não duplica');
  await p.evaluate(([k, r]) => openSheet({ k: 'importar', id: k, v: r }), [K, D.ref]); await espera(200);
  await escolher('Nubank_fatura.csv', Buffer.from(csv));
  const re = await p.evaluate(() => ({ dup: S.sheet.rows.filter(r => r.st === 'dup').length, inc: S.sheet.rows.filter(r => r.inc).length }));
  ok(re.dup === 7 && re.inc === 0, `mesmo arquivo de novo: ${re.dup} já no app, nada a importar`);
  ok(await p.locator('.sheet button[data-a="impLancar"]').isDisabled(), 'botão de importar fica desligado');
  await p.evaluate(() => closeSheet());

  console.log('4. Próxima fatura: parcela 4/10 já lançada é reconhecida');
  const csv2 = ['date,title,amount', `${D.antiga},Magazine Luiza - Parcela 4/10,350.00`, `${N_somaMesJS(D.d2, 1)},Padaria Real,18.00`].join('\n');
  await p.evaluate(([k, r]) => openSheet({ k: 'importar', id: k, v: r }), [K, D.prox]); await espera(200);
  await escolher('nubank-prox.csv', Buffer.from(csv2));
  const r2 = await p.evaluate(() => ({ v: S.sheet.v, rows: S.sheet.rows.map(r => [r.desc, r.st, r.inc]) }));
  ok(r2.v === D.prox && r2.rows[0][1] === 'dup' && r2.rows[1][2], 'na fatura seguinte, a 4/10 aparece como "já no app" e só a compra nova entra');
  await p.click('.sheet button[data-a="impLancar"]'); await espera(300);
  ok(await p.locator('#toast button', { hasText: 'Desfazer' }).isVisible(), 'oferece desfazer a importação');
  await p.click('#toast button'); await filaVazia(); await espera(300);
  ok(await p.evaluate(([k, r]) => !fatura(S.d.cartoes.get(k), r).compras.some(l => l.desc === 'Padaria Real'), [K, D.prox]), 'desfazer apaga o que foi importado');
  await p.evaluate(() => closeSheet());

  console.log('5. Excel (planilha modelo preenchida)');
  const serial = iso => (Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5) + 25569;
  const ws = XLSX.utils.aoa_to_sheet([['Fatura Roxinho'], [], ['Data', 'Descrição', 'Valor', 'Categoria', 'Parcela', 'Observação'],
    [serial(D.d1), 'Farmácia Pague Menos', 87.4, '', '', ''], [serial(D.d2), 'Presente da mãe', 120, 'Presentes', '', 'aniversário'], [serial(D.antiga), 'Sofá', 450, 'Compras e roupas', '2/6', '']]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Compras');
  const xbuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  await p.evaluate(([k, r]) => openSheet({ k: 'importar', id: k, v: r }), [K, D.ref]); await espera(200);
  await escolher('fatura.xlsx', xbuf);
  const rx = await p.evaluate(() => S.sheet.rows.map(r => [r.dia, r.desc, r.v, r.cat, r.parc, r.obs]));
  ok(rx.length === 3 && rx[0][0] === D.d1 && rx[0][3] === 'saude' && rx[1][3] === 'presentes' && rx[1][5] === 'aniversário' && rx[2][4] === '2/6' && rx[2][2] === 45000, 'Excel lido: datas, valores, categoria escrita e adivinhada, parcela, observação');
  await p.evaluate(() => closeSheet());

  console.log('6. Colado do Excel, sem ano, e CSV com acento em Latin-1 (estilo C6)');
  const [dd, mm] = [D.d2.slice(8, 10), D.d2.slice(5, 7)];
  await p.evaluate(([k, r]) => openSheet({ k: 'importar', id: k, v: r }), [K, D.ref]); await espera(200);
  await p.click('.sheet summary'); await p.fill('#f-colar', `Data\tDescrição\tValor\n${dd}/${mm}\tPadaria São João\tR$ 12,50\n${dd}/${mm}\tPosto Shell\t1.234,56`);
  await p.click('.sheet button[data-a="impColar"]'); await espera(300);
  const rc = await p.evaluate(() => S.sheet.rows.map(r => [r.dia, r.v, r.cat]));
  ok(rc[0][0] === D.d2 && rc[0][1] === 1250 && rc[1][1] === 123456 && rc[1][2] === 'transporte', 'colado: ano deduzido, R$ 12,50 e 1.234,56 lidos certo');
  await p.evaluate(() => { S.sheet.rows = null; renderSheet(); });
  const c6 = 'Data de Compra;Nome no Cartão;Final do Cartão;Categoria;Descrição;Parcela;Valor (em US$);Cotação (em R$);Valor (em R$)\n'
    + `${D.d1.split('-').reverse().join('/')};BRUNO M;1234;Supermercados;Pão de Açúcar;Única;0;0;199,90\n${D.d2.split('-').reverse().join('/')};BRUNO M;1234;Departamento;Amazon Marketplace;1/3;0;0;100,00\n`;
  await escolher('Fatura_C6.csv', Buffer.from(c6, 'latin1'));
  const r6 = await p.evaluate(() => S.sheet.rows.map(r => [r.desc, r.v, r.parc, r.cat]));
  ok(r6[0][0] === 'Pão de Açúcar' && r6[0][1] === 19990 && r6[0][2] === '' && r6[0][3] === 'mercado' && r6[1][2] === '1/3', 'CSV em Latin-1: acentos certos, coluna em R$ (não US$), "Única" não é parcela');
  await p.evaluate(() => closeSheet());

  console.log('7. Computador');
  await p.setViewportSize({ width: 1366, height: 768 }); await espera(300);
  await p.evaluate(([k, r]) => openSheet({ k: 'importar', id: k, v: r }), [K, D.ref]); await espera(200);
  await escolher('Nubank_fatura.csv', Buffer.from(csv.replace('Uber *Trip,23.50', 'Uber *Trip,23.51')));
  ok(await p.evaluate(() => { const s = document.querySelector('.sheet'); return s.scrollWidth <= s.clientWidth + 1; }), 'revisão sem rolagem lateral no computador');
  await foto('pc-revisao');

  await b.close();
  console.log(erros.length ? '\nPROBLEMAS:\n' + erros.join('\n') : '\nTudo certo, nenhum erro no console.');
})().catch(e => { console.error('ERRO NO TESTE', String(e).split('\n').slice(0, 3).join(' | ')); console.log(erros.join('\n')); process.exit(1); });

function N_somaMesJS(iso, k) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + k); return d.toISOString().slice(0, 10); }
