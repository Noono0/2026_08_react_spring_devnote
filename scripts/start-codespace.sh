#!/usr/bin/env bash
# GitHub Codespaces에서 MySQL → Spring Boot → React(Vite)를 차례로 켭니다.
# 사용법: 저장소 루트에서 `bash scripts/start-codespace.sh`
#   - MySQL : compose.dev.yml (localhost:3306, devnote/devnote) — 백엔드 기본 접속 정보와 같다
#   - 백엔드 : 백그라운드 실행, 로그는 .local/codespace-backend.log
#   - 프론트 : 이 터미널에서 실행(Ctrl+C로 종료). 5173 포트가 열리면 Codespaces가 브라우저 탭을 연다.
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p .local

echo "[1/3] MySQL을 켭니다."
docker compose -f compose.dev.yml up -d --wait

echo "[2/3] Spring Boot 백엔드를 백그라운드로 켭니다. (로그: .local/codespace-backend.log)"
if ! curl -fsS http://localhost:8080/actuator/health > /dev/null 2>&1; then
  (cd backend && chmod +x gradlew && nohup ./gradlew bootRun > ../.local/codespace-backend.log 2>&1 &)
  # 첫 실행은 Gradle 의존성을 받느라 몇 분 걸릴 수 있다. 최대 5분 기다린다.
  for _ in $(seq 1 60); do
    if curl -fsS http://localhost:8080/actuator/health > /dev/null 2>&1; then break; fi
    sleep 5
  done
fi
if curl -fsS http://localhost:8080/actuator/health > /dev/null 2>&1; then
  echo "    백엔드가 준비됐습니다."
else
  echo "    백엔드가 아직 준비되지 않았습니다. .local/codespace-backend.log를 확인하세요. 프론트는 계속 켭니다."
fi

echo "[3/3] React 화면을 켭니다. 포트 탭에서 5173을 열면 됩니다. 로컬 초기 슈퍼관리자: admin / admin1234"
cd frontend
pnpm dev
