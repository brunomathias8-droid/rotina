/**
 * Dados.gs — planilha, configuração e as regras de gravação do Rotina.
 * Uma planilha = uma casa. Cada aba guarda um assunto; tudo como texto puro (o Sheets não converte nada).
 *
 * Primeiro uso: rode configurar() uma vez no editor. Ela cria as abas e mostra o código de convite no registro de execução.
 */
var ABAS = {
  Config: ['Chave', 'Valor', 'Para que serve'],
  Pessoas: ['ID', 'Nome', 'PinHash', 'Cor', 'Admin', 'Ativo', 'CriadoEm', 'Atualizado'],
  Sessoes: ['ID', 'TokenHash', 'Pessoa', 'CriadoEm', 'ExpiraEmMs', 'Aparelho', 'UltimoUso', 'Ativa'],
  Afazeres: ['ID', 'Nome', 'Icone', 'Freq', 'Dias', 'N', 'DiaMes', 'Resp', 'Vez', 'Prox', 'Peso', 'Troca', 'Nota', 'CriadoPor', 'CriadoEm', 'Excluido', 'Atualizado'],
  Feitos: ['ID', 'Afazer', 'Nome', 'Pessoa', 'Dia', 'Hora', 'Peso', 'Pulou', 'Antes', 'CriadoPor', 'CriadoEm', 'Excluido', 'Atualizado'],
  Pendencias: ['ID', 'Titulo', 'Nota', 'Area', 'Resp', 'Prazo', 'Alta', 'Itens', 'Repete', 'Feita', 'FeitaPor', 'FeitaEm', 'Seguinte', 'CriadoPor', 'CriadoEm', 'Excluido', 'Atualizado'],
  Lancamentos: ['ID', 'Dia', 'Tipo', 'Valor', 'Descricao', 'Categoria', 'Forma', 'Pago', 'Carteira', 'Cartao', 'Parcela', 'Grupo', 'Conta', 'Ref', 'Destino', 'Meta', 'Nota', 'CriadoPor', 'CriadoEm', 'Excluido', 'Atualizado'],
  Contas: ['ID', 'Nome', 'Tipo', 'Valor', 'Vence', 'Categoria', 'Forma', 'Cartao', 'Carteira', 'Destino', 'Meta', 'Ativa', 'Fim', 'Nota', 'CriadoPor', 'CriadoEm', 'Excluido', 'Atualizado'],
  Cartoes: ['ID', 'Nome', 'Cor', 'Limite', 'Fecha', 'Vence', 'Carteira', 'Ativo', 'Nota', 'CriadoPor', 'CriadoEm', 'Excluido', 'Atualizado'],
  Patrimonio: ['ID', 'Nome', 'Icone', 'Natureza', 'Classe', 'Instituicao', 'Historico', 'Taxa', 'Ativo', 'Nota', 'CriadoPor', 'CriadoEm', 'Excluido', 'Atualizado'],
  Metas: ['ID', 'Nome', 'Icone', 'Tipo', 'Alvo', 'Prazo', 'Inicio', 'Itens', 'Metrica', 'Categoria', 'Base', 'Ativa', 'Nota', 'CriadoPor', 'CriadoEm', 'Excluido', 'Atualizado'],
  Compras: ['ID', 'Item', 'Qtd', 'Setor', 'Comprado', 'CompradoPor', 'CompradoEm', 'CriadoPor', 'CriadoEm', 'Excluido', 'Atualizado'],
  Push: ['Token', 'Pessoa', 'Plataforma', 'Tipos', 'CriadoEm', 'AtualizadoEm', 'Ativo', 'UltimoErro']
};

