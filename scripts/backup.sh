#!/usr/bin/env bash
# ============================================================================
# 백업 — MySQL 덤프 + 업로드 파일
#
# ★ 이 두 가지가 이 프로젝트의 전부다.
#   - MySQL: 회원·문서·다이어그램 등 모든 데이터
#   - storage 디렉터리: 업로드된 첨부파일·이미지 (DB에는 경로만 있다)
#   둘 중 하나만 빠져도 복구가 안 된다. 반드시 같이 받는다.
#
# 사용법
#   인스턴스 A(DB)에서:   ./scripts/backup.sh db
#   인스턴스 B(앱)에서:   ./scripts/backup.sh files
#   (구성상 두 인스턴스에 나뉘어 있으므로 각각 실행한다)
#
# 받은 파일은 서버에 두지 말고 로컬 PC 로 내려받아 보관할 것.
# 서버가 사라지면 백업도 같이 사라진다.
# ============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$HOME/devnote-backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

backup_database() {
  # .env.db 에서 접속 정보를 읽는다. 스크립트에 비밀번호를 적지 않기 위함이다.
  local env_file="${ENV_FILE:-.env.db}"
  if [[ ! -f "$env_file" ]]; then
    echo "오류: $env_file 을 찾을 수 없습니다." >&2
    exit 1
  fi
  # shellcheck disable=SC1090
  set -a; source "$env_file"; set +a

  local output="$BACKUP_DIR/mysql-$TIMESTAMP.sql.gz"
  echo "MySQL 덤프 중..."

  # --single-transaction: 테이블을 잠그지 않고 일관된 시점의 덤프를 뜬다.
  #                       (InnoDB 기준. 서비스 중단 없이 백업 가능)
  # --routines/--triggers: 프로시저·트리거도 함께 받는다.
  docker exec devnote-mysql mysqldump \
    -u root -p"$MYSQL_ROOT_PASSWORD" \
    --single-transaction --routines --triggers \
    "$MYSQL_DATABASE" | gzip > "$output"

  echo "완료: $output ($(du -h "$output" | cut -f1))"
}

backup_files() {
  local output="$BACKUP_DIR/storage-$TIMESTAMP.tar.gz"
  echo "업로드 파일 압축 중..."

  # 볼륨 내용을 임시 컨테이너로 읽어 tar 로 만든다.
  # 호스트에서 볼륨 경로를 직접 뒤지는 것보다 안전하고 이식성이 좋다.
  docker run --rm \
    -v devnote-app_devnote-file-storage:/data:ro \
    -v "$BACKUP_DIR":/backup \
    alpine tar czf "/backup/storage-$TIMESTAMP.tar.gz" -C /data .

  echo "완료: $output ($(du -h "$output" | cut -f1))"
}

prune_old_backups() {
  # 무료 인스턴스는 디스크가 넉넉하지 않다. 14일 지난 백업은 지운다.
  find "$BACKUP_DIR" -name "*.gz" -type f -mtime +14 -delete 2>/dev/null || true
}

case "${1:-}" in
  db)    backup_database; prune_old_backups ;;
  files) backup_files;    prune_old_backups ;;
  *)
    echo "사용법: $0 {db|files}" >&2
    echo "  db    - MySQL 덤프 (인스턴스 A 에서 실행)" >&2
    echo "  files - 업로드 파일 압축 (인스턴스 B 에서 실행)" >&2
    exit 1
    ;;
esac
