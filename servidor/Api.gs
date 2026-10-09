/**
 * Api.gs — porta de entrada do Rotina (app no GitHub Pages).
 * O app chama sempre com POST e corpo JSON enviado como text/plain (sem pré-verificação de CORS), igual ao RM, ao Rumo e ao RACHA.
 *
 * Entrada: código de convite da casa (aba Config › convite) + nome + PIN, no primeiro acesso.
 * Login: nome + PIN. Cinco tentativas erradas bloqueiam aquele nome por 15 minutos.
 * Sessão: token aleatório de 64 caracteres; na planilha fica só o hash (aba Sessoes). Validade: Config › dias_sessao.
 */
var API_VERSAO = '1.0.0';

function doGet() {
  return ContentService.createTextOutput('Rotina · API ' + API_VERSAO + ' no ar. O app usa este endereço; não precisa abrir aqui.');
}

function doPost(e) {
  var req;
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (x) { return apiSaida_({ ok: false, erro: 'Pedido inválido.', codigo: 'JSON' }); }
  try {
    return apiSaida_({ ok: true, dados: apiRotear_(req), versao: API_VERSAO });
  } catch (err) {
    var cod = err.codigo || 'ERRO';
    if (cod === 'ERRO') apiLogErro_(req, err);
    return apiSaida_({ ok: false, erro: String(err.message || err).replace(/^Exception:\s*/, ''), codigo: cod });
  }
}

function apiRotear_(req) {
  switch (req.acao) {
    case 'ping': return { versao: API_VERSAO, hora: new Date().toISOString(), casa: cfg_().nome_casa || 'Nossa casa' };
    case 'login': return apiLogin_(req);
    case 'cadastro': return apiCadastro_(req);
  }
  var s = apiAutenticar_(req.token);
  switch (req.acao) {
    case 'sync': return sincronizar_(s, Number(req.desde) || 0);
    case 'salvar': return salvar_(s, req);
    case 'excluir': return excluir_(s, req);
    case 'concluir': return concluirAfazer_(s, req);
    case 'desfazer': return desfazerFeito_(s, req);
    case 'troca': return troca_(s, req);
    case 'limparCompras': return limparCompras_(s, req);
    case 'casa': return salvarCasa_(s, req);
    case 'trocarPin': return trocarPin_(s, req);
    case 'sair': return apiEncerrar_(s.pessoa, req.token);
    case 'pushConfig': case 'registrarPush': case 'preferenciasPush': case 'removerPush': case 'testarPush':
      return pushApi_(req.acao, s, req);
  }
  throw apiErro_('Ação desconhecida.', 'ACAO');
}

function apiSaida_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function apiErro_(msg, codigo) { var e = new Error(msg); e.codigo = codigo || 'ERRO'; return e; }
function apiHash_(t) {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(t), Utilities.Charset.UTF_8);
  return 'h' + b.map(function (x) { return ('0' + (x & 0xff).toString(16)).slice(-2); }).join('');
}
/* Comparação sem atalho (o tempo não revela quantos caracteres acertou) */
function apiIgual_(a, b) {
  a = String(a); b = String(b);
  var d = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
function normNome_(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' '); }
function pinHash_(id, pin) { return apiHash_(id + ':' + String(pin).trim()); }
function validarPin_(pin) {
  pin = String(pin || '').trim();
  if (!/^\d{4,8}$/.test(pin)) throw apiErro_('O PIN precisa ter de 4 a 8 números.', 'VALIDACAO');
  return pin;
}

function novaSessao_(pessoa, aparelho) {
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  var dias = Number(cfg_().dias_sessao) || 180, agora = new Date();
  inserir_('Sessoes', { ID: 'S' + agora.getTime(), TokenHash: apiHash_(token), Pessoa: pessoa, CriadoEm: agora.toISOString(),
    ExpiraEmMs: String(agora.getTime() + dias * 864e5), Aparelho: String(aparelho || '').slice(0, 120), UltimoUso: agora.toISOString(), Ativa: 'sim' });
  return token;
}

function bootDe_(pessoaId, token) {
  var r = sincronizar_({ pessoa: pessoaId }, 0);
  r.token = token;
  r.eu = pessoaId;
  return r;
}

function apiLogin_(req) {
  var nome = normNome_(req.nome);
  if (!nome) throw apiErro_('Digite seu nome.', 'LOGIN');
  var cache = CacheService.getScriptCache(), chave = 'rotina_tent_' + nome.slice(0, 40);
  var tent = Number(cache.get(chave) || 0);
  if (tent >= 5) throw apiErro_('Muitas tentativas erradas. Aguarde 15 minutos.', 'BLOQUEADO');
  var p = ler_('Pessoas').filter(function (x) { return x.Ativo !== 'não' && normNome_(x.Nome) === nome; })[0];
  if (!p || !apiIgual_(pinHash_(p.ID, req.pin), p.PinHash)) {
    cache.put(chave, String(tent + 1), 15 * 60);
    throw apiErro_(p ? 'PIN incorreto. Tentativas restantes: ' + Math.max(0, 4 - tent) + '.' : 'Não achei ninguém com esse nome. Primeiro acesso? Use o código de convite.', 'PIN');
  }
  cache.remove(chave);
  return bootDe_(p.ID, novaSessao_(p.ID, req.aparelho));
}

