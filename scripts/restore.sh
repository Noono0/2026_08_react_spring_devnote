#!/usr/bin/env bash
# ============================================================================
# 복원 — 새 서버로 이사하거나 사고에서 복구할 때
#
# ★ 클라우드를 갈아탈 때의 전체 순서
#   1) 기존 서버에서 backup.sh db / backup.sh files 실행
#   2) 두 파일을 로컬 PC 로 내려받기 (scp)
#   3) 새 서버에 Docker 설치 + compose 파일과 .env 준비
#   4) DB 컨테이너를 먼저 띄우고 → restore.sh db
#   5) 앱 컨테이너를 띄우고 → restore.sh files
#
# 사용법
#   ./scripts/restore.sh db    ~/devnote-backups/mysql-20260820-101500.sql.gz
#   ./scripts/restore.sh files ~/devnote-backups/storage-20260820-101500.tar.gz
# ============================================================================
set -euo pipefail

restore_database() {
  local dump_file="$1"
  local env_file="${ENV_FILE:-.env.db}"

  [[ -f "$dump_file" ]] || { echo "오류: $dump_file 이 없습니다." >&2; exit 1; }
  [[ -f "$env_file" ]]  || { echo "오류: $env_file 이 없습니다." >&2; exit 1; }

  # shellcheck disable=SC1090
  set -a; source "$env_file"; set +a

  # ★ 기존 데이터를 덮어쓰는 작업이라 한 번 확인한다.
  echo "경고: '$MYSQL_DATABASE' 의 현재 데이터를 덮어씁니다."
  read -r -p "계속하려면 yes 를 입력하세요: " confirmation
  [[ "$confirmation" == "yes" ]] || { echo "취소했습니다."; exit 0; }

  echo "복원 중..."
  gunzip -c "$dump_file" | docker exec -i devnote-mysql \
    mysql -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"

  echo "완료. 백엔드를 재시작하세요:"
  echo "  docker compose -f compose.app.yml --env-file .env.app restart backend"
}

restore_files() {
  local archive_file="$1"
  [[ -f "$archive_file" ]] || { echo "오류: $archive_file 이 없습니다." >&2; exit 1; }

  echo "업로드 파일 복원 중..."
  # 볼륨에 풀어 넣는다. 같은 이름의 파일은 덮어쓰고, 없던 파일은 그대로 둔다.
  docker run --rm \
    -v devnote-app_devnote-file-storage:/data \
    -v "$(cd "$(dirname "$archive_file")" && pwd)":/backup:ro \
    alpine tar xzf "/backup/$(basename "$archive_file")" -C /data

  echo "완료."
}

case "${1:-}" in
  db)    restore_database "${2:?덤프 파일 경로를 지정하세요}" ;;
  files) restore_files    "${2:?압축 파일 경로를 지정하세요}" ;;
  *)
    echo "사용법: $0 {db|files} <파일경로>" >&2
    exit 1
    ;;
esac
