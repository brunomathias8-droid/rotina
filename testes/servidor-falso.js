// Simula o Apps Script (planilha em memória) e serve o app. Uso: node servidor-falso.js [pasta do app] [porta]
const fs = require('fs'), path = require('path'), http = require('http'), vm = require('vm'), crypto = require('crypto');
const RAIZ = path.resolve(process.argv[2] || path.join(__dirname, '..')), PORTA = +process.argv[3] || 8787;

/* ---------- planilha ---------- */
class Range {
  constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr: nr || 1, nc: nc || 1 }); }
  getValues() { const out = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) { const v = (this.sh.d[this.r - 1 + i] || [])[this.c - 1 + j]; row.push(v === undefined ? '' : v); } out.push(row); } return out; }
  setValues(v) { v.forEach((row, i) => row.forEach((x, j) => { const R = this.r - 1 + i; this.sh.d[R] = this.sh.d[R] || []; this.sh.d[R][this.c - 1 + j] = x; })); return this; }
  setValue(x) { return this.setValues([[x]]); }
  setNumberFormat() { return this; } setFontWeight() { return this; }
}
class Sheet {
  constructor(nome) { this.nome = nome; this.d = []; }
  getRange(r, c, nr, nc) { return new Range(this, r, c, nr, nc); }
  getLastRow() { let n = this.d.length; while (n > 0 && !(this.d[n - 1] || []).some(x => x !== '' && x !== undefined)) n--; return n; }
  getMaxRows() { return 1000; } setFrozenRows() { }
  getLastColumn() { const r = this.d[0] || []; let n = r.length; while (n > 0 && (r[n - 1] === '' || r[n - 1] === undefined)) n--; return n; }
  appendRow(v) { this.d[this.getLastRow()] = v.slice(); }
  getName() { return this.nome; }
}
const planilha = { abas: { 'Página1': new Sheet('Página1') },
  getSheetByName(n) { return this.abas[n] || null; }, insertSheet(n) { return this.abas[n] = new Sheet(n); },
  getSheets() { return Object.values(this.abas); }, deleteSheet(s) { delete this.abas[s.nome]; }, getId() { return 'PLANILHA1'; } };

