-- 기존 게시글을 유지하면서 팝업의 메뉴·기간 설정 테이블을 추가한다.
-- Add popup targeting and schedule settings without changing existing posts.
CREATE TABLE IF NOT EXISTS board_popup_settings (
    post_id BIGINT NOT NULL,
    target_path VARCHAR(300) NOT NULL,
    include_children BOOLEAN NOT NULL DEFAULT FALSE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    PRIMARY KEY (post_id),
    KEY idx_board_popup_schedule (enabled, start_date, end_date),
    CONSTRAINT fk_board_popup_post FOREIGN KEY (post_id) REFERENCES board_posts(post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='메뉴·기간별 팝업 설정';
