-- 기존 달력 테이블에 종료일을 추가한다. 기존 날짜·게시글은 그대로 유지한다.
-- Add an end date without changing existing dates or posts.
-- 대상 DB를 먼저 선택한다. 이미 적용한 DB에서 다시 실행해도 컬럼을 중복 추가하지 않는다.
-- Select the target database first. Re-running this script does not duplicate the column.
SET @calendar_period_ddl = IF(
    EXISTS(SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'board_calendar_dates' AND column_name = 'event_end_date'),
    'SELECT 1',
    'ALTER TABLE board_calendar_dates ADD COLUMN event_end_date DATE NULL AFTER event_date'
);
PREPARE calendar_period_statement FROM @calendar_period_ddl;
EXECUTE calendar_period_statement;
DEALLOCATE PREPARE calendar_period_statement;
