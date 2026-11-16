#!/usr/bin/env bash
# 현재 공인 IP에 무료 인증서를 발급하고 기존 nginx 설정으로 HTTPS 파일을 준비한다.
# Issue a public-IP certificate and derive HTTPS config from the existing nginx config.
set -euo pipefail

source_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
app_directory="$(cd "${APP_DIRECTORY:-$HOME}" && pwd -P)"
tls_directory="$app_directory/devnote-tls"
public_ip="${PUBLIC_IP:?PUBLIC_IP is required}"
contact_email="${TLS_CONTACT_EMAIL:?TLS_CONTACT_EMAIL is required}"

python3 - "$public_ip" "$contact_email" <<'PY'
import ipaddress, sys
if not ipaddress.ip_address(sys.argv[1]).is_global or '@' not in sys.argv[2]:
    raise SystemExit('A public IP and operator contact email are required')
PY
command -v certbot >/dev/null
umask 077
mkdir -p "$tls_directory"

cat > "$tls_directory/auth.sh" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail
case "${CERTBOT_TOKEN:-}" in ''|*[!A-Za-z0-9_-]*) exit 1;; esac
printf '%s' "$CERTBOT_VALIDATION" | docker exec -i devnote-frontend sh -c \
  'umask 022; mkdir -p /usr/share/nginx/html/.well-known/acme-challenge; cat > "$1"; chmod 644 "$1"' sh \
  "/usr/share/nginx/html/.well-known/acme-challenge/$CERTBOT_TOKEN"
HOOK
cat > "$tls_directory/cleanup.sh" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail
case "${CERTBOT_TOKEN:-}" in ''|*[!A-Za-z0-9_-]*) exit 1;; esac
docker exec devnote-frontend rm -f -- "/usr/share/nginx/html/.well-known/acme-challenge/$CERTBOT_TOKEN"
HOOK
cat > "$tls_directory/reload.sh" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail
docker exec devnote-frontend nginx -t
docker exec devnote-frontend nginx -s reload
HOOK
chmod 700 "$tls_directory/auth.sh" "$tls_directory/cleanup.sh" "$tls_directory/reload.sh"

# 수동 플러그인도 인증·정리 훅을 저장하면 무인 갱신이 가능하다.
# Persisted authentication/cleanup hooks allow unattended renewal with the manual plugin.
sudo certbot certonly --non-interactive --agree-tos --email "$contact_email" \
  --preferred-profile shortlived --ip-address "$public_ip" --cert-name devnote-ip \
  --manual --preferred-challenges http \
  --manual-auth-hook "$tls_directory/auth.sh" --manual-cleanup-hook "$tls_directory/cleanup.sh" \
  --deploy-hook "$tls_directory/reload.sh"

python3 - "$source_root/frontend/nginx.conf" "$tls_directory/nginx.conf" <<'PY'
from pathlib import Path
import sys
source = Path(sys.argv[1]).read_text()
if source.count('listen 80;') != 1:
    raise SystemExit('Expected exactly one existing HTTP server')
secure = source.replace('listen 80;', '''listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/devnote-ip/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/devnote-ip/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;''', 1)
http = '''server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    location ^~ /.well-known/acme-challenge/ { try_files $uri =404; }
    location / { return 308 https://$host$request_uri; }
}
'''
Path(sys.argv[2]).write_text(http + secure)
PY
cp "$source_root/compose.https.yml" "$app_directory/compose.https.yml"
printf '%s\n' 'HTTPS certificate and nginx config prepared; use compose.app.yml + compose.https.yml to deploy.'
