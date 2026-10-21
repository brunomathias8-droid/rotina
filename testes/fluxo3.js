// Versão 3: Tarefas unificadas + Agenda. Duas pessoas no celular.
const { chromium } = require('playwright');
const fs = require('fs');
const URL = 'http://localhost:8787/', DIR = __dirname + '/fotos3/';
fs.mkdirSync(DIR, { recursive: true });
const convite = fs.readFileSync(__dirname + '/convite.txt', 'utf8');
const erros = [], paginas = [];
const espera = ms => new Promise(r => setTimeout(r, ms));
let n = 0;
async function foto(p, nome) { await espera(250); await p.screenshot({ path: DIR + String(++n).padStart(2, '0') + '-' + nome + '.png' }); }
function ok(c, m) { if (!c) { erros.push('FALHOU: ' + m); console.log('  ✗', m); } else console.log('  ✓', m); }
async function pessoa(b, nome, tema) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: tema || 'light', locale: 'pt-BR', timezoneId: 'America/Fortaleza', acceptDownloads: true });
  const p = await c.newPage(); paginas.push(p);
  p.on('pageerror', e => erros.push(`[${nome}] pageerror ${e.message}`));
  p.on('console', m => { if (m.type() === 'error') erros.push(`[${nome}] console ${m.text()}`); });
  p.on('dialog', d => d.accept());
  return p;
}
const aba = async (p, nome) => { await p.locator('nav button', { hasText: nome }).click(); await espera(150); };
const filaVazia = p => p.waitForFunction(() => S.fila.length === 0, null, { timeout: 15000 });
const sinc = async p => { await p.evaluate(() => sincronizar()); await espera(500); };

