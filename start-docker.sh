#!/bin/sh
set -e
if [ ! -f .env ]; then
  cp .env.example .env
  echo ".env 파일을 생성했습니다."
fi
docker compose up --build -d
docker compose ps