/* ---------- serviços do Apps Script ---------- */
const props = {}, cache = {};
const pad = n => String(n).padStart(2, '0');
const ctx = {
  console, Date, JSON, Math, Object, Array, String, Number, Error, isFinite, RegExp, parseFloat, parseInt,
  SpreadsheetApp: { getActiveSpreadsheet: () => planilha, openById: () => planilha },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; }, getProperties: () => ({ ...props }), deleteProperty: k => { delete props[k]; } }) },
  CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
  LockService: { getScriptLock: () => ({ waitLock() { }, releaseLock() { } }) },
  Logger: { log: m => console.log('[gs]', m) },
  ContentService: { MimeType: { JSON: 'json', ICAL: 'ical' }, createTextOutput: t => ({ t, setMimeType(m) { this.mime = m; return this; } }) },
  Utilities: {
    DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
    computeDigest: (a, s) => [...crypto.createHash('sha256').update(String(s), 'utf8').digest()].map(b => b > 127 ? b - 256 : b),
    getUuid: () => crypto.randomUUID(),
    base64Decode: t => [...Buffer.from(t, 'base64')].map(b => b > 127 ? b - 256 : b),
    base64Encode: bytes => Buffer.from(bytes.map(b => b & 255)).toString('base64'),
    newBlob: (bytes, mime, nome) => ({ bytes, mime, nome, getBytes: () => bytes, getContentType: () => mime, getName: () => nome }),
    formatDate: (d, tz, f) => {
      const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
      if (f === 'yyyy-MM-dd') return `${p.year}-${p.month}-${p.day}`;
      if (f === 'H') return String(+p.hour);
      if (f === 'HH:mm') return `${p.hour}:${p.minute}`;
      throw new Error('formato ' + f);
    }
  },
  DriveApp: {
    _f: {}, _n: 0, _pastas: {},
    createFolder(nome) { const id = 'PASTA' + (++this._n); const self = this; const p = { id, nome, getId: () => id, isTrashed: () => false, setDescription() { return p; },
      createFile(b) { const fid = 'ARQ' + (++self._n) + 'x' + Math.random().toString(36).slice(2, 8); const f = { id: fid, b, lixo: false, getId: () => fid, getName: () => b.nome, getBlob: () => b, setDescription() { return f; }, setTrashed(v) { f.lixo = v; } }; self._f[fid] = f; return f; } };
      this._pastas[id] = p; return p; },
    getFolderById(id) { const p = this._pastas[id]; if (!p) throw new Error('não achou'); return p; },
    getFileById(id) { const f = this._f[id]; if (!f) throw new Error('não achou'); return f; }
  },
  ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyHours: () => ({ create() { } }), everyMinutes: () => ({ create() { } }) }) }) },
  UrlFetchApp: { fetch: (url, o) => urlFalsa(url, o || {}) }
};
/* ---------- serviços de fora: Anthropic (Luar), Telegram e Banco Central ---------- */
const externo = { anthropic: [], telegram: [], updates: [] };
const resposta = (cod, obj) => ({ getResponseCode: () => cod, getContentText: () => JSON.stringify(obj) });
function urlFalsa(url, o) {
  if (url.startsWith('https://api.anthropic.com/')) {
    const corpo = JSON.parse(o.payload); externo.anthropic.push(corpo);
    if (o.headers['x-api-key'] !== 'chave-teste') return resposta(401, { error: { message: 'chave inválida' } });
    const ult = corpo.messages[corpo.messages.length - 1], txt = typeof ult.content === 'string' ? ult.content : '';
    const uso = { input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 2000 };
    if (Array.isArray(ult.content) && ult.content[0].type === 'tool_result') return resposta(200, { stop_reason: 'end_turn', usage: uso, content: [{ type: 'text', text: 'Teto do delivery definido. ' + ult.content[0].content }] });
    if (/Turno da tarde/.test(txt)) return resposta(200, { stop_reason: 'end_turn', usage: uso, content: [{ type: 'text', text: 'PULAR' }] });
    if (/\[Sistema do Rotina\]/.test(txt)) return resposta(200, { stop_reason: 'end_turn', usage: uso, content: [{ type: 'text', text: 'Bom dia, casa. *Delivery* já passou do teto. Hoje: zero pedido.' }] });
    if (/^\[[^\]]+\] .*teto/i.test(txt)) return resposta(200, { stop_reason: 'tool_use', usage: uso, content: [{ type: 'thinking', thinking: '', signature: 'x' }, { type: 'tool_use', id: 'tu1', name: 'definir_teto', input: { categoria: 'delivery', reais: 800 } }] });
    const temDados = corpo.system.some(b => /DADOS DA CASA/.test(b.text));
    return resposta(200, { stop_reason: 'end_turn', usage: uso, content: [{ type: 'text', text: 'Luar responde: ' + txt.replace(/^\[[^\]]+\] /, '').slice(0, 80) + (temDados ? ' (li os dados)' : '') }] });
  }
  if (url.startsWith('https://api.telegram.org/')) {
    const metodo = url.split('/').pop(), d = o.payload ? JSON.parse(o.payload) : {};
    if (metodo === 'getMe') return resposta(200, { ok: true, result: { username: 'luar_teste_bot' } });
    if (metodo === 'getUpdates') { const u = externo.updates.filter(x => x.update_id >= (d.offset || 0)); externo.updates = []; return resposta(200, { ok: true, result: u }); }
    if (metodo === 'sendMessage') externo.telegram.push(d);
    return resposta(200, { ok: true, result: {} });
  }
  if (url.startsWith('https://api.pluggy.ai/')) {
    const u = new URL(url); externo.pluggy = (externo.pluggy || []).concat(u.pathname + u.search);
    if (u.pathname === '/auth') return resposta(200, { apiKey: 'chave-pluggy' });
    if ((o.headers || {})['X-API-KEY'] !== 'chave-pluggy') return resposta(403, {});
    if (u.pathname.startsWith('/items/')) return resposta(200, { id: 'item1', connector: { name: 'Banco Teste' } });
    if (u.pathname === '/accounts') return resposta(200, { results: [{ id: 'conta1', type: 'BANK', name: 'Conta corrente', balance: 1234.5 }, { id: 'cart1', type: 'CREDIT', name: 'Black', balance: 500, creditData: { creditLimit: 10000, availableCreditLimit: 9500 } }] });
    if (u.pathname === '/transactions') return resposta(410, { message: 'This endpoint is deprecated.' });
    if (u.pathname === '/v2/transactions') {
      const d = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); // dia de hoje em Fortaleza
      if (u.searchParams.get('accountId') === 'cart1') return resposta(200, { next: null, results: [
        { id: 'c-1', date: d + 'T10:00:00Z', description: 'NETFLIX.COM', amount: 55.9, type: 'DEBIT' },
        { id: 'c-2', date: d + 'T10:00:00Z', description: 'LOJA DEZENOVE', amount: 120, type: 'DEBIT', creditCardMetadata: { installmentNumber: 2, totalInstallments: 3 } },
        { id: 'c-3', date: d + 'T10:00:00Z', description: 'PAGAMENTO RECEBIDO', amount: -300, type: 'CREDIT' },
        { id: 'c-4', date: d + 'T10:00:00Z', description: 'XYZ DESCONHECIDA LTDA', amount: 42, type: 'DEBIT' },
        { id: 'c-6', date: d.slice(0, 8) + '01T10:00:00Z', description: 'PEDAGIO PENDENTE', amount: 3.7, type: 'DEBIT', status: 'PENDING' },
        externo.postada ? { id: 'c-5b', date: d + 'T10:00:00Z', description: 'COMPRA PENDENTE', amount: 10, type: 'DEBIT', status: 'POSTED' } : { id: 'c-5', date: d + 'T10:00:00Z', description: 'COMPRA PENDENTE', amount: 10, type: 'DEBIT', status: 'PENDING' }] });
      if (u.searchParams.get('after') === 'CUR2') return resposta(200, { next: null, results: [{ id: 'tx4', date: d + 'T13:00:00Z', description: 'PAGAMENTO FATURA CARTAO', amount: -300, type: 'DEBIT' },
        { id: 'tx5', date: d + 'T13:00:00Z', description: 'Pix enviado para Locador Dezenove', amount: -1180, type: 'DEBIT', category: 'Transfer - PIX' },
        { id: 'tx6', date: d + 'T13:00:00Z', description: 'Pix recebido de ANA SILVA SOUZA', amount: 300, type: 'CREDIT', category: 'Transfer - PIX' },
        { id: 'tx7', date: d + 'T13:00:00Z', description: 'Pix recebido de FULANO', amount: 500, type: 'CREDIT', category: 'Same person transfer' }] });
      if (u.searchParams.get('after') === 'CUR1') return resposta(200, { results: [{ id: 'tx3', date: d + 'T12:00:00Z', description: 'SALARIO TESTE', amount: 5000, type: 'CREDIT' }], next: '?after=CUR2' });
      return resposta(200, { results: [{ id: 'tx1', date: d + 'T10:00:00Z', description: 'IFOOD TESTE', amount: -89.9, type: 'DEBIT', category: 'Food delivery' },
        { id: 'tx2', date: d + 'T11:00:00Z', description: 'MERCADO TESTE', amount: -250, type: 'DEBIT', category: 'Groceries' }], next: '?accountId=conta1&dateFrom=x&after=CUR1' });
    }
    return resposta(404, {});
  }
  if (url.startsWith('https://api.bcb.gov.br/')) return resposta(200, [{ data: '17/11/2026', valor: '10.50' }]);
  return resposta(404, {});
}
vm.createContext(ctx);
for (const f of ['Nucleo', 'Dados', 'Api', 'Push', 'Luar', 'Telegram', 'Banco']) vm.runInContext(fs.readFileSync(path.join(RAIZ, 'servidor', f + '.gs'), 'utf8'), ctx, { filename: f + '.gs' });
ctx.configurar();
const convite = vm.runInContext('cfg_().convite', ctx);
fs.writeFileSync(path.join(__dirname, 'convite.txt'), convite);