/* Categorias de quem começa. Dá para mudar tudo pelo app (Finanças › Orçamento). orc = orçamento do mês em centavos (0 = sem limite). */
var CATEGORIAS_PADRAO = [
  { id: 'moradia', nome: 'Moradia', ic: '🏠', tipo: 'saida', grupo: 'essencial', orc: 0 },
  { id: 'contas', nome: 'Contas da casa', ic: '💡', tipo: 'saida', grupo: 'essencial', orc: 0 },
  { id: 'mercado', nome: 'Mercado', ic: '🛒', tipo: 'saida', grupo: 'essencial', orc: 0 },
  { id: 'transporte', nome: 'Transporte', ic: '🚗', tipo: 'saida', grupo: 'essencial', orc: 0 },
  { id: 'saude', nome: 'Saúde', ic: '💊', tipo: 'saida', grupo: 'essencial', orc: 0 },
  { id: 'educacao', nome: 'Educação', ic: '📚', tipo: 'saida', grupo: 'essencial', orc: 0 },
  { id: 'dividas', nome: 'Dívidas e juros', ic: '🏦', tipo: 'saida', grupo: 'essencial', orc: 0 },
  { id: 'impostos', nome: 'Impostos e taxas', ic: '🧾', tipo: 'saida', grupo: 'essencial', orc: 0 },
  { id: 'delivery', nome: 'Restaurante e delivery', ic: '🍔', tipo: 'saida', grupo: 'livre', orc: 0 },
  { id: 'lazer', nome: 'Lazer e passeios', ic: '🎉', tipo: 'saida', grupo: 'livre', orc: 0 },
  { id: 'assinaturas', nome: 'Assinaturas', ic: '📺', tipo: 'saida', grupo: 'livre', orc: 0 },
  { id: 'compras', nome: 'Compras e roupas', ic: '🛍️', tipo: 'saida', grupo: 'livre', orc: 0 },
  { id: 'cuidados', nome: 'Cuidados pessoais', ic: '💇', tipo: 'saida', grupo: 'livre', orc: 0 },
  { id: 'presentes', nome: 'Presentes', ic: '🎁', tipo: 'saida', grupo: 'livre', orc: 0 },
  { id: 'viagens', nome: 'Viagens', ic: '✈️', tipo: 'saida', grupo: 'livre', orc: 0 },
  { id: 'outros', nome: 'Outros', ic: '📦', tipo: 'saida', grupo: 'livre', orc: 0 },
  { id: 'salario', nome: 'Salário', ic: '💰', tipo: 'entrada', orc: 0 },
  { id: 'extra', nome: 'Renda extra', ic: '✨', tipo: 'entrada', orc: 0 },
  { id: 'rendimentos', nome: 'Rendimentos', ic: '📈', tipo: 'entrada', orc: 0 },
  { id: 'reembolso', nome: 'Reembolsos', ic: '↩️', tipo: 'entrada', orc: 0 },
  { id: 'outrasent', nome: 'Outras entradas', ic: '💵', tipo: 'entrada', orc: 0 }
];
/* Método de orçamento: % da renda para essenciais, estilo de vida e futuro (investimentos e metas). Padrão 50/30/20. */
var METODO_PADRAO = { essencial: 50, livre: 30, futuro: 20 };

var CONFIG_PADRAO = [
  ['nome_casa', 'Nossa casa', 'Nome da casa, aparece no app'],
  ['convite', '', 'Código que a outra pessoa digita no primeiro acesso'],
  ['categorias', JSON.stringify(CATEGORIAS_PADRAO), 'Categorias e orçamento do mês. O app muda isto em Finanças › Orçamento'],
  ['metodo', JSON.stringify(METODO_PADRAO), 'Divisão da renda (essenciais / estilo de vida / futuro). O app muda isto em Finanças › Orçamento'],
  ['fuso', 'America/Fortaleza', 'Fuso horário da casa'],
  ['hora_avisos', '8', 'Hora dos avisos da manhã (afazeres do dia, pendências e contas)'],
  ['dias_sessao', '180', 'Quantos dias o login vale no aparelho'],
  ['max_pessoas', '2', 'Quantas pessoas podem entrar na casa'],
  ['firebase_web_config', '', 'Notificações: bloco firebaseConfig do console do Firebase (pode ser o mesmo projeto do RM)'],
  ['firebase_vapid_key', '', 'Notificações: chave "Web Push certificates" do Cloud Messaging'],
  ['firebase_service_account', '', 'Notificações: conteúdo do JSON da conta de serviço. Vai para as Propriedades do script e a célula é limpa']
];

/* ------------------------------ planilha ------------------------------ */
var _ss = null, _cfg = null, _cache = {};
function ss_() {
  if (_ss) return _ss;
  var id = PropertiesService.getScriptProperties().getProperty('PLANILHA');
  _ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!_ss) throw apiErro_('Planilha não encontrada. Crie o Apps Script a partir da planilha (Extensões › Apps Script).', 'SETUP');
  return _ss;
}
function aba_(nome) {
  var sh = ss_().getSheetByName(nome), cab = ABAS[nome];
  if (!sh) {
    sh = ss_().insertSheet(nome);
    sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), cab.length).setNumberFormat('@');
  }
  return sh;
}
/**
 * Colunas da aba como estão na planilha. As colunas são achadas pelo nome do cabeçalho;
 * uma coluna nova de uma versão futura é acrescentada no fim, sem mexer nos dados que já existem.
 */
