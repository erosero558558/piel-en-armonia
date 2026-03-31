#!/usr/bin/env bash
set -euo pipefail

SECRET_NAME="pielarmonia-secret"
SECRET_NAMESPACE="pielarmonia"
KUBECTL_BIN="${KUBECTL_BIN:-kubectl}"
KUBECTL_CONTEXT=""

usage() {
  cat <<'EOF'
Uso:
  bash ./ops/check-secrets.sh [--secret NAME] [--namespace NS] [--context CTX]

Valida el Secret real de Kubernetes y falla si detecta placeholders obvios
como `change-me`, `...`, sentinels `__PLACEHOLDER__` o valores vacios.

Variables opcionales:
  KUBECTL_BIN=kubectl
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --secret)
      SECRET_NAME="${2:-}"
      shift 2
      ;;
    --namespace)
      SECRET_NAMESPACE="${2:-}"
      shift 2
      ;;
    --context)
      KUBECTL_CONTEXT="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: argumento no reconocido: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if ! command -v "$KUBECTL_BIN" >/dev/null 2>&1; then
  echo "ERROR: kubectl no esta disponible en PATH." >&2
  exit 1
fi

BASE64_DECODE=()
if printf '%s' 'dGVzdA==' | base64 --decode >/dev/null 2>&1; then
  BASE64_DECODE=(base64 --decode)
elif printf '%s' 'dGVzdA==' | base64 -D >/dev/null 2>&1; then
  BASE64_DECODE=(base64 -D)
elif printf '%s' 'dGVzdA==' | base64 -d >/dev/null 2>&1; then
  BASE64_DECODE=(base64 -d)
else
  echo "ERROR: no se encontro una variante compatible de base64 para decodificar secretos." >&2
  exit 1
fi

normalize_value() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

placeholder_reason() {
  local normalized
  normalized="$(normalize_value "$1")"

  case "$normalized" in
    "")
      printf '%s' 'valor vacio'
      return 0
      ;;
    change-me|changeme)
      printf '%s' 'sentinel change-me'
      return 0
      ;;
    password|token|long-secret-token)
      printf '%s' 'placeholder generico'
      return 0
      ;;
    example.com|user@example.com|https://example.com/chat)
      printf '%s' 'placeholder example.com'
      return 0
      ;;
  esac

  if printf '%s' "$normalized" | grep -Eq '\.\.\.'; then
    printf '%s' 'ellipsis placeholder'
    return 0
  fi

  if printf '%s' "$normalized" | grep -Eq '^__.*__$'; then
    printf '%s' 'sentinel __PLACEHOLDER__'
    return 0
  fi

  return 1
}

decode_value() {
  printf '%s' "$1" | "${BASE64_DECODE[@]}" 2>/dev/null
}

kubectl_cmd=("$KUBECTL_BIN")
if [ -n "$KUBECTL_CONTEXT" ]; then
  kubectl_cmd+=(--context "$KUBECTL_CONTEXT")
fi

template='go-template={{range $k, $v := .data}}{{printf "%s=%s\n" $k $v}}{{end}}'

if ! raw_pairs="$("${kubectl_cmd[@]}" get secret "$SECRET_NAME" -n "$SECRET_NAMESPACE" -o "$template")"; then
  echo "ERROR: no se pudo leer secret/${SECRET_NAME} en namespace ${SECRET_NAMESPACE}." >&2
  exit 1
fi

if [ -z "$raw_pairs" ]; then
  echo "ERROR: secret/${SECRET_NAME} no expone claves en .data." >&2
  exit 1
fi

checked_count=0
failures=()

while IFS= read -r line; do
  [ -n "$line" ] || continue
  key="${line%%=*}"
  encoded="${line#*=}"

  if [ -z "$key" ] || [ -z "$encoded" ]; then
    failures+=("entrada invalida: ${line}")
    continue
  fi

  if ! value="$(decode_value "$encoded")"; then
    failures+=("${key}: base64 invalido")
    continue
  fi

  checked_count=$((checked_count + 1))

  if reason="$(placeholder_reason "$value")"; then
    failures+=("${key}: ${reason}")
  fi
done <<EOF
${raw_pairs}
EOF

if [ "${#failures[@]}" -gt 0 ]; then
  echo "ERROR: se detectaron placeholders en secret/${SECRET_NAME} (${SECRET_NAMESPACE})." >&2
  printf ' - %s\n' "${failures[@]}" >&2
  exit 1
fi

echo "OK: ${checked_count} claves revisadas en secret/${SECRET_NAME} (${SECRET_NAMESPACE}) sin placeholders obvios."