/* ---------- HTTP ---------- */
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/exec')) {
    let b = ''; req.on('data', c => b += c); req.on('end', () => {
      vm.runInContext('_cache = {}; _cfg = null; _cabs = {};', ctx); // cada pedido é uma execução nova no Apps Script
      const out = ctx.doPost({ postData: { contents: b } });
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(out.t);
    });
    return;
  }
  if (req.url.startsWith('/__avisos')) {
    const q = new URL(req.url, 'http://x').searchParams;
    vm.runInContext(`_cache = {}; _cfg = null; var _enviados = [];
      horaAgora_ = function () { return ${+q.get('hora')}; };
      hoje_ = function () { return '${q.get('dia')}'; };
      pushStatus_ = function () { return { ativo: true, falta: [] }; };
      pushAparelhos_ = function (p, tipo) { return ['tok-' + p + '-' + tipo]; };
      pushEnviar_ = function (tok, msg) { _enviados.push(tok.replace(/^tok-/, '').replace(/-[a-z]+$/, function (t) { return ' [' + t.slice(1) + ']'; }) + ' → ' + msg.titulo + ' | ' + msg.corpo); return { ok: true }; };
      verificarAvisos();`, ctx);
    const nomes = Object.fromEntries(vm.runInContext('ler_("Pessoas").map(function (p) { return [p.ID, p.Nome]; })', ctx));
    let out = vm.runInContext('_enviados', ctx).map(l => l.replace(/^P\w+/, id => nomes[id] || id));
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(out.join('\n') || '(nada enviado)'); return;
  }
  if (req.url.startsWith('/__agenda')) {
    const q = new URL(req.url, 'http://x').searchParams;
    vm.runInContext(`_cache = {}; _cfg = null; var _enviados = [];
      PropertiesService.getScriptProperties().setProperty('AGENDA_ULTIMA', '${q.get('ultima')}');
      pushStatus_ = function () { return { ativo: true, falta: [] }; };
      pushAparelhos_ = function (p, tipo) { return ['tok-' + p + '-' + tipo]; };
      pushEnviar_ = function (tok, msg) { _enviados.push(tok.replace(/^tok-/, '').replace(/-[a-z]+$/, function (t) { return ' [' + t.slice(1) + ']'; }) + ' → ' + msg.titulo + ' | ' + msg.corpo); return { ok: true }; };
      verificarAgenda('${q.get('agora')}');`, ctx);
    const nomes = Object.fromEntries(vm.runInContext('ler_("Pessoas").map(function (p) { return [p.ID, p.Nome]; })', ctx));
    const out = vm.runInContext('_enviados', ctx).map(l => l.replace(/^P\w+/, id => nomes[id] || id));
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(out.join('\n') || '(nada enviado)'); return;
  }
  if (req.url.startsWith('/__luar')) {
    // ?chave=1 liga a Luar; ?telegram=1 liga o bot; ?turno=1&hora=8&dia=... roda o turno; ?tg=CHAT&texto=... simula mensagem no Telegram
    const q = new URL(req.url, 'http://x').searchParams;
    if (q.get('chave')) vm.runInContext(`PropertiesService.getScriptProperties().setProperty('ANTHROPIC_API_KEY', 'chave-teste')`, ctx);
    if (q.get('postada')) externo.postada = true;
    if (q.get('mapa')) vm.runInContext(`_cache = {}; _cfg = null; comLock_(function () { cfgSet_('banco_mapa', ${JSON.stringify(q.get('mapa'))}); cfgSet_('banco_desde', '2020-01-01'); return bancoLancar_(); })`, ctx);
    if (q.get('banco')) vm.runInContext(`var _p = PropertiesService.getScriptProperties(); _p.setProperty('PLUGGY_CLIENT_ID', 'id'); _p.setProperty('PLUGGY_CLIENT_SECRET', 's'); _p.setProperty('PLUGGY_ITENS', 'item1')`, ctx);
    if (q.get('telegram')) vm.runInContext(`PropertiesService.getScriptProperties().setProperty('TELEGRAM_TOKEN', '123:abc')`, ctx);
    let enviados = [];
    if (q.get('turno')) {
      vm.runInContext(`_cache = {}; _cfg = null; var _enviados = [];
        horaAgora_ = function () { return ${+q.get('hora')}; };
        hoje_ = function () { return '${q.get('dia')}'; };
        pushStatus_ = function () { return { ativo: true, falta: [] }; };
        pushAparelhos_ = function (p, tipo) { return ['tok-' + p + '-' + tipo]; };
        pushEnviar_ = function (tok, msg) { _enviados.push(tok.replace(/^tok-/, '').replace(/-[a-z]+$/, function (t) { return ' [' + t.slice(1) + ']'; }) + ' → ' + msg.titulo + ' | ' + msg.corpo); return { ok: true }; };
        luarTurno();`, ctx);
      enviados = vm.runInContext('_enviados', ctx);
    }
    if (q.get('tg')) {
      externo.updates.push({ update_id: Date.now(), message: { chat: { id: +q.get('tg'), type: 'private' }, text: q.get('texto') } });
      vm.runInContext('_cache = {}; _cfg = null; _cabs = {}; telegramVerificar();', ctx);
    }
    const nomes = Object.fromEntries(vm.runInContext('ler_("Pessoas").map(function (p) { return [p.ID, p.Nome]; })', ctx));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ push: enviados.map(l => l.replace(/^P\w+/, id => nomes[id] || id)), telegram: externo.telegram.splice(0), anthropic: externo.anthropic.splice(0).map(c => ({ model: c.model, effort: c.output_config && c.output_config.effort, tools: (c.tools || []).length, fallbacks: c.fallbacks, sys: c.system.map(b => b.text.length), ultima: JSON.stringify(c.messages[c.messages.length - 1]).slice(0, 300), papeis: c.messages.map(m => m.role).join(',') })),
      categorias: vm.runInContext('categorias_()', ctx).filter(c => c.orc), caderno: vm.runInContext('luarCaderno_()', ctx), pluggy: (externo.pluggy || []).splice(0), contexto: q.get('contexto') ? vm.runInContext('_cache = {}; luarContexto_()', ctx) : '' }));
    return;
  }
  if (req.url.startsWith('/__legado')) {
    // simula uma planilha da versão 2: afazeres e pendências que precisam virar tarefas
    vm.runInContext(`(function () { var p = ler_('Pessoas')[0].ID, t = String(Date.now());
      cfgSet_('tarefas_migradas', '');
      inserir_('Afazeres', { ID: 'legadoAfazer1', Nome: 'Lavar o carro', Icone: '🚗', Freq: 'semana', Dias: '6', Resp: 'rodizio', Vez: p, Prox: '2026-10-10', Peso: '3', CriadoPor: p, CriadoEm: new Date().toISOString(), Atualizado: t });
      inserir_('Pendencias', { ID: 'legadoPend001', Titulo: 'Pagar IPVA', Resp: 'ambos', Prazo: '2026-10-20', Alta: 'sim', Repete: 'ano', CriadoPor: p, CriadoEm: new Date().toISOString(), Atualizado: t });
    })()`, ctx);
    res.writeHead(200); res.end('ok'); return;
  }
  if (req.url.startsWith('/__drive')) { const D = ctx.DriveApp; res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(Object.values(D._f).map(f => ({ id: f.id, nome: f.b.nome, mime: f.b.mime, tam: f.b.bytes.length, lixo: f.lixo })))); return; }
  if (req.url.startsWith('/__planilha')) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(Object.fromEntries(Object.entries(planilha.abas).map(([k, s]) => [k, s.d])))); return; }
  if (req.method === 'GET' && req.url.startsWith('/exec')) {
    const q = Object.fromEntries(new URL(req.url, 'http://x').searchParams);
    vm.runInContext('_cache = {}; _cfg = null; _cabs = {};', ctx);
    const out = ctx.doGet({ parameter: q });
    res.writeHead(200, { 'Content-Type': out.mime === 'ical' ? 'text/calendar' : 'text/plain' }); res.end(out.t); return;
  }
  let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
  if (u === '/config.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end("window.ROTINA_CONFIG = { api: '/exec', intervaloSincSeg: 3 };"); return; }
  const f = path.join(RAIZ, u);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
}).listen(PORTA, () => console.log('no ar', PORTA, 'convite', convite));
