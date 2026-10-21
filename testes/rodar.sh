#!/usr/bin/env bash
# Roda todos os testes de ponta a ponta contra o servidor simulado (planilha em memória, começa vazia).
# Uso: ./testes/rodar.sh            (todos, na ordem: alguns usam os dados criados pelos anteriores)
#      ./testes/rodar.sh fluxo15    (só alguns; o fluxo3 sempre roda antes porque cadastra as pessoas)
# Precisa de Node 18+ e, na primeira vez: (cd testes && npm install)
set -u
cd "$(dirname "$0")"
PORTA=8787
TODOS="fluxo3 fluxo4 fluxo5 fluxo6 fluxo7 fluxo8 fluxo11 fluxo12 fluxo13 fluxo14 fluxo15 fluxo16 fluxo17 fluxo18 estilo"
LISTA="${*:-$TODOS}"
case " $LISTA " in *" fluxo3 "*) ;; *) LISTA="fluxo3 $LISTA" ;; esac
node servidor-falso.js .. $PORTA > servidor.log 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
for i in $(seq 1 50); do grep -q "no ar" servidor.log 2>/dev/null && break; sleep 0.2; done
falhas=0
for t in $LISTA; do
  echo "== $t"
  saida=$(node "$t.js" 2>&1); cod=$?
  echo "$saida"
  if [ $cod -ne 0 ] || echo "$saida" | grep -qE "✗|FALHOU|PROBLEMAS|^ERRO"; then falhas=$((falhas+1)); echo "!! $t falhou"; fi
done
echo
[ $falhas -eq 0 ] && echo "Todos os testes passaram." || echo "$falhas teste(s) com falha."
exit $falhas
