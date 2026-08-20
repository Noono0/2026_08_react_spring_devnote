#!/usr/bin/env bash
# ============================================================================
# 관리자 초기 비밀번호를 정하고, 서버의 .env.app 에 해시를 넣는다.
#
# ★ 비밀번호 자체는 이 PC 밖으로 나가지 않는다.
#   해시만 서버로 전송된다. 해시로는 원래 비밀번호를 되돌릴 수 없다.
#   (PBKDF2 600,000회 — MemberPasswordService.java 와 동일)
#
# ★ 서버 주소와 키 경로는 환경변수로 넘긴다.
#   이 저장소는 공개되어 있으므로 서버 주소를 코드에 적지 않는다.
#
# 사용법
#   APP_HOST=ubuntu@<공인IP> APP_KEY=~/Downloads/<키파일> \
#     ./scripts/set-admin-hash.sh "직접_정한_비밀번호"
#
# 매번 치기 번거로우면 셸에서 한 번만 export 해 두면 된다.
#   export APP_HOST=ubuntu@<공인IP>
#   export APP_KEY=~/Downloads/<키파일>
# ============================================================================
set -euo pipefail

PASSWORD="${1:-}"
APP_HOST="${APP_HOST:-}"
APP_KEY="${APP_KEY:-}"

usage() {
  cat >&2 <<USAGE
사용법:
  APP_HOST=ubuntu@<공인IP> APP_KEY=<키파일경로> $0 "새_비밀번호"

  APP_HOST  앱 서버(인스턴스 B) 접속 주소
  APP_KEY   그 서버의 SSH 개인키 경로
USAGE
  exit 1
}

[ -n "$PASSWORD" ] || { echo "오류: 비밀번호를 지정하세요." >&2; usage; }
[ -n "$APP_HOST" ] || { echo "오류: APP_HOST 가 없습니다." >&2; usage; }
[ -n "$APP_KEY" ]  || { echo "오류: APP_KEY 가 없습니다." >&2; usage; }

if [ ! -f "$APP_KEY" ]; then
  echo "오류: SSH 키를 찾을 수 없습니다 — $APP_KEY" >&2
  exit 1
fi

echo "해시 생성 중... (600,000회 반복이라 몇 초 걸립니다)"

# 해시를 만들어 곧바로 서버로 흘려보낸다. 화면에도 파일에도 남기지 않는다.
node "$(dirname "$0")/generate-admin-hash.mjs" "$PASSWORD" \
  | ssh -i "$APP_KEY" -o BatchMode=yes "$APP_HOST" '
      HASH="$(cat)"
      # 형식 검증 — 반복횟수:base64:base64
      if ! printf "%s" "$HASH" | grep -Eq "^[0-9]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$"; then
        echo "오류: 해시 형식이 올바르지 않습니다." >&2
        exit 1
      fi
      # | 를 구분자로 써서 해시 안의 / 와 충돌하지 않게 한다
      sed -i "s|^INITIAL_SUPER_ADMIN_PASSWORD_HASH=.*|INITIAL_SUPER_ADMIN_PASSWORD_HASH=${HASH}|" ~/.env.app
      chmod 600 ~/.env.app
      echo "서버 .env.app 갱신 완료"
    '

echo
echo "✅ 완료. 로그인 계정은 admin, 비밀번호는 방금 정하신 값입니다."
echo "   ★ 비밀번호를 잊으면 되돌릴 수 없습니다. 안전한 곳에 보관하세요."
