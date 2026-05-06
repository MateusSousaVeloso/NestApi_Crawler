#!/usr/bin/env bash
# =============================================================================
# AZUL FLIGHT SEARCH - Fluxo completo replicado em curl
# Mapeamento direto do azul.service.ts
#
# USO:
#   ORIGIN=VCP DEST=GRU DATE=2026-06-10 ADULTS=1 bash azul_flow.sh
# =============================================================================

set -euo pipefail

ORIGIN="${ORIGIN:-VCP}"
DEST="${DEST:-GRU}"
DATE="${DATE:-2026-06-10}"        # YYYY-MM-DD
ADULTS="${ADULTS:-1}"

# Converte YYYY-MM-DD -> MM/DD/YYYY (formato STD da Azul)
IFS='-' read -r Y M D <<< "$DATE"
STD_DATE="${M}/${D}/${Y}"

UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'
SEC_CH_UA='"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"'

PAGE_URL="https://www.voeazul.com.br/br/pt/home/selecao-voo"
REFERER="${PAGE_URL}?c%5B0%5D.ds=${ORIGIN}&c%5B0%5D.std=${STD_DATE}&c%5B0%5D.as=${DEST}&p%5B0%5D.t=ADT&p%5B0%5D.c=${ADULTS}&p%5B0%5D.cp=false&f.dl=3&f.dr=3&cc=BRL"

# URLs do Akamai — SAO DINAMICAS, extraidas do HTML da challenge page.
# O Step 1 (GET pagina) retorna um challenge HTML com dois <script src="...">:
#   1. Challenge/SEC-CPT: path com ?v=<uuid>&t=<token>  (proof-of-work)
#   2. Sensor/fingerprint: path sem query params          (gera e posta sensor_data)
#
# Estas URLs mudam quando a Azul reconfigura o Akamai (nao mudam por request).
# O script extrai automaticamente do HTML. Os valores abaixo sao o fallback atual.
AKAMAI_SENSOR_URL='https://www.voeazul.com.br/SwPv7g/VzZ/pnb/IyVEXLFS/mO7fmpOYfYuhtkiuDY/LncmMxobXQI/Bx5gTzgw/PycB'
AKAMAI_CHALLENGE_BASE='https://www.voeazul.com.br/SwPv7g/VzZ/pnb/IyVEXLFS/Jb7fmpOYfYuh/Th8tMxobXQI/PikFLwxN/Xx8r'

COOKIE_JAR="/tmp/azul_cookies_$$.txt"
trap "rm -f $COOKIE_JAR" EXIT

# Flags curl comuns
CURL_COMMON=(
  --silent
  --show-error
  --compressed
  --cookie-jar "$COOKIE_JAR"
  --cookie "$COOKIE_JAR"
  --location
  --max-redirs 5
  --header "User-Agent: $UA"
  --header "Accept-Language: pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7"
  --header "Sec-Ch-Ua: $SEC_CH_UA"
  --header 'Sec-Ch-Ua-Mobile: ?0'
  --header 'Sec-Ch-Ua-Platform: "Windows"'
)

# =============================================================================
# STEP 1: GET pagina inicial
# Retorna challenge page do Akamai (HTML com 2 <script>) + cookies:
#   _abck, ak_bmsc, bm_sz, bm_ss, bm_mi, bm_s, bm_sc, bm_so
#
# Do HTML extraimos DINAMICAMENTE as URLs do Akamai:
#   Script 1 (challenge/SEC-CPT): <script src="/BASE/.../Xx8r?v=<uuid>&t=<token>">
#   Script 2 (sensor/fingerprint): <script src="/BASE/.../PycB">
#
# azul.service.ts: fetchPage() + extractAkamaiUrls()
# =============================================================================
echo "=== STEP 1: GET pagina ==="

