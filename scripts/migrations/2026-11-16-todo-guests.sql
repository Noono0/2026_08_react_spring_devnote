-- 먼저 2026-11-16-board-todos.sql을 적용한다. 회원 TODO는 보존하며 비회원 소유자를 추가한다.
-- Apply board-todos.sql first. Preserve member TODOs while adding guest ownership.
CREATE TABLE IF NOT EXISTS board_todo_guests (
    guest_id BIGINT NOT NULL AUTO_INCREMENT,
    token_hash CHAR(64) NOT NULL,
    public_id CHAR(36) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (guest_id),
    UNIQUE KEY uk_todo_guest_token (token_hash),
    UNIQUE KEY uk_todo_guest_public (public_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='TODO 비회원 쿠키의 해시와 공개 식별자';

SET @todo_guest_ddl = IF(
    EXISTS(SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'board_todos' AND column_name = 'guest_id'),
    'SELECT 1',
    'ALTER TABLE board_todos MODIFY COLUMN author_id BIGINT NULL, ADD COLUMN guest_id BIGINT NULL AFTER author_id,
        ADD KEY idx_board_todo_guest_state (guest_id, completed, created_at, todo_id),
        ADD CONSTRAINT fk_board_todo_guest FOREIGN KEY (guest_id) REFERENCES board_todo_guests(guest_id),
        ADD CONSTRAINT ck_board_todo_owner CHECK ((author_id IS NOT NULL AND guest_id IS NULL) OR (author_id IS NULL AND guest_id IS NOT NULL))'
);
PREPARE todo_guest_statement FROM @todo_guest_ddl;
EXECUTE todo_guest_statement;
DEALLOCATE PREPARE todo_guest_statement;