var _cabs = {};
function cab_(nome) {
  if (_cabs[nome]) return _cabs[nome];
  var sh = aba_(nome), n = Math.max(sh.getLastColumn(), 1);
  var atual = sh.getRange(1, 1, 1, n).getValues()[0].map(function (x) { return String(x).trim(); });
  while (atual.length && !atual[atual.length - 1]) atual.pop();
  var falta = ABAS[nome].filter(function (c) { return atual.indexOf(c) < 0; });
  if (falta.length) {
    sh.getRange(1, atual.length + 1, 1, falta.length).setValues([falta]).setFontWeight('bold');
    sh.getRange(1, atual.length + 1, sh.getMaxRows(), falta.length).setNumberFormat('@');
    atual = atual.concat(falta);
  }
  _cabs[nome] = atual;
  return atual;
}
/** Lê a aba inteira como objetos. Cada objeto ganha _lin (número da linha na planilha). */
function ler_(nome) {
  if (_cache[nome]) return _cache[nome];
  var sh = aba_(nome), cab = cab_(nome), n = sh.getLastRow() - 1, out = [];
  if (n > 0) sh.getRange(2, 1, n, cab.length).getValues().forEach(function (v, i) {
    var o = { _lin: i + 2 };
    cab.forEach(function (c, j) { if (c) o[c] = v[j] === null || v[j] === undefined ? '' : String(v[j]); });
    out.push(o);
  });
  _cache[nome] = out;
  return out;
}
function texto_(v) { return v === undefined || v === null ? '' : String(v); }
function inserir_(nome, o) {
  var sh = aba_(nome), cab = cab_(nome), lin = sh.getLastRow() + 1;
  sh.getRange(lin, 1, 1, cab.length).setNumberFormat('@').setValues([cab.map(function (c) { return texto_(o[c]); })]);
  if (_cache[nome]) { var c = { _lin: lin }; cab.forEach(function (k) { if (k) c[k] = texto_(o[k]); }); _cache[nome].push(c); }
  return lin;
}
function atualizar_(nome, lin, campos) {
  var sh = aba_(nome), cab = cab_(nome), atual = sh.getRange(lin, 1, 1, cab.length).getValues()[0];
  var novo = cab.map(function (c, j) { return c && Object.prototype.hasOwnProperty.call(campos, c) ? texto_(campos[c]) : texto_(atual[j]); });
  sh.getRange(lin, 1, 1, cab.length).setValues([novo]);
  if (_cache[nome]) _cache[nome].forEach(function (o) { if (o._lin === lin) cab.forEach(function (c, j) { if (c) o[c] = novo[j]; }); });
}
function comLock_(fn) {
  var lock = LockService.getScriptLock(); lock.waitLock(25000);
  try { _cache = {}; return fn(); } finally { lock.releaseLock(); }
}
function json_(t, padrao) { try { return t ? JSON.parse(t) : padrao; } catch (e) { return padrao; } }
function porId_(aba, id) { return ler_(aba).filter(function (r) { return r.ID === id; })[0] || null; }

/* ------------------------------ configuração ------------------------------ */
function cfg_() {
  if (_cfg) return _cfg;
  var o = {}, sh = aba_('Config'), n = sh.getLastRow() - 1;
  if (n > 0) sh.getRange(2, 1, n, 2).getValues().forEach(function (v) { if (v[0]) o[String(v[0]).trim()] = String(v[1]).trim(); });
  _cfg = o;
  return o;
}
function cfgSet_(chave, valor) {
  var sh = aba_('Config'), n = sh.getLastRow() - 1, v = n > 0 ? sh.getRange(2, 1, n, 1).getValues() : [];
  for (var i = 0; i < v.length; i++) if (String(v[i][0]).trim() === chave) { sh.getRange(i + 2, 2).setNumberFormat('@').setValue(String(valor)); _cfg = null; return; }
  sh.appendRow([chave, String(valor), '']); _cfg = null;
}
function fuso_() { return cfg_().fuso || 'America/Fortaleza'; }
function hoje_() { return Utilities.formatDate(new Date(), fuso_(), 'yyyy-MM-dd'); }
function horaAgora_() { return Number(Utilities.formatDate(new Date(), fuso_(), 'H')); }
function categorias_() { var c = json_(cfg_().categorias, null); return Array.isArray(c) && c.length ? c : CATEGORIAS_PADRAO; }
function metodo_() { var m = json_(cfg_().metodo, null); return m && m.essencial >= 0 ? m : METODO_PADRAO; }

function casaPublica_() {
  var c = cfg_();
  return { nome: c.nome_casa || 'Nossa casa', convite: c.convite || '', categorias: categorias_(), metodo: metodo_(), fuso: fuso_(), hoje: hoje_() };
}

/** Rodar uma vez no editor do Apps Script (e de novo sem medo: não apaga nada). */
function configurar() {
  Object.keys(ABAS).forEach(aba_);
  var sh = aba_('Config'), atual = cfg_();
  CONFIG_PADRAO.forEach(function (l) {
    if (!(l[0] in atual)) { sh.appendRow([l[0], l[1], l[2]]); }
  });
  sh.getRange(1, 1, sh.getMaxRows(), 2).setNumberFormat('@');
  _cfg = null;
  if (!cfg_().convite) cfgSet_('convite', Utilities.getUuid().replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase());
  PropertiesService.getScriptProperties().setProperty('PLANILHA', ss_().getId());
  var s0 = ss_().getSheetByName('Página1') || ss_().getSheetByName('Sheet1');
  if (s0 && ss_().getSheets().length > 1 && s0.getLastRow() === 0) ss_().deleteSheet(s0);
  var msg = 'Rotina configurado. Código de convite: ' + cfg_().convite + '. Agora implante como app da web (Implantar › Nova implantação).';
  Logger.log(msg);
  return msg;
}

