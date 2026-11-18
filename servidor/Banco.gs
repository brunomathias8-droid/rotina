/**
 * Banco.gs — saldos e transações dos bancos pelo Open Finance, só leitura, via Pluggy (MeuPluggy, gratuito para uso pessoal).
 *
 * Ninguém aqui movimenta dinheiro: a permissão do Open Finance é de leitura e pode ser revogada no app de cada banco.
 * 1. Criar conta em meu.pluggy.ai e conectar os bancos (cada um autoriza no app do próprio banco).
 * 2. Em dashboard.pluggy.ai: criar uma aplicação de desenvolvimento, incluir o conector MeuPluggy e autorizar cada banco pela aplicação demo.
 *    Cada autorização vira um "item"; copiar os IDs dos itens.
 * 3. Propriedades do script: PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET e PLUGGY_ITENS (os IDs separados por vírgula). Rodar ativarLuar() de novo.
 * O MeuPluggy atualiza os dados uma vez por dia; o gatilho daqui busca de 4 em 4 horas (os últimos 95 dias, para pegar parcelas e faturas fechadas).
 * As transações ficam nas abas Banco e BancoContas, para a Luar ler. (Levar para os lançamentos do app é a próxima etapa.)
 */
var PLUGGY_API = 'https://api.pluggy.ai';

