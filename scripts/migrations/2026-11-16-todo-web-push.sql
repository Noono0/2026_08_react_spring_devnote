-- TODO 및 비회원 마이그레이션 적용 후 실행한다. 시간은 모두 UTC로 저장한다.
-- Run after the TODO and guest migrations. All reminder timestamps use UTC.
CREATE TABLE IF NOT EXISTS board_todo_reminders (
    reminder_id BIGINT NOT NULL AUTO_INCREMENT,
    todo_id BIGINT NOT NULL,
    scheduled_at DATETIME(6) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    PRIMARY KEY (reminder_id),
    UNIQUE KEY uk_todo_reminder_time (todo_id, scheduled_at),
    KEY idx_todo_reminder_due (status, scheduled_at),
    CONSTRAINT fk_todo_reminder_todo FOREIGN KEY (todo_id) REFERENCES board_todos(todo_id) ON DELETE CASCADE,
    CONSTRAINT ck_todo_reminder_status CHECK (status IN ('PENDING', 'SENT', 'CANCELLED', 'FAILED', 'EXPIRED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='TODO 알림 예약(UTC)';

CREATE TABLE IF NOT EXISTS board_todo_push_subscriptions (
    subscription_id BIGINT NOT NULL AUTO_INCREMENT,
    device_hash CHAR(64) NOT NULL,
    endpoint_hash CHAR(64) NOT NULL,
    endpoint VARCHAR(2048) NOT NULL,
    author_id BIGINT NULL,
    guest_id BIGINT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (subscription_id),
    UNIQUE KEY uk_todo_push_device (device_hash),
    UNIQUE KEY uk_todo_push_endpoint (endpoint_hash),
    KEY idx_todo_push_author (author_id, enabled),
    KEY idx_todo_push_guest (guest_id, enabled),
    CONSTRAINT fk_todo_push_author FOREIGN KEY (author_id) REFERENCES members(member_id),
    CONSTRAINT fk_todo_push_guest FOREIGN KEY (guest_id) REFERENCES board_todo_guests(guest_id),
    CONSTRAINT ck_todo_push_owner CHECK ((author_id IS NOT NULL AND guest_id IS NULL) OR (author_id IS NULL AND guest_id IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='브라우저별 웹 푸시 구독(비밀 정보 포함)';

CREATE TABLE IF NOT EXISTS board_todo_push_deliveries (
    delivery_id BIGINT NOT NULL AUTO_INCREMENT,
    reminder_id BIGINT NOT NULL,
    subscription_id BIGINT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    attempts INT NOT NULL DEFAULT 0,
    next_attempt_at DATETIME(6) NOT NULL,
    claim_token CHAR(36) NULL,
    PRIMARY KEY (delivery_id),
    UNIQUE KEY uk_todo_push_delivery (reminder_id, subscription_id),
    KEY idx_todo_push_delivery_due (status, next_attempt_at),
    CONSTRAINT fk_todo_delivery_reminder FOREIGN KEY (reminder_id) REFERENCES board_todo_reminders(reminder_id) ON DELETE CASCADE,
    CONSTRAINT fk_todo_delivery_subscription FOREIGN KEY (subscription_id) REFERENCES board_todo_push_subscriptions(subscription_id) ON DELETE CASCADE,
    CONSTRAINT ck_todo_delivery_status CHECK (status IN ('PENDING', 'SENT', 'FAILED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='알림별 기기별 발송 상태와 재시도';