(async () => {
  const b = await chromium.launch();
  const bruno = await pessoa(b, 'Bruno');
  await bruno.goto(URL);
  console.log('1. Cadastro');
  await bruno.click('text=Primeiro acesso');
  await bruno.fill('#lconvite', convite); await bruno.fill('#lnome', 'Bruno'); await bruno.fill('#lpin', '1234');
  await bruno.click('button[type=submit]'); await bruno.waitForSelector('nav button');
  ok((await bruno.locator('nav').innerText()).replace(/\s+/g, ' ').includes('Hoje Agenda Tarefas Finanças Compras'), 'menu: Hoje, Agenda, Tarefas, Finanças, Compras');
  await foto(bruno, 'hoje-vazio');
  const H = await bruno.evaluate(() => hoje());

  console.log('2. Migração da versão 2 (afazeres e pendências viram tarefas)');
  await fetch(URL + '__legado');
  await bruno.evaluate(() => sincronizar(true)); await espera(600);
  const mig = await bruno.evaluate(() => [S.d.tarefas.get('legadoAfazer1'), S.d.tarefas.get('legadoPend001')].map(t => t && [t.titulo, t.freq, t.resp, t.prox, t.alta]));
  ok(mig[0] && mig[0][0] === 'Lavar o carro' && mig[0][1] === 'semana' && mig[0][2] === 'rodizio', 'afazer antigo virou tarefa que repete, revezando ' + JSON.stringify(mig[0]));
  ok(mig[1] && mig[1][0] === 'Pagar IPVA' && mig[1][1] === 'ano' && mig[1][4] === true, 'pendência antiga virou tarefa anual importante ' + JSON.stringify(mig[1]));

  console.log('3. Tarefas: rotina da casa, tarefa única, concluir, pular');
  await aba(bruno, 'Tarefas');
  await bruno.click('button.chip[data-v="casa"]');
  await bruno.click('button.chip:has-text("Lavar a louça")');
  await bruno.click('button.chip:has-text("Tirar o lixo")');
  await bruno.click('button.chip[data-v="todas"]');
  await bruno.fill('#tartxt', 'Marcar revisão do carro'); await bruno.press('#tartxt', 'Enter');
  await filaVazia(bruno);
  ok(await bruno.evaluate(() => lista('tarefas').length) === 5, 'cinco tarefas (2 migradas, 2 da rotina, 1 rápida)');
  await foto(bruno, 'tarefas');
  const louca = await bruno.evaluate(() => tarefas().find(t => t.titulo === 'Lavar a louça'));
  await bruno.click(`button[data-a="concluir"][data-id="${louca.id}"]`);
  await filaVazia(bruno);
  ok(await bruno.evaluate(id => S.d.tarefas.get(id).prox, louca.id) > louca.prox, 'louça concluída: próxima data andou');
  const rapida = await bruno.evaluate(() => tarefas().find(t => t.titulo === 'Marcar revisão do carro').id);
  await bruno.click(`button.main[data-id="${rapida}"]`);
  await bruno.click('.sheet button.chip[data-k="prox"]:has-text("Amanhã")');
  await bruno.fill('#f-novoItem', 'Ligar na concessionária'); await bruno.click('button[data-a="addPasso"]');
  await bruno.click('.sheet button.chip[data-k="area"][data-v="carro"]');
  await foto(bruno, 'editar-tarefa');
  await bruno.click('button[data-a="salvarTarefa"]'); await filaVazia(bruno);
  await bruno.click(`button[data-a="concluir"][data-id="${rapida}"]`); await filaVazia(bruno);
  ok(await bruno.evaluate(id => S.d.tarefas.get(id).feita, rapida), 'tarefa única concluída fica como feita');
  await bruno.click('details summary'); await bruno.click(`button[data-a="reabrir"][data-id="${rapida}"]`); await filaVazia(bruno);
  ok(await bruno.evaluate(id => !S.d.tarefas.get(id).feita, rapida), 'reabrir desfaz a conclusão');
  const carro = 'legadoAfazer1';
  await bruno.click(`button.main[data-id="${carro}"]`);
  await bruno.click('button[data-a="pular"]'); await filaVazia(bruno);
  ok(await bruno.evaluate(() => { const x = S.d.tarefas.get('legadoAfazer1').prox; return x > '2026-10-10' && N_dataObj(x).getDay() === 6; }), 'pular a lavagem do carro de sábado leva para um sábado seguinte');

  console.log('4. Ana entra; revezamento e troca');
  const ana = await pessoa(b, 'Ana', 'dark');
  await ana.goto(URL + '#convite=' + convite);
  await ana.fill('#lnome', 'Ana'); await ana.fill('#lpin', '4321'); await ana.click('button[type=submit]'); await ana.waitForSelector('nav button');
  await sinc(bruno);
  const anaId = await ana.evaluate(() => S.eu), brunoId = await bruno.evaluate(() => S.eu);
  ok(await bruno.evaluate(id => S.d.tarefas.get(id).vez, louca.id) === brunoId, 'com o Bruno sozinho, a vez da louça continuava com ele');
  const louca2 = await bruno.evaluate(id => S.d.tarefas.get(id), louca.id);
  await bruno.evaluate(([id, prox]) => enfileirar('concluir', { id, feito: uidNovo(), prox, dia: hoje() }), [louca.id, louca2.prox]); await filaVazia(bruno);
  ok(await bruno.evaluate(id => S.d.tarefas.get(id).vez, louca.id) === anaId, 'com a Ana na casa, depois do Bruno lavar a vez passa para ela');
  const lixo = await bruno.evaluate(() => tarefas().find(t => t.titulo === 'Tirar o lixo').id);
  await aba(bruno, 'Tarefas');
  await bruno.click(`button.main[data-id="${lixo}"]`);
  await bruno.click('button:has-text("Pedir para Ana fazer")');
  await bruno.fill('#f-motivo', 'plantão'); await bruno.click('button[data-a="pedirTroca"]'); await filaVazia(bruno);
  await sinc(ana); await aba(ana, 'Hoje');
  ok((await ana.locator('#main').innerText()).includes('Bruno pediu para você fazer'), 'Ana vê o pedido de troca no Hoje');
  await ana.click(`button[data-a="troca"][data-op="aceitar"][data-id="${lixo}"]`); await filaVazia(ana);
  ok(await ana.evaluate(id => quemFaz(S.d.tarefas.get(id)) === S.eu, lixo), 'lixo fica com a Ana desta vez');

  console.log('5. Agenda: família, entrada digitada, quem leva, conversa');
  await aba(bruno, 'Agenda');
  await foto(bruno, 'agenda-vazia');
  await bruno.click('button.chip[data-k="membro"]');
  await bruno.fill('#f-nome', 'Pedro'); await bruno.click('.sheet .emojis button[data-v="🧒"]');
  await bruno.fill('#f-nasc', '2021-10-12');
  await foto(bruno, 'novo-membro');
  await bruno.click('button[data-a="salvarMembro"]'); await filaVazia(bruno);
  const pedro = await bruno.evaluate(() => perfis()[0].id);
  ok(await bruno.evaluate(() => eventos().some(e => e.titulo === 'Aniversário de Pedro' && e.repete === 'ano' && e.diaTodo)), 'aniversário do Pedro entrou sozinho na agenda, todo ano');
  await bruno.fill('#evtxt', 'pediatra do Pedro sexta 14h'); await bruno.press('#evtxt', 'Enter');
  const sexta = await bruno.evaluate(() => { const h = hoje(); return N_somaDias(h, (5 - N_dataObj(h).getDay() + 7) % 7); });
  const f = await bruno.evaluate(() => S.sheet.f);
  ok(f.titulo === 'Pediatra' && f.dia === sexta && f.ini === '14:00' && f.tipo === 'saude' && f.pessoas.length === 1 && f.pessoas[0] === pedro,
    `"pediatra do Pedro sexta 14h" vira: Pediatra · ${f.dia} · ${f.ini} · ${f.tipo} · Pedro`);
  ok(f.alertas.join() === '1440,120', 'consulta de saúde já vem com lembretes de 1 dia e 2 horas antes');
  await bruno.fill('#f-local', 'Clínica Sorriso, Rua das Flores 100');
  await foto(bruno, 'form-evento');
  await bruno.click('button[data-a="salvarEvento"]'); await filaVazia(bruno);
  const pediatra = await bruno.evaluate(() => eventos().find(e => e.titulo === 'Pediatra').id);
  await bruno.click('.seg button[data-v="lista"]');
  ok((await bruno.locator('#main').innerText()).includes('quem leva?'), 'compromisso do Pedro sem ninguém para levar aparece como "quem leva?"');
  await foto(bruno, 'agenda-lista');
  // evento que repete: futebol toda terça 19h
  await bruno.click('button[data-a="novoEvento"]');
  await bruno.fill('#f-titulo', 'Futebol'); await bruno.click('.sheet button.chip[data-k="tipo"][data-v="esporte"]');
  await bruno.fill('#f-ini', '19:00');
  await bruno.click('.sheet button.chip[data-k="repete"][data-v="semana"]');
  await bruno.click('button[data-a="salvarEvento"]'); await filaVazia(bruno);
  const fut = await bruno.evaluate(() => eventos().find(e => e.titulo === 'Futebol'));
  ok(await bruno.evaluate(() => eventosEntre(hoje(), N_somaDias(hoje(), 27)).filter(x => x.e.titulo === 'Futebol').length) === 4, 'futebol semanal aparece 4 vezes em 4 semanas');
  // Ana: vê, leva e comenta
  await sinc(ana); await aba(ana, 'Agenda');
  await ana.click(`button[data-a="sheet"][data-k="evento"][data-id="${pediatra}"]`);
  await foto(ana, 'ver-evento');
  await ana.click('button[data-a="euLevo"]'); await filaVazia(ana);
  await ana.fill('#comtxt', 'Levo o cartão do convênio'); await ana.press('#comtxt', 'Enter'); await filaVazia(ana);
  const ev = await ana.evaluate(id => S.d.eventos.get(id), pediatra);
  ok(ev.leva === anaId && ev.coments.length === 1 && ev.coments[0].t === 'Levo o cartão do convênio', 'Ana leva o Pedro e comentou no compromisso');
  await foto(ana, 'evento-com-conversa');
  await ana.click('button[data-a="close"]').catch(() => {});
  // excluir só uma ocorrência do futebol
  await sinc(bruno);
  const prox2 = await bruno.evaluate(id => eventosEntre(hoje(), N_somaDias(hoje(), 27)).filter(x => x.e.id === id)[1].dia, fut.id);
  await bruno.evaluate(([id, d]) => openSheet({ k: 'evento', id, v: d }), [fut.id, prox2]);
  await bruno.click('button[data-a="excluirEvento"][data-modo="um"]'); await filaVazia(bruno);
  ok(await bruno.evaluate(() => eventosEntre(hoje(), N_somaDias(hoje(), 27)).filter(x => x.e.titulo === 'Futebol').length) === 3, 'cancelar só um dia do futebol deixa os outros');
  // visões
  await bruno.click('.seg button[data-v="semana"]'); await foto(bruno, 'agenda-semana');
  await bruno.click('.seg button[data-v="mes"]'); await foto(bruno, 'agenda-mes');
  await bruno.click(`button.mdia[data-v="${sexta}"]`);
  ok((await bruno.locator('#main').innerText()).includes('Pediatra'), 'no mês, tocar no dia mostra os compromissos dele');
  await bruno.click('button[data-k="semana"]'); await foto(bruno, 'combinado-semana');
  ok((await bruno.locator('#layer').innerText()).includes('Próximos 7 dias') && (await bruno.locator('#layer').innerText()).includes('Pediatra'), 'combinado da semana abre com os compromissos');
  await bruno.click('button[data-a="close"]');
  // filtro por pessoa
  await bruno.click('.seg button[data-v="lista"]');
  await bruno.click(`button.chip[data-a="fpess"][data-v="${pedro}"]`);
  const so = await bruno.evaluate(() => [...document.querySelectorAll('#main .it.ev .t')].map(x => x.textContent));
  ok(so.length >= 1 && so.every(t => /Pediatra|Aniversário/.test(t)), 'filtro do Pedro mostra só os compromissos dele');
  await bruno.click(`button.chip[data-a="fpess"][data-v=""]`);
  // .ics
  await bruno.click(`button[data-a="sheet"][data-k="evento"][data-id="${pediatra}"]`);
  const [dl] = await Promise.all([bruno.waitForEvent('download'), bruno.click('button[data-a="icsEvento"]')]);
  const ics = fs.readFileSync(await dl.path(), 'utf8');
  ok(dl.suggestedFilename() === 'Pediatra.ics' && /DTSTART:\d{8}T140000/.test(ics) && ics.includes('TRIGGER:-PT120M'), 'exporta .ics com horário e lembretes');
  await bruno.click('button[data-a="close"]');
  // tarefa a partir do evento
  await bruno.click(`button[data-a="sheet"][data-k="evento"][data-id="${pediatra}"]`);
  await bruno.click('button[data-a="tarefaDoEvento"]');
  await bruno.fill('#f-titulo', 'Pegar a carteirinha do convênio'); await bruno.click('button[data-a="salvarTarefa"]'); await filaVazia(bruno);
  ok(await bruno.evaluate(() => tarefas().some(t => t.titulo === 'Pegar a carteirinha do convênio' && /Pediatra/.test(t.nota))), 'cria tarefa ligada ao compromisso');

  console.log('6. Servidor: lembretes, agenda para assinar');
  const avisos = await (await fetch(URL + `__agenda?agora=${sexta}%2012:00&ultima=${sexta}%2011:55`)).text();
  ok(/Ana \[agenda\] → Pediatra · .*14:00/.test(avisos) && !/Bruno \[agenda\]/.test(avisos), 'lembrete de 2h antes vai só para quem leva (Ana): ' + avisos.split('\n')[0]);
  const nada = await (await fetch(URL + `__agenda?agora=${sexta}%2012:05&ultima=${sexta}%2012:00`)).text();
  ok(nada === '(nada enviado)', 'não repete o lembrete na verificação seguinte');
  const tok = await bruno.evaluate(() => S.casa.ics);
  const cal = await (await fetch(URL + 'exec?agenda=' + tok)).text();
  ok(cal.includes('BEGIN:VCALENDAR') && cal.includes('SUMMARY:Pediatra (Pedro)') && cal.includes('RRULE:FREQ=WEEKLY') && cal.includes('EXDATE') && cal.includes('RRULE:FREQ=YEARLY'), 'agenda .ics para assinar: compromissos, repetições e exceções');
  ok((await (await fetch(URL + 'exec?agenda=errado')).text()).includes('inválido'), 'endereço com senha errada não mostra a agenda');

  console.log('7. Hoje, finanças e reabrir o app');
  await aba(bruno, 'Hoje'); await foto(bruno, 'hoje');
  await aba(ana, 'Hoje'); await foto(ana, 'ana-hoje-escuro');
  await aba(ana, 'Agenda'); await ana.click('.seg button[data-v="mes"]'); await foto(ana, 'ana-mes-escuro');
  await aba(bruno, 'Finanças');
  await bruno.click('button[data-a="novoLanc"][data-tipo="saida"]');
  await bruno.fill('#f-v', '45'); await bruno.fill('#f-desc', 'Farmácia'); await bruno.click('.sheet button.chip[data-k="cat"][data-v="saude"]');
  await bruno.click('button[data-a="salvarLanc"]'); await filaVazia(bruno);
  ok(await bruno.evaluate(() => resumoMes(N_mes(hoje())).desp) === 4500, 'finanças continuam funcionando');
  await bruno.click('button[data-k="perfil"]'); await foto(bruno, 'perfil');
  await bruno.click('button[data-k="assinar"]'); await foto(bruno, 'assinar');
  await bruno.click('button[data-a="close"]');
  await bruno.reload(); await bruno.waitForSelector('nav button');
  ok(await bruno.evaluate(() => eventos().length) === 3 && await bruno.evaluate(() => perfis().length) === 1, 'depois de recarregar: 3 compromissos e o Pedro');
  await b.close();
  console.log(erros.length ? '\nPROBLEMAS:\n' + erros.join('\n') : '\nTudo certo, nenhum erro no console.');
})().catch(async e => { console.error('ERRO NO TESTE', String(e).split('\n')[0]); for (const [i, p] of paginas.entries()) await p.screenshot({ path: DIR + 'erro-' + i + '.png' }).catch(() => {}); console.log(erros.join('\n')); process.exit(1); });
