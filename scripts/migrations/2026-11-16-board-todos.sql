-- 개인 TODO는 공개 게시글과 분리한다. 기존 글과 회원 데이터는 변경하지 않는다.
-- Store private TODOs separately from public posts, preserving existing posts and members.
CREATE TABLE IF NOT EXISTS board_todos (
    todo_id BIGINT NOT NULL AUTO_INCREMENT,
    author_id BIGINT NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    version_number BIGINT NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (todo_id),
    KEY idx_board_todo_author_state (author_id, completed, created_at, todo_id),
    CONSTRAINT fk_board_todo_author FOREIGN KEY (author_id) REFERENCES members(member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='작성자 전용 TODO 게시판';
