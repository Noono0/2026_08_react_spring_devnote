-- ============================================================================
-- 학습용 초기 데이터 (서버가 켜질 때마다 schema.sql 다음에 실행된다 — application.yml의 spring.sql.init)
--
-- ★ INSERT IGNORE: 같은 기본 키(번호)의 행이 이미 있으면 오류 없이 건너뛴다.
--   그래서 여러 번 실행해도 데이터가 중복되지 않고, 사용자가 고친 내용도 덮어쓰지 않는다.
--   반대로 이 파일의 값을 바꿔도 이미 만들어진 DB에는 반영되지 않는다(새 DB에서만 적용).
-- ============================================================================

-- 회원. 1번은 서버 시작 시 슈퍼관리자(admin)로 채워진다(InitialSuperAdministratorInitializer).
-- 2~4번은 X-Member-Id 헤더로 "다른 회원인 척" 권한·소유권을 연습할 때 쓰는 계정이다.
INSERT IGNORE INTO members (member_id, email, member_name, member_role)
VALUES
    (1, 'user@example.com', '일반 사용자', 'USER'),
    (2, 'manager@example.com', '팀 관리자', 'USER'),
    (3, 'admin@example.com', '시스템 관리자', 'ADMIN'),
    (4, 'readonly@example.com', '조회 전용', 'USER');

-- 예전 버전에서 쓰던 역할 이름이 남아 있으면 USER로 정리한다(Java enum MemberRole에 없는 값이 있으면 조회 시 오류가 나기 때문).
UPDATE members SET member_role = 'USER' WHERE member_role NOT IN ('USER', 'ADMIN', 'SUPER_ADMIN');

-- 회원 등급표(관리자 화면에서 이름·기준 점수 변경 가능)
INSERT IGNORE INTO member_grades (grade_code, grade_name, minimum_points, sort_order) VALUES
    ('BRONZE', '브론즈', 0, 1),
    ('SILVER', '실버', 100, 2),
    ('GOLD', '골드', 500, 3),
    ('PLATINUM', '플래티넘', 1500, 4),
    ('DIAMOND', '다이아', 5000, 5);

-- 기능 권한 목록과 역할별 기본 허용 값(슈퍼관리자는 전부, 관리자는 일부)
INSERT IGNORE INTO permissions (permission_code, permission_name, permission_description) VALUES
    ('PORTFOLIO_EDIT', '포트폴리오 편집', '홈 소개와 포트폴리오 섹션을 편집합니다.'),
    ('HISTORY_EDIT', '업무 History 편집', '업무·트러블슈팅 글을 작성하고 관리합니다.'),
    ('POLL_MANAGE', '투표 관리', '투표를 생성하고 종료합니다.'),
    ('MEMBER_MANAGE', '회원 관리', '회원 상태·등급·역할을 관리합니다.'),
    ('GRADE_MANAGE', '등급 관리', '회원 등급 기준을 관리합니다.'),
    ('PERMISSION_MANAGE', '권한 관리', '역할별 기능 권한을 관리합니다.'),
    ('ANALYTICS_VIEW', '방문 통계 조회', '일간·월간 방문 통계를 확인합니다.');

INSERT IGNORE INTO role_permissions (member_role, permission_code, allowed_yn)
SELECT 'SUPER_ADMIN', permission_code, 'Y' FROM permissions;

INSERT IGNORE INTO role_permissions (member_role, permission_code, allowed_yn) VALUES
    ('ADMIN', 'POLL_MANAGE', 'Y'),
    ('ADMIN', 'MEMBER_MANAGE', 'Y'),
    ('ADMIN', 'ANALYTICS_VIEW', 'Y');

-- 예시 토픽 투표와 선택지
INSERT IGNORE INTO polls (poll_id, question, poll_status, created_by)
VALUES (1, '다음으로 추가했으면 하는 개발 도구는?', 'OPEN', 1);
INSERT IGNORE INTO poll_options (poll_option_id, poll_id, option_label, sort_order) VALUES
    (1, 1, 'JSON 비교기', 1),
    (2, 1, '정규식 테스터', 2),
    (3, 1, 'Cron 표현식 도우미', 3),
    (4, 1, 'JWT 디코더', 4);

-- 이전 단일 선택 테이블에 저장된 참여가 있으면 새 ballot 구조로 한 번만 옮깁니다.
INSERT IGNORE INTO poll_ballots (poll_id, visitor_key, member_id, voted_at)
SELECT poll_id, visitor_key, MAX(member_id), MIN(voted_at)
FROM poll_votes
GROUP BY poll_id, visitor_key;

