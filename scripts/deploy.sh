#!/usr/bin/env bash
# ============================================================================
# 서버에 최신 이미지를 반영한다.
#
# ★ 전체 흐름에서 이 스크립트의 위치
#     코드 수정 → commit → push(main) → Actions 가 이미지 빌드 → [이 스크립트]
#
#   Actions 는 이미지를 "만들기만" 한다. 서버가 그걸 받아 가는 건 별개다.
#   이 스크립트가 서버에 접속해 pull 하고 컨테이너를 갈아 끼운다.
#
# ★ 서버 주소와 키는 환경변수로 넘긴다.
#   이 저장소는 공개되어 있어 서버 주소를 코드에 적지 않는다.
#
# 사용법
#   APP_HOST=ubuntu@<공인IP> APP_KEY=~/Downloads/<키파일> ./scripts/deploy.sh
#
# 자주 쓴다면 셸에 한 번만 export 해 두면 된다.
#   export APP_HOST=ubuntu@<공인IP>
#   export APP_KEY=~/Downloads/<키파일>
# ============================================================================
set -euo pipefail

APP_HOST="${APP_HOST:-}"
APP_KEY="${APP_KEY:-}"

if [ -z "$APP_HOST" ] || [ -z "$APP_KEY" ]; then
  cat >&2 <<USAGE
사용법:
  APP_HOST=ubuntu@<공인IP> APP_KEY=<키파일경로> $0

  APP_HOST  앱 서버 접속 주소
  APP_KEY   SSH 개인키 경로
USAGE
  exit 1
fi

[ -f "$APP_KEY" ] || { echo "오류: SSH 키가 없습니다 — $APP_KEY" >&2; exit 1; }

echo "▶ 서버에 접속해 최신 이미지를 반영합니다..."

ssh -i "$APP_KEY" -o BatchMode=yes "$APP_HOST" 'bash -s' <<'REMOTE'
set -e
cd ~

echo "── 새 이미지 받기 ──"
docker compose -f compose.app.yml --env-file .env.app pull

echo
echo "── 컨테이너 교체 ──"
docker compose -f compose.app.yml --env-file .env.app up -d

echo
echo "── 기동 대기 (최대 5분) ──"
# 1GB 서버라 백엔드 기동에 1분 안팎이 걸린다. 넉넉히 기다린다.
for i in $(seq 1 60); do
  status=$(docker inspect --format='{{.State.Health.Status}}' devnote-backend 2>/dev/null || echo "none")
  if [ "$status" = "healthy" ]; then
    echo "✅ 정상 기동 (약 $((i * 5))초)"
    break
  fi
  if [ "$i" = "60" ]; then
    echo "❌ 5분 안에 healthy 가 되지 않았습니다. 아래 로그를 확인하세요." >&2
    docker logs --tail 40 devnote-backend
    exit 1
  fi
  sleep 5
done

echo
docker ps --filter name=devnote --format 'table {{.Names}}\t{{.Status}}'

# 교체되고 남은 옛 이미지를 지운다. 45GB 디스크를 아끼기 위함이다.
echo
echo "── 옛 이미지 정리 ──"
docker image prune -f
REMOTE

echo
echo "✅ 반영 완료."
