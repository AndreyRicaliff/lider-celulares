#!/usr/bin/env bash
# Testa endpoints da API Tenfront
# Uso: BEARER=xxx CONSUMER_KEY=yyy CONSUMER_SECRET=zzz bash test-tenfront.sh

BEARER="${TENFRONT_BEARER:-$1}"
KEY="${TENFRONT_CONSUMER_KEY:-$2}"
SECRET="${TENFRONT_CONSUMER_SECRET:-$3}"

if [[ -z "$BEARER" || -z "$KEY" || -z "$SECRET" ]]; then
  echo "Uso: TENFRONT_BEARER=xxx TENFRONT_CONSUMER_KEY=yyy TENFRONT_CONSUMER_SECRET=zzz bash test-tenfront.sh"
  exit 1
fi

BEARER="${BEARER#Bearer }"  # remove prefixo se vier com "Bearer "

H_AUTH="Authorization: Bearer $BEARER"
H_KEY="Consumer-key: $KEY"
H_SEC="Consumer-secret: $SECRET"
H_CT="Content-Type: application/json"

TODAY=$(date '+%d/%m/%Y')
YESTERDAY=$(date -d 'yesterday' '+%d/%m/%Y' 2>/dev/null || date -v-1d '+%d/%m/%Y')

echo "========================================"
echo "  TEST 1: Saldo de tokens"
echo "========================================"
curl -s -X GET "https://api.tenfront.com.br/v1/saldo-token" \
  -H "$H_AUTH" -H "$H_KEY" -H "$H_SEC" | python3 -m json.tool 2>/dev/null || echo "(resposta acima)"

echo ""
echo "========================================"
echo "  TEST 2: Listar atendimentos — SEM filtro de data (página 1)"
echo "========================================"
curl -s -X POST "https://api.tenfront.com.br/v1/listar-atendimentos" \
  -H "$H_AUTH" -H "$H_KEY" -H "$H_SEC" -H "$H_CT" \
  -d '{"page":"1"}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('Total pages:', d.get('Total pages'))
print('Registros p1:', len(d.get('Response', [])))
sample = d.get('Response', [])[:2]
for r in sample:
    print(' -', r.get('Data'), r.get('Vendedor'), r.get('Status'))
"

echo ""
echo "========================================"
echo "  TEST 3: Listar atendimentos — COM data-inicial/data-final (hoje)"
echo "========================================"
echo "  Datas: $TODAY a $TODAY"
curl -s -X POST "https://api.tenfront.com.br/v1/listar-atendimentos" \
  -H "$H_AUTH" -H "$H_KEY" -H "$H_SEC" -H "$H_CT" \
  -d "{\"page\":\"1\",\"data-inicial\":\"$TODAY\",\"data-final\":\"$TODAY\"}" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('Total pages:', d.get('Total pages'))
print('Registros:', len(d.get('Response', [])))
print('Chaves da resposta:', list(d.keys()))
"

echo ""
echo "========================================"
echo "  TEST 4: Listar atendimentos — COM data_inicio/data_fim (formato alternativo)"
echo "========================================"
curl -s -X POST "https://api.tenfront.com.br/v1/listar-atendimentos" \
  -H "$H_AUTH" -H "$H_KEY" -H "$H_SEC" -H "$H_CT" \
  -d "{\"page\":\"1\",\"data_inicio\":\"$TODAY\",\"data_fim\":\"$TODAY\"}" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('Total pages:', d.get('Total pages'))
print('Registros:', len(d.get('Response', [])))
"

echo ""
echo "========================================"
echo "  TEST 5: Endpoint saldo-token (formato alternativo)"
echo "========================================"
curl -s -X POST "https://api.tenfront.com.br/v1/saldo-token" \
  -H "$H_AUTH" -H "$H_KEY" -H "$H_SEC" -H "$H_CT" \
  -d '{}' | python3 -m json.tool 2>/dev/null || echo "(resposta acima)"