INSERT IGNORE INTO poll_ballot_selections (poll_ballot_id, poll_option_id)
SELECT poll_ballot.poll_ballot_id, poll_vote.poll_option_id
FROM poll_votes poll_vote
JOIN poll_ballots poll_ballot
  ON poll_ballot.poll_id = poll_vote.poll_id
 AND poll_ballot.visitor_key = poll_vote.visitor_key;

-- 예시 문서. 1~3번은 React 연습장(PRACTICE), 101·102번은 포트폴리오 업무 History(HISTORY) 글이다.
-- JSON_OBJECT·JSON_ARRAY: 에디터 본문 JSON을 SQL에서 만드는 MySQL 함수.
INSERT IGNORE INTO documents (
    document_id, member_id, document_title, content_json, content_html, content_text,
    document_scope, document_status, version_number, view_count, use_yn
) VALUES
    (1, 1, 'React 상태 관리 연습', JSON_OBJECT('type','doc','content',JSON_ARRAY()), '<p>React 상태 관리 연습 문서입니다.</p>', 'React 상태 관리 연습 문서입니다.', 'PRACTICE', 'PUBLISHED', 1, 32, 'Y'),
    (2, 1, 'Spring Boot와 MyBatis 연동', JSON_OBJECT('type','doc','content',JSON_ARRAY()), '<p>MyBatis XML과 SQL 로그를 확인합니다.</p>', 'MyBatis XML과 SQL 로그를 확인합니다.', 'PRACTICE', 'DRAFT', 1, 15, 'Y'),
    (3, 2, 'Tiptap 이미지 붙여넣기', JSON_OBJECT('type','doc','content',JSON_ARRAY()), '<p>클립보드 이미지를 서버에 업로드합니다.</p>', 'Tiptap 이미지 붙여넣기', 'PRACTICE', 'PUBLISHED', 1, 51, 'Y'),
    (101, 1, '포트폴리오와 React 연습장을 하나의 프로젝트로 분리한 과정', JSON_OBJECT('type','doc','content',JSON_ARRAY()), '<p>공개 포트폴리오와 React 학습 라우트를 분리하면서 공통 메뉴와 권한 경계를 정리했습니다.</p>', '공개 포트폴리오와 React 학습 라우트를 분리한 과정', 'HISTORY', 'PUBLISHED', 1, 0, 'Y'),
    (102, 1, '세션 로그인과 슈퍼관리자 편집 권한 트러블슈팅', JSON_OBJECT('type','doc','content',JSON_ARRAY()), '<p>화면에서 버튼만 숨기지 않고 Controller와 Service에서도 권한을 검증한 내용을 정리할 예정입니다.</p>', '세션 로그인과 슈퍼관리자 편집 권한 트러블슈팅', 'HISTORY', 'DRAFT', 1, 0, 'Y');

-- 예시 포트폴리오 섹션(자기소개, 대표 프로젝트, 기술)
INSERT IGNORE INTO portfolio_sections (
    portfolio_section_id, section_type, content_mode, section_title, section_subtitle,
    content_json, content_html, content_text, layout_type, sort_order, visibility
) VALUES
    (1, 'PROFILE', 'HYBRID', '안녕하세요, 꾸준히 성장하는 개발자입니다.', 'React · Spring Boot · MyBatis',
     JSON_OBJECT('type','doc','content',JSON_ARRAY(JSON_OBJECT('type','paragraph','content',JSON_ARRAY(JSON_OBJECT('type','text','text','사용자의 문제를 이해하고 읽기 쉬운 코드로 해결하는 개발자를 지향합니다.'))))),
     '<p>사용자의 문제를 이해하고 읽기 쉬운 코드로 해결하는 개발자를 지향합니다.</p>',
     '사용자의 문제를 이해하고 읽기 쉬운 코드로 해결하는 개발자를 지향합니다.', 'HERO', 1, 'PUBLIC'),
    (2, 'PROJECT', 'HYBRID', 'DevNote React Learning Portfolio', '왕초보부터 고급까지 이어지는 React 학습 플랫폼',
     JSON_OBJECT('type','doc','content',JSON_ARRAY(JSON_OBJECT('type','paragraph','content',JSON_ARRAY(JSON_OBJECT('type','text','text','다양한 UI 상태와 비동기·오류 시나리오를 직접 실행하며 배우는 프로젝트입니다.'))))),
     '<p>다양한 UI 상태와 비동기·오류 시나리오를 직접 실행하며 배우는 프로젝트입니다.</p>',
     '다양한 UI 상태와 비동기·오류 시나리오를 직접 실행하며 배우는 프로젝트입니다.', 'FEATURED', 2, 'PUBLIC'),
    (3, 'SKILL', 'STRUCTURED', 'React & TypeScript', 'Frontend',
     JSON_OBJECT('type','doc','content',JSON_ARRAY(JSON_OBJECT('type','paragraph'))), '<p></p>', '', 'BADGE', 3, 'PUBLIC');
