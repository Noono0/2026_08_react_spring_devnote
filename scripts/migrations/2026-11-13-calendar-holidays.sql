-- 공식 공휴일 원본과 별개로 관리자가 추가하는 휴일을 보관한다.
-- Store administrator-added holidays separately from the official holiday snapshot.
CREATE TABLE IF NOT EXISTS calendar_holidays (
    holiday_id BIGINT NOT NULL AUTO_INCREMENT,
    holiday_date DATE NOT NULL,
    holiday_name VARCHAR(80) NOT NULL,
    holiday_kind VARCHAR(20) NOT NULL COMMENT 'PUBLIC, SUBSTITUTE, TEMPORARY, COMPANY',
    version_number BIGINT NOT NULL DEFAULT 1,
    PRIMARY KEY (holiday_id),
    UNIQUE KEY uk_calendar_holiday_date_name (holiday_date, holiday_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='관리자 추가 휴일';