curl "${CURL_COMMON[@]}" \
  --dump-header /tmp/azul_step1_headers_$$.txt \
  --header 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7' \
  --header 'Cache-Control: max-age=0' \
  --header 'Priority: u=0, i' \
  --header 'Sec-Fetch-Dest: document' \
  --header 'Sec-Fetch-Mode: navigate' \
  --header 'Sec-Fetch-Site: same-origin' \
  --header 'Sec-Fetch-User: ?1' \
  --header 'Upgrade-Insecure-Requests: 1' \
  --output /tmp/azul_step1_body_$$.html \
  "$REFERER"

echo "Status: $(head -1 /tmp/azul_step1_headers_$$.txt)"
echo "Cookies após Step 1:"
grep -i 'set-cookie' /tmp/azul_step1_headers_$$.txt | awk -F': ' '{print $2}' | cut -d';' -f1 | head -10

# Extrai URLs do Akamai do HTML da challenge page
CHALLENGE_SRC=$(grep -oP 'src="\K[^"]+(?=[^"]*[?&]v=[0-9a-f-]{36})' /tmp/azul_step1_body_$$.html 2>/dev/null | head -1 || echo "")
SENSOR_SRC=$(grep -oP 'src="\K/[^"?#]+(?=")' /tmp/azul_step1_body_$$.html 2>/dev/null | grep -v 'akamai\.com' | grep -v 'akam/' | tail -1 || echo "")
SEC_CPT_VERSION=$(echo "$CHALLENGE_SRC" | grep -oP '[?&]v=\K[0-9a-f-]{36}' || echo "a26c6d45-0648-38ce-e22c-7c0022030210")
CHALLENGE_TOKEN=$(echo "$CHALLENGE_SRC" | grep -oP '[?&]t=\K[0-9]+' || echo "")

[ -n "$CHALLENGE_SRC" ] && AKAMAI_CHALLENGE_URL="https://www.voeazul.com.br${CHALLENGE_SRC}" \
                        || AKAMAI_CHALLENGE_URL="${AKAMAI_CHALLENGE_BASE}?v=${SEC_CPT_VERSION}"
[ -n "$SENSOR_SRC" ]    && AKAMAI_SENSOR_URL="https://www.voeazul.com.br${SENSOR_SRC}"

echo ""
echo "→ sensorUrl extraido:    $AKAMAI_SENSOR_URL"
echo "→ challengeUrl extraido: $AKAMAI_CHALLENGE_URL"
echo "→ secCptVersion:         $SEC_CPT_VERSION"
echo "→ challengeToken:        $CHALLENGE_TOKEN"

# =============================================================================
# STEP 2: GET Akamai sensor script (URL extraida do HTML)
# O mesmo path serve como GET (retorna JS) e POST (recebe sensor_data).
# Tamanho tipico: ~534KB ofuscado.
#
# azul.service.ts: fetchAkamScript()
# =============================================================================
echo ""
echo "=== STEP 2: GET Akamai sensor script ==="

curl "${CURL_COMMON[@]}" \
  --dump-header /tmp/azul_step2_headers_$$.txt \
  --header 'Accept: */*' \
  --header "Referer: $REFERER" \
  --header 'Sec-Fetch-Dest: script' \
  --header 'Sec-Fetch-Mode: no-cors' \
  --header 'Sec-Fetch-Site: same-origin' \
  --output /tmp/azul_step2_akam_script_$$.js \
  "$AKAMAI_SENSOR_URL"

echo "Status: $(head -1 /tmp/azul_step2_headers_$$.txt)"
echo "Tamanho do script Akamai: $(wc -c < /tmp/azul_step2_akam_script_$$.js) bytes"

# =============================================================================
# STEP 3: GET /_sec/cpr/params
# Confirma/atualiza a URL do challenge extraida do HTML (sem o &t= token).
# Resposta: {"url": "/SwPv7g/.../Xx8r?v=<uuid>"}
#
# Nota: o &t= (challenge token) SÓ vem do HTML do Step 1 — nao aparece aqui.
#
# azul.service.ts: resolveSecCpt()
# =============================================================================
echo ""
echo "=== STEP 3: GET /_sec/cpr/params ==="

