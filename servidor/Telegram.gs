/**
 * Telegram.gs — a Luar no Telegram.
 *
 * 1. No Telegram, falar com @BotFather, /newbot, escolher um nome. Ele devolve um token.
 * 2. Pôr o token na propriedade do script TELEGRAM_TOKEN e rodar ativarLuar() de novo.
 * 3. No app: Finanças › Luar › Ajustes › Telegram mostra um código; mandar "/vincular CÓDIGO" para o bot.
 *
 * Segurança: o bot só conversa com os chats vinculados por código (vale 30 minutos, uma vez). Qualquer outra pessoa que achar o bot recebe uma recusa.
 * O gatilho de 1 em 1 minuto busca as mensagens novas (getUpdates); não precisa de webhook nem de endereço público.
 */
function tgProps_() { return PropertiesService.getScriptProperties(); }
function tgToken_() { return tgProps_().getProperty('TELEGRAM_TOKEN') || ''; }
function tgChats_() { return json_(tgProps_().getProperty('TG_CHATS'), {}) || {}; }

function tgChamar_(metodo, dados) {
  var r = UrlFetchApp.fetch('https://api.telegram.org/bot' + tgToken_() + '/' + metodo, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify(dados || {})
  });
  var j = json_(r.getContentText(), {}) || {};
  if (!j.ok) throw new Error('Telegram ' + metodo + ': ' + (j.description || r.getResponseCode()));
  return j.result;
}
function telegramEnviar_(chat, texto) {
  texto = String(texto || '');
  for (var i = 0; i < texto.length; i += 3900) tgChamar_('sendMessage', { chat_id: chat, text: texto.slice(i, i + 3900) });
}
function telegramParaTodos_(texto) {
  if (!tgToken_()) return;
  var chats = tgChats_();
  Object.keys(chats).forEach(function (c) { try { telegramEnviar_(c, texto); } catch (e) { Logger.log('telegram ' + c + ': ' + e); } });
}

/** Para o app: está ligado? esta pessoa já vinculou? qual o @ do bot? */
function telegramEstado_(pessoa) {
  if (!tgToken_()) return { ligado: false };
  var chats = tgChats_(), meu = Object.keys(chats).filter(function (c) { return chats[c] === pessoa; }).length > 0;
  var bot = tgProps_().getProperty('TG_BOT');
  if (!bot) { try { bot = tgChamar_('getMe').username; tgProps_().setProperty('TG_BOT', bot); } catch (e) { bot = ''; } }
  return { ligado: true, vinculado: meu, bot: bot || '' };
}
function telegramCodigo_(pessoa) {
  if (!tgToken_()) throw apiErro_('O Telegram ainda não foi ligado no servidor (falta TELEGRAM_TOKEN).', 'CONFIG');
  var cod = String(100000 + Math.floor(Math.random() * 900000));
  tgProps_().setProperty('TG_COD_' + cod, JSON.stringify({ pessoa: pessoa, ate: Date.now() + 30 * 60000 }));
  var est = telegramEstado_(pessoa); est.codigo = cod;
  return est;
}

/** Gatilho de 1 em 1 minuto. */
function telegramVerificar() {
  if (!tgToken_()) return;
  _cache = {}; _cfg = null;
  var cache = CacheService.getScriptCache();
  if (cache.get('tg_rodando')) return; // a volta anterior ainda está respondendo
  cache.put('tg_rodando', '1', 300);
  try {
    var props = tgProps_(), offset = Number(props.getProperty('TG_OFFSET')) || 0;
    var ups = tgChamar_('getUpdates', { offset: offset, timeout: 0, allowed_updates: ['message'] }) || [];
    if (!ups.length) return;
    props.setProperty('TG_OFFSET', String(ups[ups.length - 1].update_id + 1)); // avança antes de responder: nada é respondido duas vezes
    ups.forEach(function (u) { try { telegramMensagem_(u.message); } catch (e) { Logger.log('telegram: ' + e); } });
  } finally { cache.remove('tg_rodando'); }
}
function telegramMensagem_(m) {
  if (!m || !m.chat || m.chat.type !== 'private' || !m.text) return;
  var chat = String(m.chat.id), txt = String(m.text).trim(), chats = tgChats_(), props = tgProps_();
  var vinc = /^\/(?:vincular|start)\s+(\d{6})$/.exec(txt);
  if (vinc) {
    var falhas = Number(props.getProperty('TG_FALHAS_' + chat)) || 0;
    if (falhas >= 5) return; // quem erra o código 5 vezes é ignorado de vez
    var k = 'TG_COD_' + vinc[1], c = json_(props.getProperty(k), null);
    props.deleteProperty(k);
    if (!c || c.ate < Date.now()) { props.setProperty('TG_FALHAS_' + chat, String(falhas + 1)); telegramEnviar_(chat, 'Código inválido ou vencido. Gere outro no app: Finanças › Luar › Ajustes.'); return; }
    chats[chat] = c.pessoa; props.setProperty('TG_CHATS', JSON.stringify(chats));
    telegramEnviar_(chat, 'Pronto, ' + nomeDe_(c.pessoa) + '. A partir de agora a Luar fala com você por aqui também. Pode perguntar: "posso gastar R$ 300 com isso?", "como estamos no mês?"...');
    return;
  }
  var pessoa = chats[chat];
  if (!pessoa) { telegramEnviar_(chat, 'Este bot é particular. Se você é da casa, gere um código no app (Finanças › Luar › Ajustes) e mande /vincular CÓDIGO.'); return; }
  if (/^\/sair$/.test(txt)) { delete chats[chat]; props.setProperty('TG_CHATS', JSON.stringify(chats)); telegramEnviar_(chat, 'Desvinculado. A Luar não manda mais nada aqui.'); return; }
  if (/^\/start$/.test(txt)) { telegramEnviar_(chat, 'Oi! É só escrever.'); return; }
  try { tgChamar_('sendChatAction', { chat_id: chat, action: 'typing' }); } catch (e) { }
  var resp;
  try { resp = luarResponder_(pessoa, txt, 'telegram'); }
  catch (e) { resp = 'Não consegui responder agora (' + String(e.message || e) + ').'; }
  telegramEnviar_(chat, resp);
}