/* ------------------------------ pessoas ------------------------------ */
function pessoaPorId_(id) { return porId_('Pessoas', id); }
function pessoasAtivas_() {
  return ler_('Pessoas').filter(function (p) { return p.Ativo !== 'não'; }).sort(function (a, b) { return a.CriadoEm < b.CriadoEm ? -1 : 1; });
}
function idsAtivos_() { return pessoasAtivas_().map(function (p) { return p.ID; }); }
function pessoaPublica_(p) { return { id: p.ID, nome: p.Nome, cor: p.Cor || 'a', admin: p.Admin === 'sim' }; }
function nomeDe_(id) { var p = pessoaPorId_(id); return p ? p.Nome : 'Alguém'; }

/* ------------------------------ coleções ------------------------------ */
/*
 * Cada coleção do app vira uma aba. campos: chave no app → [coluna, tipo, opção].
 * Tipos: t texto (opção = tamanho máximo) · e uma das opções · d data AAAA-MM-DD · n número inteiro · x número decimal
 *        b sim/não · l lista de números · L lista de IDs · j JSON (opção = tamanho máximo)
 *        c dinheiro (centavos no app, reais com ponto na planilha) · p pessoa · r responsável (rodizio, ambos ou pessoa)
 * Toda aba tem também ID, CriadoPor, CriadoEm, Excluido e Atualizado.
 */
var TIPOS_LANC = ['saida', 'entrada', 'fatura', 'aporte', 'resgate', 'transf'];
var COLECOES = {
  afazeres: { aba: 'Afazeres', exigir: 'nome', campos: {
    nome: ['Nome', 't', 60], ic: ['Icone', 't', 16], freq: ['Freq', 'e', ['dia', 'semana', 'mes', 'cada']], dias: ['Dias', 'l'],
    n: ['N', 'n'], dm: ['DiaMes', 'n'], resp: ['Resp', 'r'], vez: ['Vez', 'p'], prox: ['Prox', 'd'], peso: ['Peso', 'n'], nota: ['Nota', 't', 300] } },
  pendencias: { aba: 'Pendencias', exigir: 'titulo', campos: {
    titulo: ['Titulo', 't', 120], nota: ['Nota', 't', 800], area: ['Area', 't', 20], resp: ['Resp', 'r'], prazo: ['Prazo', 'd'], alta: ['Alta', 'b'],
    itens: ['Itens', 'j', 4000], repete: ['Repete', 'e', ['', 'semana', 'mes', 'ano']],
    feita: ['Feita', 'b'], feitaPor: ['FeitaPor', 'p'], feitaEm: ['FeitaEm', 't', 30], seguinte: ['Seguinte', 't', 40] } },
  lancamentos: { aba: 'Lancamentos', exigir: 'dia', campos: {
    dia: ['Dia', 'd'], tipo: ['Tipo', 'e', TIPOS_LANC], v: ['Valor', 'c'], desc: ['Descricao', 't', 120], cat: ['Categoria', 't', 30],
    forma: ['Forma', 't', 20], pago: ['Pago', 'b'], carteira: ['Carteira', 't', 40], cartao: ['Cartao', 't', 40], parc: ['Parcela', 't', 9],
    grupo: ['Grupo', 't', 40], conta: ['Conta', 't', 40], ref: ['Ref', 't', 7], destino: ['Destino', 't', 40], meta: ['Meta', 't', 40], nota: ['Nota', 't', 300] } },
  contas: { aba: 'Contas', exigir: 'nome', campos: {
    nome: ['Nome', 't', 60], tipo: ['Tipo', 'e', ['saida', 'entrada', 'aporte']], v: ['Valor', 'c'], vence: ['Vence', 'n'], cat: ['Categoria', 't', 30],
    forma: ['Forma', 't', 20], cartao: ['Cartao', 't', 40], carteira: ['Carteira', 't', 40], destino: ['Destino', 't', 40], meta: ['Meta', 't', 40],
    ativa: ['Ativa', 'b'], fim: ['Fim', 't', 7], nota: ['Nota', 't', 300] } },
  cartoes: { aba: 'Cartoes', exigir: 'nome', campos: {
    nome: ['Nome', 't', 40], cor: ['Cor', 't', 10], limite: ['Limite', 'c'], fecha: ['Fecha', 'n'], vence: ['Vence', 'n'],
    carteira: ['Carteira', 't', 40], ativo: ['Ativo', 'b'], nota: ['Nota', 't', 300] } },
  patrimonio: { aba: 'Patrimonio', exigir: 'nome', campos: {
    nome: ['Nome', 't', 60], ic: ['Icone', 't', 16], nat: ['Natureza', 'e', ['ativo', 'passivo']], classe: ['Classe', 't', 20], inst: ['Instituicao', 't', 60],
    hist: ['Historico', 'j', 30000], taxa: ['Taxa', 'x'], ativo: ['Ativo', 'b'], nota: ['Nota', 't', 300] } },
  metas: { aba: 'Metas', exigir: 'nome', campos: {
    nome: ['Nome', 't', 60], ic: ['Icone', 't', 16], tipo: ['Tipo', 'e', ['juntar', 'mensal', 'reduzir']], alvo: ['Alvo', 'c'], prazo: ['Prazo', 'd'],
    inicio: ['Inicio', 'd'], itens: ['Itens', 'L'], metrica: ['Metrica', 'e', ['', 'cartao', 'cat', 'divida']], cat: ['Categoria', 't', 30],
    base: ['Base', 'c'], ativa: ['Ativa', 'b'], nota: ['Nota', 't', 300] } },
  compras: { aba: 'Compras', exigir: 'item', campos: {
    item: ['Item', 't', 80], qtd: ['Qtd', 't', 30], setor: ['Setor', 't', 20], comprado: ['Comprado', 'b'], compradoPor: ['CompradoPor', 'p'], compradoEm: ['CompradoEm', 't', 30] } },
  feitos: { aba: 'Feitos', somenteLeitura: true, campos: {
    afazer: ['Afazer', 't', 40], nome: ['Nome', 't', 60], quem: ['Pessoa', 'p'], dia: ['Dia', 'd'], hora: ['Hora', 't', 5], peso: ['Peso', 'n'], pulou: ['Pulou', 'b'] } }
};