SEC_CPR_RESPONSE=$(curl "${CURL_COMMON[@]}" \
  --dump-header /tmp/azul_step3_headers_$$.txt \
  --header 'Accept: */*' \
  --header "Referer: $REFERER" \
  --header 'Sec-Fetch-Dest: empty' \
  --header 'Sec-Fetch-Mode: cors' \
  --header 'Sec-Fetch-Site: same-origin' \
  'https://www.voeazul.com.br/_sec/cpr/params')

echo "Resposta: $SEC_CPR_RESPONSE"
SEC_CPT_PATH=$(echo "$SEC_CPR_RESPONSE" | grep -oP '"url"\s*:\s*"\K[^"]+' || echo "")
[ -n "$SEC_CPT_PATH" ] && echo "→ path confirmado: $SEC_CPT_PATH" \
                       || echo "→ sem path (challenge nao ativo)"

# =============================================================================
# STEP 4: GET script do SEC-CPT challenge
# URL = /SwPv7g/.../Xx8r?v=<uuid>&t=<token>
# O &t= token vem do HTML do Step 1 — e OBRIGATORIO para obter o script correto.
# Tamanho tipico: ~432KB ofuscado com proof-of-work puzzle.
#
# azul.service.ts: resolveSecCpt() Step 4
# =============================================================================
if [ -n "$SEC_CPT_PATH" ]; then
  echo ""
  echo "=== STEP 4: GET SEC-CPT challenge script ==="

  # Monta URL com versao e token (token SÓ disponivel pelo HTML do Step 1)
  SEC_CPT_BASE_PATH=$(echo "$SEC_CPT_PATH" | cut -d'?' -f1)
  SEC_CPT_FULL_URL="https://www.voeazul.com.br${SEC_CPT_BASE_PATH}?v=${SEC_CPT_VERSION}${CHALLENGE_TOKEN:+&t=${CHALLENGE_TOKEN}}"
  echo "→ URL: $SEC_CPT_FULL_URL"

  curl "${CURL_COMMON[@]}" \
    --header "Referer: $REFERER" \
    --header 'Sec-Fetch-Dest: script' \
    --header 'Sec-Fetch-Mode: no-cors' \
    --header 'Sec-Fetch-Site: same-origin' \
    --output /tmp/azul_step4_seccpt_$$.js \
    "$SEC_CPT_FULL_URL"

  echo "SEC-CPT script size: $(wc -c < /tmp/azul_step4_seccpt_$$.js) bytes"

  # =============================================================================
  # STEP 5: POST solucao SEC-CPT
  # NENHUMA IMPLEMENTACAO CURL POSSIVEL SEM EXECUTAR O JS
  # O script do step 4 calcula um hash/proof-of-work que precisa ser enviado aqui.
  # No codigo TS isso esta marcado como TODO: vm2/isolated-vm/hyper-sdk
  #
  # azul.service.ts:201-231
  # =============================================================================
  echo ""
  echo "=== STEP 5: POST SEC-CPT solution ==="
  echo "AVISO: Requer execucao do JS do Step 4 pra gerar o body."
  echo "O crawler TS lanca erro aqui (generateSecCptSolution nao implementado)."
  echo "Body esperado: {\"body\": \"<encrypted_solution>\"}"
  echo ""
  echo "Para implementar:"
  echo "  - Opção 1: node -e com vm2/isolated-vm executando o script do Step 4"
  echo "  - Opção 2: hyper-sdk (resolver de proof-of-work Akamai)"
  echo "  - Opção 3: interceptar via Playwright o POST real e reutilizar"

  # PLACEHOLDER - descomentar quando tiver o solver:
  # SEC_CPT_POST_PATH=$(echo "$SEC_CPT_PATH" | cut -d'?' -f1)
  # curl "${CURL_COMMON[@]}" \
  #   --request POST \
  #   --header 'Content-Type: application/json' \
  #   --header 'Sec-Fetch-Dest: empty' \
  #   --header 'Sec-Fetch-Mode: cors' \
  #   --header 'Sec-Fetch-Site: same-origin' \
  #   --header "Origin: https://www.voeazul.com.br" \
  #   --header "Referer: $REFERER" \
  #   --data '{"body":"<SOLUCAO_CALCULADA>"}' \
  #   "https://www.voeazul.com.br${SEC_CPT_POST_PATH}"
