// 3.3.2: meta do cartão mede a fatura do mês. Roda depois do fluxo3.
const { chromium } = require('playwright');
const fs = require('fs');
const DIR = __dirname + '/fotos8/'; fs.mkdirSync(DIR, { recursive: true });
const erros = [];
function ok(c, m) { if (!c) { erros.push('FALHOU: ' + m); console.log('  ✗', m); } else console.log('  ✓', m); }
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1234, height: 760 }, locale: 'pt-BR', timezoneId: 'America/Fortaleza' })).newPage();
  p.on('pageerror', e => erros.push('pageerror ' + e.message));
  await p.goto('http://localhost:8787/'); await p.fill('#lnome', 'Bruno'); await p.fill('#lpin', '1234'); await p.click('button[type=submit]'); await p.waitForSelector('nav button');
  // Como no print: cartão C6 fecha dia 9, vence dia 16; fatura deste mês com R$ 9.000 de compras do mês passado; R$ 2.795,35 de compras deste mês (próxima fatura)
  const r = await p.evaluate(() => {
    const k = uidNovo(), m = uidNovo(), ref = N_mes(hoje()), ant = N_somaMes(ref, -1);
    enfileirar('salvar', { col: 'cartoes', item: { id: k, nome: 'C6 Bruno', fecha: 9, vence: 16, ativo: true, limite: 3000000 } });
    const compra = (dia, v, desc) => ({ id: uidNovo(), tipo: 'saida', forma: 'cartao', cartao: k, dia, v, desc, cat: 'compras', pago: true, carteira: '', conta: '', ref: '' });
    enfileirar('lote', { col: 'lancamentos', itens: [compra(ant + '-15', 500000, 'Compra grande'), compra(ant + '-28', 400000, 'Outra compra'), compra(ref + '-10', 279535, 'Compras deste mês')] });
    enfileirar('salvar', { col: 'metas', item: { id: m, nome: 'Gastar menos no cartão', ic: '💳', tipo: 'reduzir', metrica: 'cartao', alvo: 750000, ativa: true, inicio: hoje() } });
    const c = S.d.cartoes.get(k);
    return { m, fat: fatura(c, ref).total, meta: progressoMeta(S.d.metas.get(m)), compradoNoMes: resumoMes(ref).cartao };
  });
  console.log('   fatura do mês:', r.fat / 100, '· meta mede:', r.meta.atual / 100, '· compras feitas no mês:', r.compradoNoMes / 100);
  ok(r.fat >= 900000 && r.meta.atual >= r.fat, 'meta do cartão mede a soma das faturas que vencem no mês (não as compras feitas no mês)');
  ok(r.meta.status === 'atencao' && /Passou/.test(r.meta.linha), `meta mostra que passou do limite: "${r.meta.linha}"`);
  await p.evaluate(id => openSheet({ k: 'meta', id }), r.m); await new Promise(x => setTimeout(x, 300));
  ok(await p.locator('.sheet', { hasText: 'Soma das faturas que vencem em' }).isVisible() && await p.locator('.sheet .it', { hasText: 'C6 Bruno' }).isVisible(), 'dentro da meta, aparece a fatura de cada cartão');
  ok(await p.locator('.sheet', { hasText: 'Fatura do cartão por mês' }).isVisible(), 'nome da medida: "Fatura do cartão por mês"');
  await p.screenshot({ path: DIR + '01-meta-cartao.png' });
  await b.close();
  console.log(erros.length ? '\nPROBLEMAS:\n' + erros.join('\n') : '\nTudo certo, nenhum erro no console.');
})().catch(e => { console.error('ERRO', String(e).split('\n')[0]); process.exit(1); });
