-- 공공데이터 API의 확인된 연도 자료를 저장해 장애와 재시작 중에도 사용한다.
-- Persist verified API year data for fallback during outages and restarts.
CREATE TABLE IF NOT EXISTS calendar_holiday_cache (
    holiday_year INT NOT NULL,
    content_json JSON NOT NULL,
    verified_date DATE NOT NULL COMMENT '한국 시간 기준 API 확인일',
    PRIMARY KEY (holiday_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='공공데이터 공휴일 연도별 저장본';