function valorParaPlanilha_(tipo, op, v, ids) {
  if (v === undefined || v === null) v = '';
  switch (tipo) {
    case 't': return String(v).replace(/\s+/g, ' ').trim().slice(0, op);
    case 'e': return op.indexOf(String(v)) >= 0 ? String(v) : op[0];
    case 'd': return N_dataValida(v) ? String(v) : '';
    case 'n': return isFinite(Number(v)) && v !== '' ? String(Math.round(Number(v))) : '';
    case 'x': return isFinite(Number(v)) && v !== '' ? String(Number(v)) : '';
    case 'b': return v === true || v === 'sim' ? 'sim' : '';
    case 'l': return (Array.isArray(v) ? v : String(v).split(',')).filter(function (x) { return x !== '' && isFinite(Number(x)); }).map(function (x) { return Math.round(Number(x)); }).join(',');
    case 'L': return (Array.isArray(v) ? v : String(v).split(',')).map(function (x) { return String(x).replace(/[^A-Za-z0-9_-]/g, ''); }).filter(Boolean).slice(0, 40).join(',');
    case 'j': { if (v === '') return ''; var t = typeof v === 'string' ? v : JSON.stringify(v); if (t.length > op) throw apiErro_('Dados grandes demais.', 'VALIDACAO'); return t; }
    case 'c': { var c = Math.round(Number(v) || 0); if (Math.abs(c) > 1e13) throw apiErro_('Valor alto demais.', 'VALIDACAO'); return (c / 100).toFixed(2); }
    case 'p': return ids.indexOf(String(v)) >= 0 ? String(v) : '';
    case 'r': return v === 'rodizio' || v === 'ambos' || ids.indexOf(String(v)) >= 0 ? String(v) : 'ambos';
  }
  return String(v);
}
function valorParaApp_(tipo, v) {
  switch (tipo) {
    case 'n': case 'x': return v === '' ? null : Number(v);
    case 'b': return v === 'sim';
    case 'l': return v === '' ? [] : String(v).split(',').map(Number);
    case 'L': return v === '' ? [] : String(v).split(',');
    case 'j': return json_(v, null);
    case 'c': return Math.round((parseFloat(v) || 0) * 100);
  }
  return v;
}
function paraApp_(col, r) {
  var def = COLECOES[col], o = { id: r.ID, por: r.CriadoPor, em: r.CriadoEm, up: Number(r.Atualizado) || 0 };
  if (r.Excluido === 'sim') { o.excluido = true; return o; }
  Object.keys(def.campos).forEach(function (k) { var c = def.campos[k]; o[k] = valorParaApp_(c[1], r[c[0]] === undefined ? '' : r[c[0]]); });
  if (col === 'afazeres') o.troca = json_(r.Troca, null);
  if (col === 'feitos') o.antes = json_(r.Antes, null);
  return o;
}
function colecao_(nome) {
  var def = COLECOES[nome];
  if (!def || def.somenteLeitura) throw apiErro_('Coleção desconhecida.', 'VALIDACAO');
  return def;
}
function validarId_(id) {
  id = String(id || '');
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(id)) throw apiErro_('Identificador inválido.', 'VALIDACAO');
  return id;
}

