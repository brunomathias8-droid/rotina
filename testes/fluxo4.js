// Versão 3.1: Arquivos e anexos. Roda depois do fluxo3 (Bruno 1234 e Ana 4321 já existem).
const { chromium } = require('playwright');
const fs = require('fs');
const URL = 'http://localhost:8787/', DIR = __dirname + '/fotos4/';
fs.mkdirSync(DIR, { recursive: true });
const erros = [];
const espera = ms => new Promise(r => setTimeout(r, ms));
let n = 0;
async function foto(p, nome) { await espera(300); await p.screenshot({ path: DIR + String(++n).padStart(2, '0') + '-' + nome + '.png' }); }
function ok(c, m) { if (!c) { erros.push('FALHOU: ' + m); console.log('  ✗', m); } else console.log('  ✓', m); }
const json = async u => (await fetch('http://localhost:8787' + u)).json();
const texto = async u => (await fetch('http://localhost:8787' + u)).text();
async function entrar(b, nome, pin, tema, w = 390, h = 844) {
  const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 900 ? 2 : 1, colorScheme: tema || 'light', locale: 'pt-BR', timezoneId: 'America/Fortaleza', acceptDownloads: true });
  const p = await c.newPage();
  p.on('pageerror', e => erros.push(`[${nome}] pageerror ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.push(`[${nome}] console ${m.text()}`); });
  p.on('dialog', d => d.accept());
  await p.goto(URL); await p.fill('#lnome', nome); await p.fill('#lpin', pin); await p.click('button[type=submit]'); await p.waitForSelector('nav button');
  return { c, p };
}
const filaVazia = p => p.waitForFunction(() => S.fila.length === 0, null, { timeout: 20000 });
const sinc = async p => { await p.evaluate(() => sincronizar()); await espera(500); };
async function escolher(p, clicar, arquivos) {
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), clicar()]);
  await fc.setFiles(arquivos);
  await espera(600);
}
// PDF mínimo válido
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 300 200]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

(async () => {
  const b = await chromium.launch();
  const { c: cb, p: bruno } = await entrar(b, 'Bruno', '1234');
  const hojeIso = await bruno.evaluate(() => hoje());
  const venc = await bruno.evaluate(() => N_somaDias(hoje(), 25));

  console.log('1. Tela Arquivos e primeiro arquivo (PDF)');
  await bruno.click('#top button[data-v="arquivos"]'); await espera(200);
  ok(await bruno.evaluate(() => S.tab) === 'arquivos', 'ícone de pasta no topo abre Arquivos no celular');
  ok(await bruno.locator('text=Guardar o primeiro arquivo').isVisible(), 'tela vazia explica para que serve');
  await foto(bruno, 'arquivos-vazio');
  await escolher(bruno, () => bruno.click('#main button[data-a="anexar"][data-abrir="1"] >> nth=0'), [{ name: 'carteirinha_unimed.pdf', mimeType: 'application/pdf', buffer: PDF }]);
  ok(await bruno.locator('.sheet[data-k="arquivo"]').isVisible(), 'depois de escolher, abre o painel para dar nome');
  ok(await bruno.inputValue('#f-titulo') === 'Carteirinha unimed', 'nome sugerido a partir do arquivo');
  ok(await bruno.locator('.sheet button.chip.on[data-k="cat"]').innerText().then(t => t.includes('Saúde')), 'categoria adivinhada: Saúde');
  await bruno.fill('#f-titulo', 'Carteirinha do plano da Ana');
  await bruno.locator('.sheet button[data-a="arqPess"]', { hasText: 'Ana' }).click();
  await bruno.fill('#f-validade', venc);
  await bruno.click('.sheet button.tog[data-k="fixo"]');
  await foto(bruno, 'arquivo-novo');
  await bruno.click('.sheet button[data-a="salvarArq"]');
  await filaVazia(bruno);
  let drive = await json('/__drive');
  ok(drive.length === 1 && drive[0].tam === PDF.length && drive[0].mime === 'application/pdf', 'arquivo chegou inteiro no Google Drive');
  const plan = await json('/__planilha'), cab = plan.Arquivos[0], lin = plan.Arquivos[1], col = k => lin[cab.indexOf(k)];
  ok(col('Titulo') === 'Carteirinha do plano da Ana' && col('Categoria') === 'saude' && col('Validade') === venc && col('Fixo') === 'sim' && col('Drive') === drive[0].id, 'ficha na planilha com nome, categoria, validade, importante e o ID do Drive');
  ok(await bruno.locator('#main', { hasText: 'Validade perto do fim' }).isVisible() && await bruno.locator('#main .tag', { hasText: 'vence em 25 dias' }).isVisible(), 'aparece em "Validade perto do fim"');
  await foto(bruno, 'arquivos-lista');

  console.log('2. Foto grande anexada a um compromisso');
  const evId = await bruno.evaluate(() => lista('eventos').find(e => e.titulo === 'Pediatra').id);
  const png = Buffer.from(await bruno.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 3200; cv.height = 2400; const cx = cv.getContext('2d'), d = cx.createImageData(3200, 2400);
    for (let i = 0; i < d.data.length; i++) d.data[i] = (i % 4 === 3) ? 255 : (Math.random() * 255) | 0;
    cx.putImageData(d, 0, 0); const bl = await new Promise(r => cv.toBlob(r, 'image/png'));
    return await new Promise(r => { const f = new FileReader(); f.onload = () => r(String(f.result).split(',')[1]); f.readAsDataURL(bl); });
  }), 'base64');
  ok(png.length > 3 * 1048576, `foto de teste grande (${(png.length / 1048576).toFixed(1)} MB)`);
  await bruno.evaluate(id => openSheet({ k: 'evento', id }), evId); await espera(200);
  ok(await bruno.locator('.sheet', { hasText: 'Anexos' }).isVisible(), 'compromisso tem a seção Anexos');
  await escolher(bruno, () => bruno.click('.sheet button[data-a="anexar"]'), [{ name: 'IMG_4512.PNG', mimeType: 'image/png', buffer: png }]);
  await espera(1500);
  await filaVazia(bruno);
  drive = await json('/__drive');
  const foto1 = drive.find(f => f.mime === 'image/jpeg');
  ok(foto1 && foto1.tam < png.length / 2, `foto reduzida antes de subir (${(png.length / 1048576).toFixed(1)} MB → ${foto1 ? (foto1.tam / 1048576).toFixed(1) : '?'} MB, JPEG)`);
  const anexo = await bruno.evaluate(id => lista('arquivos').find(a => a.liga === 'eventos:' + id), evId);
  ok(anexo && anexo.cat === 'saude' && /^Foto de /.test(anexo.titulo), 'anexo herda a categoria do compromisso (saúde) e ganha nome legível');
  ok(await bruno.locator('.sheet .it', { hasText: anexo.titulo }).isVisible(), 'anexo aparece dentro do compromisso');
  await foto(bruno, 'evento-com-anexo');
  await bruno.evaluate(() => closeSheet());
  await bruno.evaluate(() => { S.tab = 'agenda'; S.ag = 'lista'; render(); });
  ok(await bruno.locator('#main .it.ev', { hasText: 'Pediatra' }).first().innerText().then(t => t.includes('📎 1')), 'lista da agenda mostra 📎 1 no compromisso');

  console.log('3. Ana vê, abre e guarda para usar sem internet');
  const { c: ca, p: ana } = await entrar(b, 'Ana', '4321', 'dark');
  await sinc(ana);
  await ana.evaluate(id => openSheet({ k: 'evento', id }), evId); await espera(200);
  await ana.locator('.sheet .it', { hasText: anexo.titulo }).click();
  await ana.waitForSelector('.sheet .arqprev img', { timeout: 15000 });
  const larg = await ana.evaluate(() => new Promise(r => { const i = document.querySelector('.arqprev img'); if (i.complete) r(i.naturalWidth); else i.onload = () => r(i.naturalWidth); }));
  ok(larg === 2400, `Ana abre a foto que veio do servidor (${larg} px de largura)`);
  await foto(ana, 'ana-foto-anexo');
  await ana.click('.sheet button[data-a="close"]'); await espera(200);
  ok(await ana.evaluate(() => S.sheet && S.sheet.k === 'evento'), 'fechar o anexo volta para o compromisso');
  await ana.evaluate(() => closeSheet());
  await ana.waitForFunction(id => idb.get('arq:' + id).then(x => !!x), (await bruno.evaluate(() => lista('arquivos').find(a => a.fixo).id)), { timeout: 15000, polling: 500 }).catch(() => { });
  const temCop = await ana.evaluate(() => temCopia(lista('arquivos').find(a => a.fixo).id));
  ok(temCop, 'arquivo importante já ficou guardado no aparelho da Ana');
  await ca.setOffline(true);
  await ana.evaluate(() => { S.tab = 'arquivos'; render(false); });
  await ana.locator('#main .it', { hasText: 'Carteirinha do plano da Ana' }).click();
  await ana.waitForSelector('.sheet .arqprev .arqtile', { timeout: 8000 });
  ok(await ana.locator('.sheet a.btn', { hasText: 'Abrir' }).getAttribute('href').then(h => h.startsWith('blob:')), 'sem internet: a carteirinha abre do aparelho');
  await foto(ana, 'ana-carteirinha-offline');
  await ana.evaluate(() => closeSheet());
  await ca.setOffline(false);

  console.log('4. Links');
  await bruno.evaluate(() => { S.tab = 'arquivos'; render(false); });
  await bruno.click('#main button[data-a="novoLink"]'); await espera(300);
  await bruno.fill('#f-url', 'drive.google.com/drive/folders/1AbCdEf');
  await bruno.click('.sheet button[data-a="salvarArq"]'); await filaVazia(bruno);
  const lk = await bruno.evaluate(() => lista('arquivos').find(a => a.tipo === 'link'));
  ok(lk && lk.url === 'https://drive.google.com/drive/folders/1AbCdEf' && lk.titulo === 'Arquivo do Google Drive', 'link sem https é corrigido e ganha nome');
  ok(await bruno.locator('#main .it', { hasText: 'Arquivo do Google Drive' }).innerText().then(t => t.includes('☁️')), 'link do Drive com ícone de nuvem');
  const tarId = await bruno.evaluate(() => { const t = abertas()[0]; openSheet({ k: 'tarefa', id: t.id }); return t.id; }); await espera(200);
  await bruno.fill('#f-titulo', 'Título mudado e ainda não salvo');
  await bruno.click('.sheet button[data-a="novoLink"]'); await espera(300);
  await bruno.fill('#f-url', 'https://www.gov.br/receitafederal'); await bruno.fill('#f-titulo', 'Site da Receita');
  await bruno.click('.sheet button[data-a="salvarArq"]'); await espera(300);
  ok(await bruno.evaluate(() => S.sheet && S.sheet.k === 'tarefa' && S.sheet.f.titulo === 'Título mudado e ainda não salvo'), 'colar link numa tarefa volta para a tarefa sem perder o que foi digitado');
  ok(await bruno.locator('.sheet .it', { hasText: 'Site da Receita' }).isVisible(), 'link aparece nos anexos da tarefa');
  await bruno.evaluate(() => closeSheet()); await filaVazia(bruno);
  ok(await bruno.evaluate(id => abertas().find(t => t.id === id) && lista('arquivos').some(a => a.liga === 'tarefas:' + id), tarId), 'anexo ligado à tarefa');

  console.log('5. Sem internet, busca, limite e exclusão');
  await cb.setOffline(true);
  await escolher(bruno, () => bruno.click('#main button[data-a="anexar"][data-abrir="1"] >> nth=0'), [{ name: 'senha do wifi.txt', mimeType: 'text/plain', buffer: Buffer.from('rede: casa / senha: 123') }]);
  await bruno.click('.sheet button[data-a="close"]'); await espera(200);
  ok(await bruno.locator('#main .it', { hasText: 'Senha do wifi' }).innerText().then(t => t.includes('enviando')), 'sem internet: aparece como "enviando…"');
  await cb.setOffline(false); await bruno.evaluate(() => processarFila()); await filaVazia(bruno);
  ok((await json('/__drive')).some(f => f.nome === 'senha do wifi.txt'), 'quando a internet volta, sobe sozinho');
  await bruno.fill('#arqbusca', 'carteirinha'); await espera(300);
  ok(await bruno.locator('#main .it').count() === 1, 'busca encontra só a carteirinha');
  await bruno.fill('#arqbusca', ''); await espera(300);
  await escolher(bruno, () => bruno.click('#main button[data-a="anexar"][data-abrir="1"] >> nth=0'), [{ name: 'video.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(11 * 1048576, 1) }]);
  ok(await bruno.locator('#toast', { hasText: 'grande demais' }).isVisible() && await bruno.evaluate(() => !lista('arquivos').some(a => a.titulo === 'Video')), 'arquivo de 11 MB é recusado com explicação');
  await bruno.locator('#main .it', { hasText: 'Senha do wifi' }).click(); await espera(300);
  await bruno.click('.sheet button[data-a="excluirArq"]'); await filaVazia(bruno);
  ok((await json('/__drive')).find(f => f.nome === 'senha do wifi.txt').lixo === true, 'excluir manda o arquivo para a lixeira do Drive');

  console.log('6. Segurança, aviso de validade e lançamento');
  const ataque = await bruno.evaluate(async id => {
    await api('salvar', { col: 'arquivos', item: { id: 'ataque12345', titulo: 'x', tipo: 'arquivo', drive: id } });
    try { await api('baixarArquivo', { id: 'ataque12345' }); return 'baixou'; } catch (e) { return e.message; }
  }, drive[0].id);
  ok(ataque !== 'baixou', 'não dá para apontar uma ficha para um arquivo qualquer do Drive');
  const diaAviso = await bruno.evaluate(v => N_somaDias(v, -7), venc);
  const av7 = await texto(`/__avisos?hora=8&dia=${diaAviso}`);
  ok(/Ana \[tarefas\] → Carteirinha do plano da Ana vence em 7 dias/.test(av7) && !/Bruno \[tarefas\] → Carteirinha/.test(av7), 'aviso de validade 7 dias antes, só para a Ana');
  await bruno.evaluate(() => { S.tab = 'hoje'; render(false); });
  ok(await bruno.locator('#main', { hasText: 'Documentos para renovar' }).isVisible(), 'Hoje mostra "Documentos para renovar"');
  const lancId = await bruno.evaluate(() => (lista('lancamentos')[0] || {}).id);
  if (lancId) { await bruno.evaluate(id => openSheet({ k: 'lanc', id }), lancId); await espera(200); ok(await bruno.locator('.sheet summary', { hasText: 'Comprovante' }).isVisible(), 'lançamento aceita comprovante'); await bruno.evaluate(() => closeSheet()); }

  console.log('7. Computador');
  const { c: cpc, p: pc } = await entrar(b, 'Bruno', '1234', 'light', 1366, 768);
  ok(await pc.locator('nav button[data-v="arquivos"]').isVisible() && !(await pc.locator('#top button[data-v="arquivos"]').isVisible()), 'no computador, Arquivos fica no menu lateral');
  await pc.keyboard.press('6'); await espera(200);
  ok(await pc.evaluate(() => S.tab) === 'arquivos', 'tecla 6 abre Arquivos');
  ok(await pc.evaluate(() => { const m = document.querySelector('#main'); return m.scrollWidth <= m.clientWidth + 1; }), 'sem rolagem lateral');
  await foto(pc, 'pc-arquivos');
  await pc.locator('#main .it', { hasText: 'Carteirinha do plano da Ana' }).click();
  await pc.waitForSelector('.sheet .arqprev iframe', { timeout: 8000 });
  ok(true, 'no computador, o PDF aparece dentro do painel');
  await foto(pc, 'pc-pdf');
  ok(await bruno.evaluate(() => !document.querySelector('nav button[data-v="arquivos"]').offsetParent), 'no celular, o menu de baixo continua com 5 itens');

  await b.close();
  console.log(erros.length ? '\nPROBLEMAS:\n' + erros.join('\n') : '\nTudo certo, nenhum erro no console.');
})().catch(e => { console.error('ERRO NO TESTE', String(e).split('\n').slice(0, 3).join(' | ')); console.log(erros.join('\n')); process.exit(1); });