fi

# =============================================================================
# STEP 6: POST sensor_data ao Akamai
#
# sensor_data e uma string gigante gerada pelo script JS do Akamai rodando
# no browser real. Contem fingerprint de canvas, WebGL, audio, timing, etc.
#
# SEM PLAYWRIGHT/BROWSER: impossivel gerar um sensor_data valido.
# Com sensor invalido, o Akamai retorna 200 mas com cookie _abck sinalizando
# bot - e a API da Azul vai retornar 403 ou 429 depois.
#
# azul.service.ts:247-280
#
# Para testar manualmente:
#   1. Abra voeazul.com.br no Chrome com DevTools
#   2. Aba Network -> filtrar por "1dTvmnOv4"
#   3. Clique no POST, va em Payload, copie o sensor_data
#   4. Cole abaixo e execute esse step
# =============================================================================
echo ""
echo "=== STEP 6: POST sensor_data ao Akamai ==="

SENSOR_DATA="${SENSOR_DATA:-}"  # Setar via env: SENSOR_DATA="<string do browser>"

if [ -z "$SENSOR_DATA" ]; then
  echo "AVISO: SENSOR_DATA nao definido. Pulando Step 6."
  echo "Para capturar: abra DevTools no Chrome, filtre por '1dTvmnOv4', copie o POST payload."
else
  SENSOR_RESPONSE=$(curl "${CURL_COMMON[@]}" \
    --dump-header /tmp/azul_step6_headers_$$.txt \
    --request POST \
    --header 'Accept: */*' \
    --header 'Content-Type: text/plain;charset=UTF-8' \
    --header "Origin: https://www.voeazul.com.br" \
    --header "Referer: $REFERER" \
    --header 'Sec-Fetch-Dest: empty' \
    --header 'Sec-Fetch-Mode: cors' \
    --header 'Sec-Fetch-Site: same-origin' \
    --data "{\"sensor_data\": \"$SENSOR_DATA\"}" \
    "$AKAMAI_SENSOR_URL")

  echo "Sensor POST response: $SENSOR_RESPONSE"
  echo "Cookies apos sensor:"
  cat "$COOKIE_JAR" | awk '!/^#/ && NF {print $6}' | tr '\n' ', '
  echo ""
fi

# =============================================================================
# STEP 7: POST token (obtém Bearer)
# azul.service.ts:400-438
# =============================================================================
echo ""
echo "=== STEP 7: POST token ==="

TOKEN_RESPONSE=$(curl "${CURL_COMMON[@]}" \
  --dump-header /tmp/azul_step7_headers_$$.txt \
  --request POST \
  --header 'Accept: application/json, text/plain, */*' \
  --header 'Content-Length: 0' \
  --header 'Culture: pt-BR' \
  --header 'Device: novosite' \
  --header 'Ocp-Apim-Subscription-Key: fb38e642c899485e893eb8d0a373cc17' \
  --header "Origin: https://www.voeazul.com.br" \
  --header 'Priority: u=1, i' \
  --header 'Referer: https://www.voeazul.com.br/' \
  --header 'Sec-Fetch-Dest: empty' \
  --header 'Sec-Fetch-Mode: cors' \
  --header 'Sec-Fetch-Site: same-site' \
  --data '' \
  'https://b2c-api.voeazul.com.br/authentication/api/authentication/v1/token')

echo "Token response: $TOKEN_RESPONSE"

BEARER=$(echo "$TOKEN_RESPONSE" | grep -oP '"(data|access_token)"\s*:\s*"\K[^"]+' | head -1 || echo "")
echo "Bearer token: ${BEARER:0:50}..."