/**
 * Cria ou atualiza um item. O app gera o ID, então reenviar o mesmo pedido (fila offline) não duplica nada.
 * Só os campos enviados mudam; o último a salvar vale.
 */
function salvar_(s, req) {
  var col = String(req.col || '');
  colecao_(col);
  return comLock_(function () { return { col: col, item: gravar_(s, col, req.item || {}, idsAtivos_()) }; });
}
/** Vários itens de uma vez (compra parcelada, vários itens da lista): um pedido só, uma espera só. */
function salvarLote_(s, req) {
  var col = String(req.col || ''), itens = req.itens;
  colecao_(col);
  if (!Array.isArray(itens) || !itens.length || itens.length > 72) throw apiErro_('Lote inválido.', 'VALIDACAO');
  return comLock_(function () { var ids = idsAtivos_(); return { col: col, itens: itens.map(function (it) { return gravar_(s, col, it, ids); }) }; });
}
function gravar_(s, col, item, ids) {
  var def = COLECOES[col], id = validarId_(item.id), r = porId_(def.aba, id), campos = {};
  if (r && r.Excluido === 'sim') return paraApp_(col, r);
  Object.keys(def.campos).forEach(function (k) {
    if (Object.prototype.hasOwnProperty.call(item, k)) { var c = def.campos[k]; campos[c[0]] = valorParaPlanilha_(c[1], c[2], item[k], ids); }
  });
  var antes = r ? paraApp_(col, r) : null;
  if (col === 'afazeres') ajustarAfazer_(campos, r, s);
  if (col === 'pendencias' && campos.Feita === 'sim' && !(r && r.Feita === 'sim')) { campos.FeitaPor = campos.FeitaPor || s.pessoa; campos.FeitaEm = campos.FeitaEm || new Date().toISOString(); }
  if (col === 'compras' && campos.Comprado === 'sim' && !(r && r.Comprado === 'sim')) { campos.CompradoPor = campos.CompradoPor || s.pessoa; campos.CompradoEm = campos.CompradoEm || new Date().toISOString(); }
  campos.Atualizado = String(Date.now());
  if (r) atualizar_(def.aba, r._lin, campos);
  else {
    if (!campos[def.campos[def.exigir][0]]) throw apiErro_('Preencha ' + (def.exigir === 'dia' ? 'a data' : 'o nome') + '.', 'VALIDACAO');
    campos.ID = id; campos.CriadoPor = s.pessoa; campos.CriadoEm = new Date().toISOString();
    inserir_(def.aba, campos);
  }
  var depois = paraApp_(col, porId_(def.aba, id));
  avisosDeSalvar_(s, col, antes, depois);
  return depois;
}

/** Afazer novo ou com regra mudada: garante a próxima data e de quem é a vez no rodízio. */
function ajustarAfazer_(campos, r, s) {
  var get = function (c) { return campos[c] !== undefined ? campos[c] : (r ? r[c] : ''); };
  var a = { freq: get('Freq') || 'dia', dias: get('Dias'), dm: get('DiaMes'), n: get('N') };
  if (!r && !campos.Freq) campos.Freq = 'dia';
  if (!r && !campos.Peso) campos.Peso = '2';
  if (!get('Prox')) campos.Prox = N_primeira(a, hoje_());
  if (get('Resp') === 'rodizio' && !get('Vez')) campos.Vez = s.pessoa;
  if (r && campos.Resp && campos.Resp !== r.Resp) campos.Troca = '';
}

function excluir_(s, req) {
  var col = String(req.col || '');
  colecao_(col);
  var ids = Array.isArray(req.ids) ? req.ids : [req.id];
  if (!ids.length || ids.length > 72) throw apiErro_('Lote inválido.', 'VALIDACAO');
  return comLock_(function () {
    var def = COLECOES[col], agora = String(Date.now());
    var itens = ids.map(function (x) {
      var id = validarId_(x), r = porId_(def.aba, id);
      if (!r) return { id: id, excluido: true, up: Date.now() };
      atualizar_(def.aba, r._lin, { Excluido: 'sim', Atualizado: agora });
      return paraApp_(col, porId_(def.aba, id));
    });
    return { col: col, itens: itens };
  });
}

/** Apaga de uma vez os itens já comprados da lista. */
function limparCompras_(s, req) {
  return comLock_(function () {
    var agora = String(Date.now()), itens = [];
    ler_('Compras').forEach(function (r) {
      if (r.Excluido !== 'sim' && r.Comprado === 'sim') { atualizar_('Compras', r._lin, { Excluido: 'sim', Atualizado: agora }); itens.push(paraApp_('compras', porId_('Compras', r.ID))); }
    });
    return { col: 'compras', itens: itens };
  });
}

/* ------------------------------ afazeres: feito, desfazer e troca ------------------------------ */
function afazerApp_(r) { return paraApp_('afazeres', r); }

