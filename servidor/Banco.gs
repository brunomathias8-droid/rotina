/**
 * Banco.gs — saldos e transações dos bancos pelo Open Finance, só leitura, via Pluggy (MeuPluggy, gratuito para uso pessoal).
 *
 * Ninguém aqui movimenta dinheiro: a permissão do Open Finance é de leitura e pode ser revogada no app de cada banco.
 * 1. Criar conta em meu.pluggy.ai e conectar os bancos (cada um autoriza no app do próprio banco).
 * 2. Em dashboard.pluggy.ai: criar uma aplicação de desenvolvimento, incluir o conector MeuPluggy e autorizar cada banco pela aplicação demo.
 *    Cada autorização vira um "item"; copiar os IDs dos itens.
 * 3. Propriedades do script: PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET e PLUGGY_ITENS (os IDs separados por vírgula). Rodar ativarLuar() de novo.
 * O MeuPluggy atualiza os dados uma vez por dia; o gatilho daqui busca de 4 em 4 horas.
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
  var desde = N_somaDias(hoje_(), -40), agora = new Date().toISOString(), contas = [], txs = [], erros = [];
  itens.forEach(function (item) {
    try {
      var it = pluggyGet_('/items/' + encodeURIComponent(item)), inst = (it.connector && it.connector.name) || 'Banco';
      (pluggyGet_('/accounts?itemId=' + encodeURIComponent(item)).results || []).forEach(function (a) {
        var cred = a.creditData || {};
        contas.push({ ID: a.id, Nome: a.name || a.marketingName || a.type, Tipo: a.type === 'CREDIT' ? 'cartao' : 'conta', Instituicao: inst,
          Saldo: (Number(a.balance) || 0).toFixed(2), Limite: cred.creditLimit != null ? Number(cred.creditLimit).toFixed(2) : '',
          Disponivel: cred.availableCreditLimit != null ? Number(cred.availableCreditLimit).toFixed(2) : '', Atualizado: agora });
        for (var pag = 1, total = 1; pag <= total && pag <= 10; pag++) {
          var t = pluggyGet_('/transactions?accountId=' + encodeURIComponent(a.id) + '&from=' + desde + '&pageSize=500&page=' + pag);
          total = t.totalPages || 1;
          (t.results || []).forEach(function (x) {
            var md = x.creditCardMetadata || {}, v = Math.abs(Number(x.amount) || 0);
            // DEBIT é dinheiro saindo (na conta e nas compras do cartão); sem tipo, vale o sinal do valor
            var saida = x.type ? x.type === 'DEBIT' : Number(x.amount) < 0;
            txs.push({ ID: x.id, Dia: String(x.date).slice(0, 10), Valor: v.toFixed(2), Tipo: saida ? 'saida' : 'entrada', Descricao: String(x.description || '').slice(0, 120),
              Categoria: x.category || '', Conta: a.id, Instituicao: inst + (a.type === 'CREDIT' ? ' cartão' : ''),
              Parcela: md.totalInstallments > 1 ? md.installmentNumber + '/' + md.totalInstallments : '', Status: x.status || '', Atualizado: agora });
          });
        }
      });
    } catch (e) { erros.push(String(e.message || e)); Logger.log('banco ' + item + ': ' + e); }
  });
  comLock_(function () {
    bancoGravar_('BancoContas', contas);
    bancoGravar_('Banco', txs);
  });
  PropertiesService.getScriptProperties().setProperty('BANCO_ULTIMA', JSON.stringify({ quando: agora, contas: contas.length, transacoes: txs.length, erros: erros }));
}
/** Cria ou atualiza pelo ID (o ID é o da Pluggy, então buscar de novo não duplica). */
function bancoGravar_(aba, linhas) {
  var atuais = {}; ler_(aba).forEach(function (r) { atuais[r.ID] = r._lin; });
  linhas.forEach(function (o) { if (atuais[o.ID]) atualizar_(aba, atuais[o.ID], o); else inserir_(aba, o); });
}

function bancoResumoApp_() {
  if (!bancoLigado_()) return { ligado: false };
  var u = json_(PropertiesService.getScriptProperties().getProperty('BANCO_ULTIMA'), null) || {};
  return { ligado: true, quando: u.quando || '', contas: u.contas || 0, transacoes: u.transacoes || 0, erros: u.erros || [] };
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
  var lim = N_somaDias(hoje, -2);
  txs.forEach(function (t) {
    if (N_mes(t.Dia) !== mes) return;
    var v = cents(t.Valor);
    if (t.Tipo === 'entrada') { ent += v; return; }
    if (/pagamento de fatura|pagto fatura|pag fatura|credit card payment/i.test(t.Descricao + ' ' + t.Categoria)) return; // não conta duas vezes
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