function bancoLigado_() { var p = PropertiesService.getScriptProperties(); return !!(p.getProperty('PLUGGY_CLIENT_ID') && p.getProperty('PLUGGY_ITENS')); }
function pluggyChave_() {
  var cache = CacheService.getScriptCache(), k = cache.get('pluggy_chave');
  if (k) return k;
  var p = PropertiesService.getScriptProperties();
  var r = UrlFetchApp.fetch(PLUGGY_API + '/auth', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ clientId: p.getProperty('PLUGGY_CLIENT_ID'), clientSecret: p.getProperty('PLUGGY_CLIENT_SECRET') }) });
  var j = json_(r.getContentText(), {}) || {};
  if (!j.apiKey) throw new Error('Pluggy recusou a autenticação (' + r.getResponseCode() + ').');
  cache.put('pluggy_chave', j.apiKey, 5400); // a chave vale 2 horas
  return j.apiKey;
}
function pluggyGet_(caminho) {
  var r = UrlFetchApp.fetch(PLUGGY_API + caminho, { headers: { 'X-API-KEY': pluggyChave_() }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('Pluggy ' + caminho.split('?')[0] + ': ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 200));
  return json_(r.getContentText(), {}) || {};
}

/** Gatilho de 4 em 4 horas (e o botão "Buscar agora" do app). Busca os últimos 40 dias e atualiza o que mudou. */
function bancoSincronizar() {
  if (!bancoLigado_()) return;
  _cache = {}; _cfg = null;
  var itens = String(PropertiesService.getScriptProperties().getProperty('PLUGGY_ITENS')).split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  var desde = N_somaDias(hoje_(), -95), agora = new Date().toISOString(), contas = [], txs = [], erros = [];
  itens.forEach(function (item) {
    try {
      var it = pluggyGet_('/items/' + encodeURIComponent(item)), inst = (it.connector && it.connector.name) || 'Banco';
      (pluggyGet_('/accounts?itemId=' + encodeURIComponent(item)).results || []).forEach(function (a) {
        var cred = a.creditData || {};
        contas.push({ ID: a.id, Nome: String(a.marketingName || a.name || a.type).replace(/\s+/g, ' ').trim(), Tipo: a.type === 'CREDIT' ? 'cartao' : 'conta', Instituicao: inst,
          Saldo: (Number(a.balance) || 0).toFixed(2), Limite: cred.creditLimit != null ? Number(cred.creditLimit).toFixed(2) : '',
          Disponivel: cred.availableCreditLimit != null ? Number(cred.availableCreditLimit).toFixed(2) : '', Atualizado: agora });
        // /v2/transactions pagina por cursor: "next" traz o parâmetro after da próxima página (ou vem vazio no fim)
        var base = '/v2/transactions?accountId=' + encodeURIComponent(a.id) + '&dateFrom=' + desde, after = '';
        for (var pag = 0; pag < 20; pag++) {
          var t = pluggyGet_(base + (after ? '&after=' + encodeURIComponent(after) : ''));
          (t.results || t.data || []).forEach(function (x) {
            var md = x.creditCardMetadata || {}, v = Math.abs(Number(x.amount) || 0);
            // DEBIT é dinheiro saindo (na conta e nas compras do cartão); sem tipo, vale o sinal do valor
            var saida = x.type ? x.type === 'DEBIT' : Number(x.amount) < 0;
            txs.push({ ID: x.id, Dia: String(x.date).slice(0, 10), Valor: v.toFixed(2), Tipo: saida ? 'saida' : 'entrada', Descricao: String(x.description || '').slice(0, 120),
              Categoria: x.category || '', Conta: a.id, Instituicao: inst + (a.type === 'CREDIT' ? ' cartão' : ''),
              Parcela: md.totalInstallments > 1 ? md.installmentNumber + '/' + md.totalInstallments : '', Status: x.status || '', Atualizado: agora });
          });
          var prox = /[?&]after=([^&]+)/.exec(String(t.next || ''));
          if (!prox || decodeURIComponent(prox[1]) === after) break;
          after = decodeURIComponent(prox[1]);
        }
      });
    } catch (e) { erros.push(String(e.message || e)); Logger.log('banco ' + item + ': ' + e); }
  });
  comLock_(function () {
    bancoGravar_('BancoContas', contas);
    // Compra pendente que sumiu da busca foi substituída pela confirmada (às vezes com outro ID): o lançamento dela fica livre para a confirmada
    var vistos = {}; txs.forEach(function (t) { vistos[t.ID] = 1; });
    if (!erros.length) ler_('Banco').forEach(function (r) { if (r.Status === 'PENDING' && !vistos[r.ID] && r.Dia >= desde) txs.push({ ID: r.ID, Status: 'SUMIU' }); });
    bancoGravar_('Banco', txs);
  });
  var lanc = { criados: 0, ligados: 0 };
  try { lanc = comLock_(bancoLancar_); } catch (e) { erros.push('lançar: ' + String(e.message || e)); Logger.log('bancoLancar: ' + e); }
  PropertiesService.getScriptProperties().setProperty('BANCO_ULTIMA', JSON.stringify({ quando: agora, contas: contas.length, transacoes: txs.length, criados: lanc.criados, ligados: lanc.ligados, erros: erros }));
}
/** Cria ou atualiza pelo ID (o ID é o da Pluggy, então buscar de novo não duplica). */
function bancoGravar_(aba, linhas) {
  var atuais = {}; ler_(aba).forEach(function (r) { atuais[r.ID] = r._lin; });
  linhas.forEach(function (o) { if (atuais[o.ID]) atualizar_(aba, atuais[o.ID], o); else inserir_(aba, o); });
}

function bancoResumoApp_() {
  if (!bancoLigado_()) return { ligado: false };
  var u = json_(PropertiesService.getScriptProperties().getProperty('BANCO_ULTIMA'), null) || {}, c = cfg_();
  var lista = ler_('BancoContas').map(function (r) { return { id: r.ID, nome: r.Nome, inst: r.Instituicao, tipo: r.Tipo }; });
  var pend = ler_('Banco').filter(function (t) { return !t.Lancamento; }).length;
  return { ligado: true, quando: u.quando || '', contas: u.contas || 0, transacoes: u.transacoes || 0, criados: u.criados || 0, erros: u.erros || [],
    lista: lista, mapa: json_(c.banco_mapa, {}) || {}, desde: c.banco_desde || '', pendentes: pend, fechamentos: bancoFechamentos_() };
}

/* ------------------------------ do banco para os lançamentos ------------------------------ */
/**
 * Cada conta do banco aponta para um cartão ou uma conta do app (banco_mapa na aba Config) e só entra o que for de banco_desde em diante.
 * O lançamento ganha o ID "of" + ID da Pluggy, então rodar de novo nunca duplica. O que vocês já tinham lançado à mão
 * (mesmo valor, mesma conta ou cartão, data até 3 dias de diferença, ou mesma parcela) é reconhecido e só fica ligado.
 * Compras pendentes (a fatura aberta) também entram; se a confirmada chegar com outro ID, ela se liga ao mesmo lançamento.
 * Categoria: regra da casa, depois a mais usada para a mesma loja, depois pistas do nome; sem categoria vai para a fila Revisar.
 */
function bancoSalvarMapa_(mapa, desde) {
  var limpo = {}, tipos = {};
  ler_('BancoContas').forEach(function (r) { tipos[r.ID] = r.Tipo; });
  Object.keys(mapa || {}).slice(0, 40).forEach(function (k) {
    var m = mapa[k]; if (!m || !/^[A-Za-z0-9_-]{3,80}$/.test(k) || (m.tipo !== 'cartao' && m.tipo !== 'carteira')) return;
    if ((tipos[k] === 'conta' && m.tipo !== 'carteira') || (tipos[k] === 'cartao' && m.tipo !== 'cartao')) return; // conta corrente só vira conta; cartão só vira cartão
    limpo[k] = { tipo: m.tipo, id: String(m.id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) };
  });
  cfgSet_('banco_mapa', JSON.stringify(limpo));
  if (desde !== undefined) cfgSet_('banco_desde', N_dataValida(desde) ? desde : '');
  _cache = {};
  return bancoLancar_();
}
var PISTAS_BANCO = [
  ['delivery', /ifood|rappi|ze delivery|aiqfome|uber ?eats|james delivery|restaurante|lanchonete|pizzaria|burger|mc ?donald|bk |outback|padaria|cafeteria|bar /],
  ['mercado', /supermerc|mercado|atacad|assai|carrefour|pao de acucar|extra hiper|hortifruti|sacolao|acougue|gbarbosa|atacarejo/],
  ['transporte', /uber|99 ?app|99 ?pop|99 ?tecnologia|posto|shell|ipiranga|petrobras|br mania|combust|estacionamento|sem parar|conectcar|veloe|pedagio/],
  ['saude', /farmacia|drogaria|drogasil|raia|pague menos|pacheco|hospital|clinica|laborat|unimed|hapvida|amil|bradesco saude|odonto|dentist/],
  ['assinaturas', /netflix|spotify|disney|hbo|max\.com|prime video|amazon prime|globoplay|apple\.com|google one|youtube|deezer|paramount|icloud|chatgpt|openai/],
  ['educacao', /escola|colegio|faculdade|curso|livraria|udemy|alura/],
  ['contas', /energia|enel|coelce|cemig|light |copel|agua|cagece|sabesp|compesa|claro|vivo|tim |oi fibra|internet|net servicos|gas /],
  ['moradia', /condominio|aluguel|imobiliaria|iptu/],
  ['compras', /amazon|mercado ?livre|magalu|magazine|shopee|shein|aliexpress|renner|riachuelo|c&a|zara|americanas|casas bahia/],
  ['impostos', /iof|tarifa|anuidade|imposto|darf|receita federal|detran|ipva/],
  ['dividas', /juros|encargos|rotativo|multa/]
];
function bancoCategoria_(desc, regras, hist, cats) {
  var k = N_lojaDe(desc), ok = function (c) { return c && c !== 'outros' && cats[c]; };
  if (k && ok(regras[k])) return regras[k];
  var h = hist[k]; if (h) { var melhor = Object.keys(h).sort(function (a, b) { return h[b] - h[a]; })[0]; if (ok(melhor)) return melhor; }
  var d = ' ' + String(desc || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() + ' ';
  for (var i = 0; i < PISTAS_BANCO.length; i++) if (PISTAS_BANCO[i][1].test(d) && cats[PISTAS_BANCO[i][0]]) return PISTAS_BANCO[i][0];
  return '';
}
/**
 * Fatura de uma compra do cartão vinda do banco. Parcela: a 1ª vem com a data da compra e as seguintes com a data do ciclo
 * em que entram (conferido no C6), então a data diz a fatura. Compra pendente é da fatura aberta: nunca de uma que já fechou,
 * mesmo que o dia de fechamento do app esteja diferente do banco.
 */
function bancoFatura_(k, t) {
  var f = N_faturaRef(k, t.Dia);
  if (t.Status === 'PENDING') { var aberta = N_faturaRef(k, hoje_()); if (aberta > f) f = aberta; }
  return f;
}
/** Onde o banco fechou a última fatura de cada cartão: entre a última compra já fechada e a primeira pendente. */
function bancoFechamentos_() {
  var mapa = json_(cfg_().banco_mapa, {}) || {}, out = [], porConta = {};
  ler_('Banco').forEach(function (t) {
    var m = mapa[t.Conta]; if (!m || m.tipo !== 'cartao' || t.Tipo !== 'saida' || /^\d+\/\d+$/.test(t.Parcela)) return;
    var c = porConta[t.Conta] = porConta[t.Conta] || { cartao: m.id, fechada: '', aberta: '' };
    if (t.Status === 'POSTED' && t.Dia > c.fechada) c.fechada = t.Dia;
    if (t.Status === 'PENDING' && (!c.aberta || t.Dia < c.aberta)) c.aberta = t.Dia;
  });
  Object.keys(porConta).forEach(function (k) { var c = porConta[k]; if (c.fechada && c.aberta && c.fechada < c.aberta) out.push(c); });
  return out;
}

function bancoLancar_() {
  var c = cfg_(), mapa = json_(c.banco_mapa, {}) || {}, desde = c.banco_desde || '';
  if (!Object.keys(mapa).length) return { criados: 0, ligados: 0 };
  var novos = [], marca = {}; // marca: linha da aba Banco -> id do lançamento
  var lancs = ativos_('lancamentos'), banco = ler_('Banco'), cartoes = {}, ligados = {}, porId = {}, criados = 0, ligadosAgora = 0;
  ativos_('cartoes').forEach(function (k) { cartoes[k.id] = k; });
  lancs.forEach(function (l) { porId[l.id] = l; });
  banco.forEach(function (t) { if (t.Lancamento && t.Status !== 'SUMIU') ligados[t.Lancamento] = 1; });
  var regras = json_(c.regras, {}) || {}, cats = {}, hist = {};
  categorias_().forEach(function (x) { cats[x.id] = 1; });
  lancs.forEach(function (l) { if (l.tipo === 'saida' && l.cat && l.cat !== 'outros' && !/categoria a confirmar/i.test(l.nota || '')) { var k = N_lojaDe(l.desc); if (k) { hist[k] = hist[k] || {}; hist[k][l.cat] = (hist[k][l.cat] || 0) + 1; } } });
  var cents = function (t) { return Math.round((parseFloat(t) || 0) * 100); };
  var norm = function (t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); };
  var achar = function (f) { for (var i = 0; i < lancs.length; i++) { var l = lancs[i]; if (!ligados[l.id] && f(l)) return l; } return null; };
  var ligar = function (t, id) { marca[t._lin] = id; ligados[id] = 1; };
  // Já lançado à mão nesta conta: mesmo valor até 3 dias, ou a conta fixa do mês (valor até 15% diferente, até 10 dias)
  var acharNaConta = function (tipo, v, dia, carteira) {
    return achar(function (l) {
      if (l.tipo !== tipo || l.forma === 'cartao' || (l.carteira && l.carteira !== carteira)) return false;
      var dd = Math.abs(N_diasEntre(l.dia, dia));
      return (l.v === v && dd <= 3) || (l.conta && l.ref === N_mes(dia) && dd <= 10 && Math.abs(l.v - v) <= Math.max(100, Math.round(l.v * 0.15)));
    });
  };

  // Refaz o que foi lançado com outra regra: conta ligada ao lugar errado (mapa mudou) ou parcela numa fatura que não é a da data
  var todos = {}, apagar = {}, agoraMs = String(Date.now()), refeitos = 0;
  ler_('Lancamentos').forEach(function (r) { todos[r.ID] = r; });
  var errado = function (t, l) {
    var m = mapa[t.Conta]; if (!m) return false;
    if (m.tipo === 'cartao') {
      if (l.cartao !== m.id) return true;
      var k = cartoes[m.id];
      return !!(k && l.tipo === 'saida' && (/^\d+\/\d+$/.test(t.Parcela) || t.Status === 'PENDING') && l.fat && l.fat !== bancoFatura_(k, t));
    }
    return l.forma === 'cartao' || (l.carteira !== m.id && l.destino !== m.id);
  };
  banco.forEach(function (t) { var id = t.Lancamento; if (id && t.Status !== 'SUMIU' && /^o[f-j]/.test(id) && porId[id] && errado(t, porId[id])) apagar[id] = 1; });
  Object.keys(apagar).forEach(function (id) { if (todos[id]) { atualizar_('Lancamentos', todos[id]._lin, { Excluido: 'sim', Atualizado: agoraMs }); refeitos++; } delete porId[id]; delete ligados[id]; });
  if (refeitos) {
    lancs = lancs.filter(function (l) { return !apagar[l.id]; });
    banco.forEach(function (t) { if (apagar[t.Lancamento]) { t.Lancamento = ''; marca[t._lin] = ''; } });
  }
  // ID do lançamento: "of" + ID da Pluggy; se esse já foi usado por um lançamento apagado, og, oh…
  var idDe = function (t) {
    var x = String(t.ID).replace(/[^A-Za-z0-9]/g, '').slice(0, 36), ps = ['of', 'og', 'oh', 'oi', 'oj'];
    for (var i = 0; i < ps.length; i++) { var id = ps[i] + x; if (porId[id] && !ligados[id]) return { ja: id }; if (!todos[id]) { todos[id] = { novo: 1 }; return { id: id }; } }
    return { id: 'ok' + x };
  };
  // Pix entre vocês ou entre contas da mesma pessoa não é receita nem gasto (quando as duas contas estão no mapa, vira transferência)
  var nomes = pessoasAtivas_().map(function (p) { return norm(p.Nome).split(' ')[0]; }).filter(function (n) { return n.length >= 3; });
  var interno = function (t, d) { return /same person transfer/i.test(t.Categoria) || nomes.some(function (n) { return new RegExp('pix (recebido de|enviado para|enviado a|de|para) ' + n + '\\b').test(d); }); };
  // Contas fixas do mês ainda sem lançamento: o Pix ou boleto do banco vira o pagamento delas
  var fixas = ativos_('contas').filter(function (c) { return c.ativa !== false && c.forma !== 'cartao' && (c.tipo === 'saida' || c.tipo === 'entrada'); });
  var pagas = {}; lancs.forEach(function (l) { if (l.conta && l.ref) pagas[l.conta + '|' + l.ref] = 1; });
  var contaFixa = function (tipo, v, dia, carteira) {
    var mes = N_mes(dia), melhor = null, nota = 1e9;
    fixas.forEach(function (c) {
      if (c.tipo !== tipo || (c.fim && c.fim < mes) || pagas[c.id + '|' + mes] || (c.carteira && c.carteira !== carteira)) return;
      var dd = Math.abs(N_diasEntre(N_diaDoMes(mes, c.vence || 1), dia)), dv = Math.abs(v - (c.v || 0));
      if (dd > 10 || dv > Math.max(100, Math.round((c.v || 0) * 0.15))) return;
      if (dv / 100 + dd < nota) { nota = dv / 100 + dd; melhor = c; }
    });
    return melhor;
  };
  var pend = banco.filter(function (t) { return !t.Lancamento && mapa[t.Conta] && (!desde || t.Dia >= desde) && t.Status !== 'SUMIU'; });

  // Transferência entre contas de vocês: sai de uma, entra na outra com o mesmo valor em até 1 dia
  pend.forEach(function (t) {
    if (marca[t._lin] || t.Tipo !== 'saida' || mapa[t.Conta].tipo !== 'carteira') return;
    var par = pend.filter(function (u) { return !marca[u._lin] && u.Tipo === 'entrada' && u.Conta !== t.Conta && mapa[u.Conta].tipo === 'carteira' && u.Valor === t.Valor && Math.abs(N_diasEntre(u.Dia, t.Dia)) <= 1; })[0];
    if (!par) return;
    var ni = idDe(t);
    if (ni.ja) { ligar(t, ni.ja); ligar(par, ni.ja); return; }
    var id = ni.id;
    novos.push({ id: id, tipo: 'transf', dia: t.Dia, v: cents(t.Valor), desc: 'Transferência entre contas', carteira: mapa[t.Conta].id, destino: mapa[par.Conta].id, pago: true, nota: 'Open Finance' });
    ligar(t, id); ligar(par, id);
  });

  pend.forEach(function (t) {
    if (marca[t._lin]) return;
    var m = mapa[t.Conta], v = cents(t.Valor), desc = String(t.Descricao || '').replace(/\s+/g, ' ').trim().slice(0, 120), d = norm(desc);
    if (!v) { marca[t._lin] = '-'; return; }
    if (m.tipo === 'carteira' && interno(t, d)) { marca[t._lin] = '-'; return; }
    var item = null, dup = null;
    if (m.tipo === 'cartao') {
      var k = cartoes[m.id]; if (!k) return;
      if (t.Tipo === 'entrada' && /pagamento|pagto|pgto|pag fat|credito de pagamento|payment/.test(d)) { marca[t._lin] = '-'; return; } // pagamento da fatura: entra pela conta
      if (t.Tipo === 'entrada') v = -v; // estorno: crédito na fatura
      var parc = /^\d+\/\d+$/.test(t.Parcela) ? t.Parcela : '', fat = bancoFatura_(k, t);
      dup = achar(function (l) { return l.tipo === 'saida' && l.cartao === k.id && l.v === v && (parc ? (l.parc || '') === parc && N_faturaDe(k, l) === fat : !l.parc && Math.abs(N_diasEntre(l.dia, t.Dia)) <= 3); });
      item = { tipo: 'saida', forma: 'cartao', cartao: k.id, dia: t.Dia, v: v, desc: desc, parc: parc, fat: fat, pago: true, cat: bancoCategoria_(desc, regras, hist, cats) };
    } else if (t.Tipo === 'saida' && /fatura|pagamento cartao|pag cartao|pgto cartao|card payment/.test(d)) {
      // Pagamento de fatura: vira o pagamento do cartão que é pago por esta conta (se houver um só, ou se o nome aparecer)
      var ativos = Object.keys(cartoes).map(function (x) { return cartoes[x]; }).filter(function (k) { return k.ativo !== false; });
      var cands = ativos.filter(function (k) { return k.carteira === m.id; });
      if (cands.length !== 1) cands = (cands.length ? cands : ativos).filter(function (k) { // pelo nome do cartão, sem palavras genéricas
        return norm(k.nome).split(/[^a-z0-9]+/).some(function (w) { return w.length >= 3 && !/^(cartao|card|credito|visa|master|mastercard|elo|black|gold|platinum|infinite)$/.test(w) && d.indexOf(w) >= 0; });
      });
      if (cands.length !== 1) return; // não dá para saber qual cartão: fica para depois
      var kk = cands[0], hojeRef = N_mes(t.Dia), refs = [N_somaMes(hojeRef, -1), hojeRef, N_somaMes(hojeRef, 1)];
      var ref = refs.sort(function (a, b) { return Math.abs(N_diasEntre(N_vencimento(kk, a), t.Dia)) - Math.abs(N_diasEntre(N_vencimento(kk, b), t.Dia)); })[0];
      dup = achar(function (l) { return l.tipo === 'fatura' && l.cartao === kk.id && l.ref === ref && Math.abs(l.v - v) <= 100; });
      item = { tipo: 'fatura', cartao: kk.id, ref: ref, dia: t.Dia, v: v, desc: 'Fatura ' + kk.nome, carteira: m.id, pago: true };
    } else if (t.Tipo === 'entrada') {
      var catE = /salario|folha|remunera|proventos|pagto salario/.test(d) ? 'salario' : /rendiment|juros s|dividend|remuneracao basica/.test(d) ? 'rendimentos' : /estorno|devolu|reembols/.test(d) ? 'reembolso' : 'outrasent';
      dup = acharNaConta('entrada', v, t.Dia, m.id);
      item = { tipo: 'entrada', dia: t.Dia, v: v, desc: desc, cat: cats[catE] ? catE : 'outrasent', carteira: m.id, pago: true };
    } else {
      var forma = /boleto|titulo|pagamento de conta|pag conta/.test(d) ? 'boleto' : /deb.? ?aut|debito automatico/.test(d) ? 'auto' : /compra|debito|elo|visa|maestro/.test(d) && !/pix/.test(d) ? 'debito' : 'pix';
      dup = acharNaConta('saida', v, t.Dia, m.id);
      item = { tipo: 'saida', forma: forma, dia: t.Dia, v: v, desc: desc, carteira: m.id, pago: true, cat: bancoCategoria_(desc, regras, hist, cats) };
    }
    if (dup) {
      // Conta fixa que estava agendada (sem pagar): o banco confirma o pagamento
      if (dup.conta && !dup.pago && todos[dup.id] && todos[dup.id]._lin) atualizar_('Lancamentos', todos[dup.id]._lin, { Pago: 'sim', Dia: t.Dia, Valor: (v / 100).toFixed(2), Atualizado: agoraMs });
      ligar(t, dup.id); ligadosAgora++; return;
    }
    item.nota = 'Open Finance';
    if (m.tipo === 'carteira' && (item.tipo === 'saida' || item.tipo === 'entrada')) {
      var cf = contaFixa(item.tipo, v, t.Dia, m.id);
      if (cf) { item.conta = cf.id; item.ref = N_mes(t.Dia); item.cat = cf.cat || item.cat; item.desc = cf.nome; item.nota = 'Open Finance: ' + desc; pagas[cf.id + '|' + item.ref] = 1; }
    }
    var ni = idDe(t);
    if (ni.ja) { ligar(t, ni.ja); return; }
    item.id = ni.id;
    novos.push(item); ligar(t, item.id);
  });

  if (novos.length) {
    var def = COLECOES.lancamentos, ids = idsAtivos_(), quem = ids[0] || '', agora = String(Date.now()), em = new Date().toISOString(), cab = cab_('Lancamentos');
    var linhas = novos.map(function (it) {
      var o = { ID: it.id, CriadoPor: quem, CriadoEm: em, Atualizado: agora };
      Object.keys(def.campos).forEach(function (k) { var cc = def.campos[k]; o[cc[0]] = valorParaPlanilha_(cc[1], cc[2], it[k], ids); });
      return cab.map(function (h) { return texto_(o[h]); });
    });
    var sh = aba_('Lancamentos'), ini = sh.getLastRow() + 1;
    sh.getRange(ini, 1, linhas.length, cab.length).setNumberFormat('@').setValues(linhas);
    criados = novos.length;
  }
  // Grava na aba Banco qual lançamento veio de cada transação (de uma vez, uma coluna só)
  if (Object.keys(marca).length) {
    var shB = aba_('Banco'), cabB = cab_('Banco'), col = cabB.indexOf('Lancamento') + 1, n = shB.getLastRow() - 1;
    if (col > 0 && n > 0) {
      var vals = shB.getRange(2, col, n, 1).getValues();
      Object.keys(marca).forEach(function (lin) { vals[Number(lin) - 2][0] = marca[lin]; });
      shB.getRange(2, col, n, 1).setNumberFormat('@').setValues(vals);
    }
  }
  _cache = {};
  return { criados: criados, ligados: ligadosAgora, refeitos: refeitos };
}

/** O que a Luar lê do banco: saldos, faturas e gastos do mês direto da fonte, mesmo que ninguém tenha lançado nada no app. */
function bancoContexto_(hoje) {
  if (!bancoLigado_()) return '';
  var contas = ler_('BancoContas'), txs = ler_('Banco'), mes = N_mes(hoje), L = ['## Bancos (Open Finance, só leitura, atualizado 1 vez por dia)'];
  var u = json_(PropertiesService.getScriptProperties().getProperty('BANCO_ULTIMA'), null);
  if (u) L.push('Última busca: ' + String(u.quando).slice(0, 16).replace('T', ' ') + (u.erros && u.erros.length ? ' (com erro em ' + u.erros.length + ' banco(s))' : '') + '.');
  if (!contas.length) return L.concat('Nenhuma conta trazida ainda.').join('\n');
  var cents = function (t) { return Math.round((parseFloat(t) || 0) * 100); };
  contas.forEach(function (c) {
    L.push('- ' + c.Instituicao + ' · ' + c.Nome + ': ' + (c.Tipo === 'cartao' ? 'fatura atual ' + reais_(cents(c.Saldo)) + (c.Limite ? ', limite ' + reais_(cents(c.Limite)) + ', disponível ' + reais_(cents(c.Disponivel)) : '') : 'saldo ' + reais_(cents(c.Saldo))));
  });
  var porCat = {}, sai = 0, ent = 0, del = 0, nDel = 0, maiores = [], recentes = [];
  var lim = N_somaDias(hoje, -2), nomes = pessoasAtivas_().map(function (p) { return String(p.Nome).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(' ')[0]; }).filter(function (n) { return n.length >= 3; });
  txs.forEach(function (t) {
    if (N_mes(t.Dia) !== mes) return;
    var dn = String(t.Descricao).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (/same person transfer/i.test(t.Categoria) || nomes.some(function (n) { return dn.indexOf('pix recebido de ' + n) >= 0 || dn.indexOf('pix enviado para ' + n) >= 0; })) return; // dinheiro entre vocês
    var v = cents(t.Valor);
    if (/pagamento|pagto|pgto|pag fat|credit card payment/i.test(t.Descricao + ' ' + t.Categoria) && /fatura|cartao|cartão|recebido|card/i.test(t.Descricao + ' ' + t.Categoria)) return; // pagamento de fatura: não conta duas vezes
    if (t.Tipo === 'entrada') { ent += v; return; }
    sai += v; porCat[t.Categoria || 'Sem categoria'] = (porCat[t.Categoria || 'Sem categoria'] || 0) + v; maiores.push(t);
    if (/ifood|rappi|z[eé] delivery|uber ?eats|aiqfome|delivery|restaurant|food/i.test(t.Descricao + ' ' + t.Categoria)) { del += v; nDel++; }
    if (t.Dia >= lim) recentes.push(t);
  });
  L.push('Este mês nos bancos: entradas ' + reais_(ent) + ' · saídas ' + reais_(sai) + ' (sem contar pagamento de fatura).');
  var cats = Object.keys(porCat).sort(function (a, b) { return porCat[b] - porCat[a]; }).slice(0, 10);
  if (cats.length) L.push('Por categoria do banco: ' + cats.map(function (k) { return k + ' ' + reais_(porCat[k]); }).join('; ') + '.');
  if (nDel) L.push('Delivery/restaurante no banco: ' + nDel + ' compras, ' + reais_(del) + '.');
  maiores.sort(function (a, b) { return cents(b.Valor) - cents(a.Valor); });
  if (maiores.length) L.push('Maiores: ' + maiores.slice(0, 8).map(function (t) { return t.Dia.slice(8) + '/' + t.Dia.slice(5, 7) + ' ' + t.Descricao + ' ' + reais_(cents(t.Valor)) + ' (' + t.Instituicao + (t.Parcela ? ' ' + t.Parcela : '') + ')'; }).join('; ') + '.');
  if (recentes.length) L.push('De anteontem a hoje: ' + recentes.slice(0, 15).map(function (t) { return t.Dia.slice(8) + '/' + t.Dia.slice(5, 7) + ' ' + t.Descricao + ' ' + reais_(cents(t.Valor)); }).join('; ') + '.');
  return L.join('\n');
}