/**
 * Marca um afazer como feito. "prox" é a data que o app via; se outra pessoa já marcou antes, nada muda.
 * "feito" é o ID do registro, gerado no app: reenviar o pedido não duplica.
 */
function concluirAfazer_(s, req) {
  var id = validarId_(req.id), fid = validarId_(req.feito);
  return comLock_(function () {
    var r = porId_('Afazeres', id);
    if (!r || r.Excluido === 'sim') throw apiErro_('Esse afazer foi excluído.', 'NAOACHOU');
    var ja = porId_('Feitos', fid);
    if (ja || (req.prox && r.Prox !== req.prox)) return { col: 'afazeres', item: afazerApp_(r), ja: true, feito: ja ? paraApp_('feitos', ja) : null };
    var h = hoje_(), dia = N_dataValida(req.dia) && req.dia <= h && req.dia >= N_somaDias(h, -7) ? req.dia : h;
    // Pular a vez (viagem, não precisou): a data anda, mas a vez continua com quem estava
    var pulou = !!req.pular, a = afazerApp_(r), prox = N_proxima(a, dia), agora = String(Date.now());
    var vez = a.resp === 'rodizio' && !pulou ? N_proximaVez(idsAtivos_(), s.pessoa) : r.Vez;
    inserir_('Feitos', { ID: fid, Afazer: id, Nome: r.Nome, Pessoa: s.pessoa, Dia: dia, Hora: Utilities.formatDate(new Date(), fuso_(), 'HH:mm'),
      Peso: r.Peso || '2', Pulou: pulou ? 'sim' : '',
      Antes: JSON.stringify({ prox: r.Prox, vez: r.Vez, troca: r.Troca, depois: prox }), CriadoPor: s.pessoa, CriadoEm: new Date().toISOString(), Excluido: '', Atualizado: agora });
    atualizar_('Afazeres', r._lin, { Prox: prox, Vez: vez, Troca: '', Atualizado: agora });
    var t = json_(r.Troca, null);
    if (!pulou && t && t.st === 'aceita' && t.de && t.de !== s.pessoa) avisarPessoa_(t.de, 'trocas', { titulo: nomeDe_(s.pessoa) + ' fez ' + r.Nome, corpo: 'A troca está cumprida.', url: '#casa', tag: 'troca-' + id });
    return { col: 'afazeres', item: afazerApp_(porId_('Afazeres', id)), feito: paraApp_('feitos', porId_('Feitos', fid)) };
  });
}

/** Desfaz um "feito" (toque sem querer). A data e a vez voltam como estavam, se ninguém mexeu no afazer depois. */
function desfazerFeito_(s, req) {
  var fid = validarId_(req.id);
  return comLock_(function () {
    var f = porId_('Feitos', fid);
    if (!f || f.Excluido === 'sim') return { col: 'feitos', item: { id: fid, excluido: true, up: Date.now() } };
    var agora = String(Date.now()), antes = json_(f.Antes, {}), r = porId_('Afazeres', f.Afazer), out = { col: 'feitos' };
    atualizar_('Feitos', f._lin, { Excluido: 'sim', Atualizado: agora });
    if (r && r.Excluido !== 'sim' && r.Prox === antes.depois) {
      atualizar_('Afazeres', r._lin, { Prox: antes.prox || r.Prox, Vez: antes.vez || '', Troca: antes.troca || '', Atualizado: agora });
      out.afazer = afazerApp_(porId_('Afazeres', f.Afazer));
    }
    out.item = paraApp_('feitos', porId_('Feitos', fid));
    return out;
  });
}

/**
 * Troca de vez num afazer: op = pedir | aceitar | recusar | cancelar.
 * Vale só para a vez atual. Quem faz no lugar do outro passa a vez de volta para ele no rodízio.
 */