var CORES = ['a', 'b', 'c', 'd'];

function apiCadastro_(req) {
  var c = cfg_();
  if (!c.convite) throw apiErro_('A casa ainda não foi configurada. Rode configurar() no Apps Script.', 'SETUP');
  if (String(req.convite || '').trim().toUpperCase() !== String(c.convite).trim().toUpperCase()) throw apiErro_('Código de convite errado. Peça o código a quem criou a casa.', 'CONVITE');
  var nome = String(req.nome || '').trim().replace(/\s+/g, ' ');
  if (nome.length < 2 || nome.length > 24) throw apiErro_('Use um nome de 2 a 24 letras.', 'VALIDACAO');
  var pin = validarPin_(req.pin);
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var ativas = ler_('Pessoas').filter(function (x) { return x.Ativo !== 'não'; });
    if (ativas.some(function (x) { return normNome_(x.Nome) === normNome_(nome); })) throw apiErro_('Já existe alguém com esse nome. Se for você, use "Entrar".', 'DUPLICADO');
    if (ativas.length >= (Number(c.max_pessoas) || 2)) throw apiErro_('A casa já está completa. Para entrar mais gente, aumente max_pessoas na aba Config.', 'LIMITE');
    var usadas = ativas.map(function (x) { return x.Cor; }), cor = CORES.filter(function (k) { return usadas.indexOf(k) < 0; })[0] || 'a';
    var id = 'P' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
    inserir_('Pessoas', { ID: id, Nome: nome, PinHash: pinHash_(id, pin), Cor: cor,
      Admin: ativas.some(function (x) { return x.Admin === 'sim'; }) ? 'não' : 'sim', Ativo: 'sim',
      CriadoEm: new Date().toISOString(), Atualizado: String(Date.now()) });
    return bootDe_(id, novaSessao_(id, req.aparelho));
  } finally { lock.releaseLock(); }
}

function apiAutenticar_(token) {
  if (!token || String(token).length < 32) throw apiErro_('Sessão expirada. Entre de novo.', 'SESSAO');
  var h = apiHash_(token), cache = CacheService.getScriptCache();
  var pessoa = cache.get('rotina_ses_' + h);
  if (!pessoa) {
    var ms = Date.now(), achou = null;
    ler_('Sessoes').some(function (r) {
      if (String(r.TokenHash) === h && r.Ativa === 'sim' && Number(r.ExpiraEmMs) > ms) { achou = r; return true; }
      return false;
    });
    if (!achou) throw apiErro_('Sessão expirada. Entre de novo.', 'SESSAO');
    var p = pessoaPorId_(achou.Pessoa);
    if (!p || p.Ativo === 'não') throw apiErro_('Seu acesso foi removido.', 'SESSAO');
    pessoa = achou.Pessoa;
    atualizar_('Sessoes', achou._lin, { UltimoUso: new Date().toISOString() });
    cache.put('rotina_ses_' + h, pessoa, 600);
  }
  return { pessoa: pessoa, tokenHash: h };
}

function trocarPin_(s, req) {
  var p = pessoaPorId_(s.pessoa);
  if (!apiIgual_(pinHash_(p.ID, req.atual), p.PinHash)) throw apiErro_('PIN atual incorreto.', 'PIN');
  var novo = validarPin_(req.novo);
  atualizar_('Pessoas', p._lin, { PinHash: pinHash_(p.ID, novo), Atualizado: String(Date.now()) });
  return { ok: true };
}

function apiEncerrar_(pessoa, soEsteToken) {
  var cache = CacheService.getScriptCache(), alvo = soEsteToken ? apiHash_(soEsteToken) : null, k = 0;
  ler_('Sessoes').forEach(function (r) {
    if (r.Pessoa === pessoa && r.Ativa === 'sim' && (!alvo || r.TokenHash === alvo)) { atualizar_('Sessoes', r._lin, { Ativa: 'não' }); cache.remove('rotina_ses_' + r.TokenHash); k++; }
  });
  return { encerradas: k };
}

/** Rodar no editor se um celular for perdido: encerra todas as sessões. */
function encerrarTodasSessoes() {
  var cache = CacheService.getScriptCache(), n = 0;
  ler_('Sessoes').forEach(function (r) { if (r.Ativa === 'sim') { atualizar_('Sessoes', r._lin, { Ativa: 'não' }); cache.remove('rotina_ses_' + r.TokenHash); n++; } });
  Logger.log('Sessões encerradas: ' + n);
  return n;
}

/** Esqueceu o PIN? Troque o nome e o PIN abaixo, salve e execute esta função no editor. */
function redefinirPinAqui() { redefinirPin('Nome da pessoa', '1234'); }

/** Usada por redefinirPinAqui. */
function redefinirPin(nome, novoPin) {
  var p = ler_('Pessoas').filter(function (x) { return normNome_(x.Nome) === normNome_(nome); })[0];
  if (!p) throw new Error('Ninguém com o nome ' + nome);
  atualizar_('Pessoas', p._lin, { PinHash: pinHash_(p.ID, validarPin_(novoPin)), Atualizado: String(Date.now()) });
  Logger.log('PIN de ' + p.Nome + ' redefinido.');
}

function apiLogErro_(req, err) {
  try { Logger.log('API ' + (req && req.acao) + ': ' + (err && err.stack || err)); } catch (x) { /* nada */ }
}