# =============================================================================
# STEP 8a: POST sensor de novo (por flight request)
# azul.service.ts:477-478
# =============================================================================
if [ -n "$SENSOR_DATA" ] && [ -n "$BEARER" ]; then
  echo ""
  echo "=== STEP 8a: POST sensor de novo ==="
  curl "${CURL_COMMON[@]}" \
    --request POST \
    --header 'Content-Type: text/plain;charset=UTF-8' \
    --header "Origin: https://www.voeazul.com.br" \
    --header "Referer: $REFERER" \
    --header 'Sec-Fetch-Dest: empty' \
    --header 'Sec-Fetch-Mode: cors' \
    --header 'Sec-Fetch-Site: same-origin' \
    --data "{\"sensor_data\": \"$SENSOR_DATA\"}" \
    --output /dev/null \
    "$AKAMAI_SENSOR_URL"
  echo "OK"
fi

# =============================================================================
# STEP 8b: DELETE bookings
# azul.service.ts:481-489
# =============================================================================
if [ -n "$BEARER" ]; then
  echo ""
  echo "=== STEP 8b: DELETE bookings ==="
  curl "${CURL_COMMON[@]}" \
    --request DELETE \
    --header 'Accept: application/json, text/plain, */*' \
    --header "Authorization: Bearer $BEARER" \
    --header 'Culture: pt-BR' \
    --header 'Device: novosite' \
    --header 'Ocp-Apim-Subscription-Key: fb38e642c899485e893eb8d0a373cc17' \
    --header "Origin: https://www.voeazul.com.br" \
    --header 'Referer: https://www.voeazul.com.br/' \
    --header 'Sec-Fetch-Dest: empty' \
    --header 'Sec-Fetch-Mode: cors' \
    --header 'Sec-Fetch-Site: same-site' \
    --output /tmp/azul_step8b_$$.json \
    'https://b2c-api.voeazul.com.br/reservationavailability/api/reservation/availability/v1/bookings' || true
  echo "DELETE bookings OK (ignorar erros)"

  # =============================================================================
  # STEP 8d: POST availability (busca de voos)
  # azul.service.ts:524-545
  # =============================================================================
  echo ""
  echo "=== STEP 8d: POST availability ==="

  AVAIL_PAYLOAD=$(cat <<EOF
{
  "criteria": [
    {
      "departureStation": "$ORIGIN",
      "arrivalStation": "$DEST",
      "std": "$STD_DATE",
      "departureDate": "$DATE"
    }
  ],
  "passengers": [
    {"type": "ADT", "count": "$ADULTS", "companionPass": false}
  ],
  "flexibleDays": {"daysToLeft": "0", "daysToRight": "0"},
  "currencyCode": "BRL"
}
EOF
)

  curl "${CURL_COMMON[@]}" \
    --request POST \
    --header 'Accept: application/json, text/plain, */*' \
    --header "Authorization: Bearer $BEARER" \
    --header 'Content-Type: application/json' \
    --header 'Culture: pt-BR' \
    --header 'Device: novosite' \
    --header 'Ocp-Apim-Subscription-Key: fb38e642c899485e893eb8d0a373cc17' \
    --header "Origin: https://www.voeazul.com.br" \
    --header 'Priority: u=1, i' \
    --header 'Referer: https://www.voeazul.com.br/' \
    --header 'Sec-Fetch-Dest: empty' \
    --header 'Sec-Fetch-Mode: cors' \
    --header 'Sec-Fetch-Site: same-site' \
    --data "$AVAIL_PAYLOAD" \
    --output /tmp/azul_flights_$$.json \
    'https://b2c-api.voeazul.com.br/reservationavailability/api/reservation/availability/v5/availability'

  echo ""
  echo "=== RESULTADO ==="
  if command -v jq &>/dev/null; then
    jq '.' /tmp/azul_flights_$$.json 2>/dev/null || cat /tmp/azul_flights_$$.json
  else
    cat /tmp/azul_flights_$$.json
  fi
fi

echo ""
echo "=== ARQUIVOS GERADOS ==="
ls -lh /tmp/azul_*_$$* 2>/dev/null || true