function troca_(s, req) {
  var id = validarId_(req.id), op = String(req.op || '');
  return comLock_(function () {
    var r = porId_('Afazeres', id);
    if (!r || r.Excluido === 'sim') throw apiErro_('Esse afazer foi excluído.', 'NAOACHOU');
    var a = afazerApp_(r), t = a.troca, agora = String(Date.now()), novo, aviso = null;
    if (op === 'pedir') {
      var dono = N_quemFaz(a);
      if (dono && dono !== s.pessoa) throw apiErro_('Esse afazer não está com você agora.', 'VALIDACAO');
      var para = String(req.para || '') || idsAtivos_().filter(function (x) { return x !== s.pessoa; })[0];
      if (!para || para === s.pessoa || idsAtivos_().indexOf(para) < 0) throw apiErro_('Não tem com quem trocar ainda.', 'VALIDACAO');
      novo = { de: s.pessoa, para: para, st: 'pedida', motivo: String(req.motivo || '').trim().slice(0, 140), em: new Date().toISOString(), prox: r.Prox };
      aviso = [para, { titulo: nomeDe_(s.pessoa) + ' pediu uma troca', corpo: r.Nome + (novo.motivo ? ': ' + novo.motivo : '') + '. Toque para aceitar ou recusar.', url: '#hoje', tag: 'troca-' + id }];
    } else if (op === 'aceitar' || op === 'recusar') {
      if (!t || t.st !== 'pedida' || t.para !== s.pessoa) throw apiErro_('Esse pedido de troca não está mais aberto.', 'VALIDACAO');
      novo = Object.assign({}, t, { st: op === 'aceitar' ? 'aceita' : 'recusada', resp: new Date().toISOString() });
      aviso = [t.de, op === 'aceitar'
        ? { titulo: nomeDe_(s.pessoa) + ' aceitou a troca', corpo: r.Nome + ' fica com ' + nomeDe_(s.pessoa) + ' desta vez.', url: '#casa', tag: 'troca-' + id }
        : { titulo: nomeDe_(s.pessoa) + ' recusou a troca', corpo: r.Nome + ' continua com você.', url: '#casa', tag: 'troca-' + id }];
    } else if (op === 'cancelar') {
      if (!t || (t.de !== s.pessoa && t.para !== s.pessoa)) throw apiErro_('Não há troca para cancelar.', 'VALIDACAO');
      novo = null;
    } else throw apiErro_('Operação de troca desconhecida.', 'VALIDACAO');
    atualizar_('Afazeres', r._lin, { Troca: novo ? JSON.stringify(novo) : '', Atualizado: agora });
    if (aviso) avisarPessoa_(aviso[0], 'trocas', aviso[1]);
    return { col: 'afazeres', item: afazerApp_(porId_('Afazeres', id)) };
  });
}

/* ------------------------------ casa: nome e categorias ------------------------------ */
function salvarCasa_(s, req) {
  return comLock_(function () {
    if (req.nome !== undefined) {
      var n = String(req.nome || '').trim().slice(0, 40);
      if (n) cfgSet_('nome_casa', n);
    }
    if (req.categorias !== undefined) {
      if (!Array.isArray(req.categorias) || req.categorias.length > 60) throw apiErro_('Lista de categorias inválida.', 'VALIDACAO');
      var vistos = {}, cats = req.categorias.map(function (c) {
        var id = String(c.id || '').slice(0, 24);
        if (!/^[a-z0-9_-]+$/i.test(id) || vistos[id]) throw apiErro_('Categoria inválida.', 'VALIDACAO');
        vistos[id] = 1;
        var nome = String(c.nome || '').trim().slice(0, 30);
        if (!nome) throw apiErro_('Toda categoria precisa de nome.', 'VALIDACAO');
        var tipo = c.tipo === 'entrada' ? 'entrada' : 'saida', o = { id: id, nome: nome, ic: String(c.ic || '📦').slice(0, 8), tipo: tipo, orc: Math.max(0, Math.round(Number(c.orc) || 0)) };
        if (tipo === 'saida') o.grupo = c.grupo === 'essencial' ? 'essencial' : 'livre';
        return o;
      });
      cfgSet_('categorias', JSON.stringify(cats));
    }
    if (req.metodo !== undefined) {
      var m = req.metodo || {}, e = Math.round(Number(m.essencial)), l = Math.round(Number(m.livre)), f = Math.round(Number(m.futuro));
      if (!(e >= 0 && l >= 0 && f >= 0) || e + l + f !== 100) throw apiErro_('As três partes do método precisam somar 100%.', 'VALIDACAO');
      cfgSet_('metodo', JSON.stringify({ essencial: e, livre: l, futuro: f }));
    }
    return { casa: casaPublica_() };
  });
}

/* ------------------------------ sincronização ------------------------------ */
/**
 * Tudo o que mudou desde "desde" (ms), incluindo exclusões.
 * desde = 0 traz o retrato completo: lançamentos dos últimos 24 meses (e parcelas futuras), afazeres feitos nos últimos 90 dias
 * e pendências abertas ou concluídas nos últimos 60 dias. Cartões, contas, patrimônio e metas vêm sempre inteiros.
 */
function sincronizar_(s, desde) {
  var h = hoje_(), out = { agora: Date.now(), casa: casaPublica_(), pessoas: pessoasAtivas_().map(pessoaPublica_), completo: !desde };
  var janela = {
    feitos: function (r) { return r.Dia >= N_somaDias(h, -90); },
    lancamentos: function (r) { return r.Dia >= N_somaMes(N_mes(h), -24) + '-01'; },
    pendencias: function (r) { return r.Feita !== 'sim' || String(r.FeitaEm).slice(0, 10) >= N_somaDias(h, -60); }
  };
  Object.keys(COLECOES).forEach(function (col) {
    var def = COLECOES[col];
    out[col] = ler_(def.aba).filter(function (r) {
      if (desde) return Number(r.Atualizado) > desde;
      return r.Excluido !== 'sim' && (!janela[col] || janela[col](r));
    }).map(function (r) { return paraApp_(col, r); });
  });
  return out;
}
