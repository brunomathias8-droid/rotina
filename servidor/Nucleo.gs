/**
 * nucleo.js — datas, repetição dos afazeres e rodízio, iguais no app e no servidor.
 * Fonte única: este arquivo. O servidor usa uma cópia idêntica em servidor/Nucleo.gs (rode build.sh depois de mudar).
 * Escrito em JavaScript simples (sem módulos) para rodar no navegador e no Apps Script.
 */

/* ------------------------------ datas (AAAA-MM-DD, sem fuso) ------------------------------ */
function N_pad(n) { return (n < 10 ? '0' : '') + n; }
function N_iso(d) { return d.getFullYear() + '-' + N_pad(d.getMonth() + 1) + '-' + N_pad(d.getDate()); }
function N_dataObj(iso) { var p = String(iso).split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
function N_somaDias(iso, n) { var d = N_dataObj(iso); d.setDate(d.getDate() + n); return N_iso(d); }
function N_diasEntre(a, b) { return Math.round((N_dataObj(b) - N_dataObj(a)) / 864e5); }
function N_segunda(iso) { return N_somaDias(iso, -((N_dataObj(iso).getDay() + 6) % 7)); }
function N_dataValida(iso) { return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) && N_iso(N_dataObj(iso)) === iso; }

/* Meses como AAAA-MM */
function N_mes(iso) { return String(iso).slice(0, 7); }
function N_somaMes(ref, n) {
  var a = +ref.slice(0, 4), m = +ref.slice(5, 7) - 1 + n;
  a += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  return a + '-' + N_pad(m + 1);
}
/** Dia "dm" do mês "ref". Dia 31 num mês de 30 dias vira o último dia do mês. */
function N_diaDoMes(ref, dm) {
  var a = +ref.slice(0, 4), m = +ref.slice(5, 7), ultimo = new Date(a, m, 0).getDate();
  return ref + '-' + N_pad(Math.max(1, Math.min(Number(dm) || 1, ultimo)));
}

/* ------------------------------ repetição dos afazeres ------------------------------ */
/*
 * Um afazer tem:
 *   freq: 'dia' | 'semana' | 'mes' | 'cada'
 *   dias: dias da semana para 'semana' (0 = domingo … 6 = sábado)
 *   dm:   dia do mês para 'mes'
 *   n:    intervalo em dias para 'cada'
 *   prox: data em que deve ser feito de novo
 */
var N_FREQ = { dia: 'Todo dia', semana: 'Toda semana', mes: 'Todo mês', cada: 'A cada N dias' };

/** Primeira data a partir de "desde" (inclusive) em que o afazer cai. */
function N_primeira(a, desde) {
  if (a.freq === 'semana') {
    var dias = N_diasSemana(a);
    for (var i = 0; i < 7; i++) { var d = N_somaDias(desde, i); if (dias.indexOf(N_dataObj(d).getDay()) >= 0) return d; }
    return desde;
  }
  if (a.freq === 'mes') {
    var c = N_diaDoMes(N_mes(desde), a.dm);
    return c >= desde ? c : N_diaDoMes(N_somaMes(N_mes(desde), 1), a.dm);
  }
  return desde;
}

/**
 * Próxima data depois de feito em "feitoEm".
 * Feito adiantado não conta duas vezes: a conta parte da data prevista (prox) quando ela ainda não chegou.
 * 'cada' conta sempre a partir de quando foi feito ("a cada 15 dias desde a última vez").
 */
function N_proxima(a, feitoEm) {
  if (a.freq === 'cada') return N_somaDias(feitoEm, Math.max(1, Number(a.n) || 1));
  var base = a.prox && a.prox > feitoEm ? a.prox : feitoEm;
  return N_primeira(a, N_somaDias(base, 1));
}

function N_diasSemana(a) {
  var d = Array.isArray(a.dias) ? a.dias : String(a.dias || '').split(',');
  d = d.filter(function (x) { return x !== '' && x !== null; }).map(Number).filter(function (x) { return x >= 0 && x <= 6; });
  return d.length ? d : [6];
}

/* ------------------------------ quem faz ------------------------------ */
/*
 * resp: 'rodizio' (alterna), 'ambos' (qualquer um) ou o ID de uma pessoa (fixo).
 * vez:  no rodízio, de quem é a vez agora.
 * troca: { de, para, st: 'pedida' | 'aceita' | 'recusada', motivo } — vale só para a vez atual.
 * Devolve o ID de quem faz agora, ou '' quando é de qualquer um.
 */
function N_quemFaz(a) {
  if (a.troca && a.troca.st === 'aceita' && a.troca.para) return a.troca.para;
  if (a.resp === 'rodizio') return a.vez || '';
  if (a.resp === 'ambos') return '';
  return a.resp || '';
}

/** No rodízio, a próxima vez é de quem vem depois de quem fez. Assim uma troca vira troca de vez, e ninguém faz duas seguidas. */
function N_proximaVez(ids, quemFez) {
  if (!ids.length) return quemFez || '';
  var i = ids.indexOf(quemFez);
  return ids[(i + 1) % ids.length];
}
