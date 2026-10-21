// 3.7: Finanças › Análises. Futuro comprometido (parcelas), próximos 6 meses, mês contra a média,
// gastos que se repetem, por cartão, viagens e projetos, a receber de outras pessoas. Roda depois do fluxo3.
const { chromium } = require('playwright');
const fs = require('fs');
const DIR = __dirname + '/fotos17/'; fs.mkdirSync(DIR, { recursive: true });
const erros = []; let n = 0;
const espera = ms => new Promise(r => setTimeout(r, ms));
function ok(c, m) { if (!c) { erros.push('FALHOU: ' + m); console.log('  ✗', m); } else console.log('  ✓', m); }
(async () => {
  const b = await chromium.launch();
  for (const [w, h, tema] of [[390, 844, 'light'], [1366, 768, 'dark']]) {
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 900 ? 2 : 1, colorScheme: tema, locale: 'pt-BR', timezoneId: 'America/Fortaleza' });
    await c.addInitScript(e => localStorage.setItem('rotina_estilo', e), w < 900 ? 'classico' : 'editorial');
    const p = await c.newPage();
    p.on('pageerror', e => erros.push('pageerror ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.push('console ' + m.text()); });
    p.on('dialog', d => d.accept());
    const foto = async (nome, cheia) => { await espera(300); await p.screenshot({ path: DIR + String(++n).padStart(2, '0') + `-${w}-${nome}.png`, fullPage: !!cheia }); };
    const fila = () => p.waitForFunction(() => S.fila.length === 0, null, { timeout: 20000 });
    await p.goto('http://localhost:8787/'); await p.fill('#lnome', 'Bruno'); await p.fill('#lpin', '1234'); await p.click('button[type=submit]'); await p.waitForSelector('nav button');
    if (w === 390) {
      console.log('1. Dados: cartão com parcelas e assinaturas, receitas e contas fixas, viagem, reembolso');
      await p.evaluate(() => {
        const k = 'cart17aaaaaa', h = hoje(), m = N_mes(h), itens = [], g = uidNovo();
        enfileirar('salvar', { col: 'cartoes', item: { id: k, nome: 'Cartão 17', fecha: 1, vence: 8, ativo: true, limite: 3000000, cor: '#C62828' } });
        // compras do dia 2: entram na fatura que vence no dia 8 do mês seguinte
        N_datasParcelas(N_somaMes(m, -1) + '-02', 6).forEach((d, i) => itens.push({ id: uidNovo(), tipo: 'saida', forma: 'cartao', cartao: k, dia: d, v: 60000, desc: 'Geladeira Frost', cat: 'compras', pago: true, parc: (i + 1) + '/6', grupo: g }));
        [-3, -2, -1, 0].forEach(i => itens.push({ id: uidNovo(), tipo: 'saida', forma: 'cartao', cartao: k, dia: N_somaMes(m, i) + '-02', v: 5590, desc: 'NETFLIX.COM', cat: 'assinaturas', pago: true }));
        [-3, -2, -1].forEach(i => itens.push({ id: uidNovo(), tipo: 'saida', forma: 'cartao', cartao: k, dia: N_somaMes(m, i) + '-02', v: 4200, desc: 'ANUIDADE DIFERENCIADA', cat: 'impostos', pago: true }));
        [-3, -2, -1].forEach(i => itens.push({ id: uidNovo(), tipo: 'saida', forma: 'cartao', cartao: k, dia: N_somaMes(m, i) + '-03', v: 30000, desc: 'IFOOD', cat: 'delivery', pago: true }));
        itens.push({ id: uidNovo(), tipo: 'saida', forma: 'cartao', cartao: k, dia: N_somaMes(m, -1) + '-04', v: 90000, desc: 'IFOOD', cat: 'delivery', pago: true });
        itens.push({ id: uidNovo(), tipo: 'saida', forma: 'cartao', cartao: k, dia: N_somaMes(m, -1) + '-05', v: 250000, desc: 'TAP AIR PORTUGAL', cat: 'viagens', pago: true, proj: 'Bruxelas 2026' });
        itens.push({ id: uidNovo(), tipo: 'saida', forma: 'cartao', cartao: k, dia: N_somaMes(m, -1) + '-06', v: 80000, desc: 'AIRBNB', cat: 'viagens', pago: true, proj: 'Bruxelas 2026', reemb: 'Eliane' });
        enfileirar('lote', { col: 'lancamentos', itens });
        enfileirar('salvar', { col: 'contas', item: { id: 'rec17salario', tipo: 'entrada', nome: 'Salário 17', v: 900000, vence: 5, cat: 'salario', ativa: true } });
        enfileirar('salvar', { col: 'contas', item: { id: 'rec17financ', tipo: 'saida', nome: 'Financiamento 17', v: 130000, vence: 26, cat: 'transporte', forma: 'boleto', ativa: true, fim: N_somaMes(m, 2) } });
      });
      await fila(); await p.evaluate(() => sincronizar(true)); await espera(900);
      const d = await p.evaluate(() => {
        const fut = futuroComprometido(12), s = fut.series.find(x => x.nome === 'Cartão 17'), ab = parceladasAbertas().find(x => x.desc === 'Geladeira Frost');
        const rep = gastosQueSeRepetem(), nf = rep.find(x => x.k === 'netflix com'), an = rep.find(x => x.k === 'anuidade diferenciada');
        const fl = fluxoProximos(6), proj = porProjeto().find(x => x.nome === 'Bruxelas 2026'), deve = aReceberDeTerceiros().find(x => x.nome === 'Eliane');
        return { s: s && s.vals.slice(0, 6), ab: ab && [ab.restam, ab.falta, ab.fim], nf: nf && [nf.media, nf.anual], an: an && an.negociar, geladeira: rep.some(x => /geladeira/.test(x.k)), ifood: rep.some(x => x.k === 'ifood'),
          fl: fl.map(x => [x.ref, x.rec >= 900000, x.desp]), proj: proj && [proj.v, proj.n], deve: deve && deve.v, m: N_mes(hoje()) };
      });
      console.log('   ', JSON.stringify(d));
      ok(d.s && d.s[0] >= 60000 && d.s[0] < 70000 && d.s[4] === 60000 && d.s[5] === 0, 'futuro comprometido: parcelas da geladeira nas próximas faturas, e acaba');
      ok(d.ab && d.ab[0] === 5 && d.ab[1] === 300000, 'parcelamento aberto: faltam 5 de R$ 600 (R$ 3.000)');
      ok(d.nf && d.nf[0] === 5590 && d.nf[1] === 67080, 'Netflix detectada como gasto que se repete: R$ 55,90/mês, R$ 670,80 por ano');
      ok(d.an === true, 'anuidade marcada como "dá para negociar"');
      ok(!d.geladeira, 'compras parceladas não contam como "se repete"');
      ok(!d.ifood, 'gasto que varia muito (delivery) não vira assinatura');
      ok(d.fl.length === 6 && d.fl.every(x => x[1]), 'próximos 6 meses: o salário fixo entra em todos');
      ok(d.proj && d.proj[0] === 330000 && d.proj[1] === 2, 'viagem Bruxelas 2026: R$ 3.300 em 2 gastos');
      ok(d.deve === 80000, 'Eliane deve R$ 800');
      const cm = await p.evaluate(() => { const r = contraMedia(N_somaMes(N_mes(hoje()), 1)); return r.itens.map(x => [x.id, x.v, x.media]); });
      ok(cm.some(x => x[0] === 'delivery'), 'contra a média: categorias comparadas com os meses anteriores ' + JSON.stringify(cm.slice(0, 4)));
    }

    console.log(`2. Tela ${w}px`);
    await p.evaluate(() => { S.tab = 'financas'; S.fv = 'analises'; S.mes = N_mes(hoje()); render(false); });
    await espera(300);
    const txt = await p.locator('#main').innerText();
    ok(['Futuro comprometido', 'Próximos 6 meses', 'contra a média', 'Por cartão', 'Gastos que se repetem', 'Viagens e projetos', ...(w < 900 ? ['A receber de outras pessoas'] : [])].every(t => txt.includes(t)), 'todas as análises aparecem');
    ok(/Em \w+ libera R\$/.test(txt) || txt.includes('libera'), 'diz quando o dinheiro das parcelas libera');
    ok(await p.evaluate(() => { const m = document.querySelector('#main'); return m.scrollWidth <= m.clientWidth + 1; }), 'sem rolagem lateral');
    await foto('analises');
    for (const sec of ['Próximos 6 meses', 'contra a média', 'Gastos que se repetem']) { await p.locator('#main .sec', { hasText: sec }).first().scrollIntoViewIfNeeded(); await p.evaluate(() => { document.querySelector('#main').scrollTop += 0; }); await foto(sec.split(' ')[0].toLowerCase()); }
    if (w === 390) {
      console.log('3. Ações');
      await p.locator('#main .it', { hasText: 'Bruxelas 2026' }).click(); await espera(300);
      ok(await p.locator('#main .chip.on', { hasText: 'todos os meses' }).isVisible() && (await p.locator('#main #extlista .it').count()) === 2, 'tocar na viagem mostra os 2 gastos, em todos os meses');
      await p.evaluate(() => { S.fv = 'analises'; S.busca = ''; render(false); });
      await p.locator('#main button[data-a="devolveu"]').first().click(); await fila();
      ok(await p.evaluate(() => !aReceberDeTerceiros().some(x => x.nome === 'Eliane')), '"Devolveu" tira a Eliane de A receber');
      ok(await p.locator('.toast button', { hasText: 'Lançar a entrada' }).isVisible(), 'e oferece lançar a entrada');
    }
    await c.close();
  }
  await b.close();
  console.log(erros.length ? '\nPROBLEMAS:\n' + erros.join('\n') : '\nTudo certo, nenhum erro no console.');
})().catch(e => { console.error('ERRO', String(e).split('\n').slice(0, 3).join(' | ')); console.log(erros.join('\n')); process.exit(1); });
