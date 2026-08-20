CREATE TABLE IF NOT EXISTS members (
    member_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '회원 식별자',
    login_id VARCHAR(100) NULL COMMENT '로그인 아이디',
    password_hash VARCHAR(500) NULL COMMENT 'PBKDF2 비밀번호 해시',
    email VARCHAR(200) NOT NULL COMMENT '로그인 이메일',
    member_name VARCHAR(100) NOT NULL COMMENT '회원 이름',
    member_role VARCHAR(30) NOT NULL COMMENT '회원 권한',
    grade_code VARCHAR(30) NOT NULL DEFAULT 'BRONZE' COMMENT '회원 등급',
    account_status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE, LOCKED 또는 WITHDRAWN',
    last_login_at DATETIME(6) NULL COMMENT '마지막 로그인 일시',
    use_yn CHAR(1) NOT NULL DEFAULT 'Y' COMMENT '사용 여부',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '생성 일시',
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '수정 일시',
    PRIMARY KEY (member_id),
    UNIQUE KEY uk_members_email (email),
    UNIQUE KEY uk_members_login_id (login_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='회원';

CREATE TABLE IF NOT EXISTS member_grades (
    grade_code VARCHAR(30) NOT NULL COMMENT 'BRONZE, SILVER, GOLD, PLATINUM 또는 DIAMOND',
    grade_name VARCHAR(50) NOT NULL COMMENT '표시 이름',
    minimum_points INT NOT NULL DEFAULT 0 COMMENT '등급 시작 포인트',
    sort_order INT NOT NULL DEFAULT 0 COMMENT '표시 순서',
    use_yn CHAR(1) NOT NULL DEFAULT 'Y' COMMENT '사용 여부',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '생성 일시',
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '수정 일시',
    PRIMARY KEY (grade_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='회원 등급';

CREATE TABLE IF NOT EXISTS permissions (
    permission_code VARCHAR(80) NOT NULL COMMENT '권한 코드',
    permission_name VARCHAR(100) NOT NULL COMMENT '권한 이름',
    permission_description VARCHAR(300) NULL COMMENT '권한 설명',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '생성 일시',
    PRIMARY KEY (permission_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='기능 권한';

CREATE TABLE IF NOT EXISTS role_permissions (
    member_role VARCHAR(30) NOT NULL COMMENT 'USER, ADMIN 또는 SUPER_ADMIN',
    permission_code VARCHAR(80) NOT NULL COMMENT '권한 코드',
    allowed_yn CHAR(1) NOT NULL DEFAULT 'Y' COMMENT '허용 여부',
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '수정 일시',
    PRIMARY KEY (member_role, permission_code),
    CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_code) REFERENCES permissions(permission_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='역할별 기능 권한';

CREATE TABLE IF NOT EXISTS visitor_events (
    visitor_event_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '방문 이벤트 식별자',
    visitor_key VARCHAR(64) NOT NULL COMMENT '세션 기반 익명 방문자 키',
    member_id BIGINT NULL COMMENT '로그인 회원 식별자',
    visited_path VARCHAR(500) NOT NULL COMMENT '방문 경로',
    visited_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '방문 일시',
    PRIMARY KEY (visitor_event_id),
    KEY idx_visitor_events_date_key (visited_at, visitor_key),
    KEY idx_visitor_events_member (member_id, visited_at),
    CONSTRAINT fk_visitor_events_member FOREIGN KEY (member_id) REFERENCES members(member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='사이트 방문 이력';

CREATE TABLE IF NOT EXISTS polls (
    poll_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '투표 식별자',
    question VARCHAR(300) NOT NULL COMMENT '투표 질문',
    poll_status VARCHAR(30) NOT NULL DEFAULT 'OPEN' COMMENT 'OPEN, CLOSED 또는 RESULTS_PUBLISHED',
    allow_multiple BOOLEAN NOT NULL DEFAULT FALSE COMMENT '복수 선택 허용 여부',
    max_selections INT NOT NULL DEFAULT 1 COMMENT '한 사람이 선택할 수 있는 최대 문항 수',
    realtime_results BOOLEAN NOT NULL DEFAULT TRUE COMMENT '투표 중 결과 공개 여부',
    ends_at DATETIME(6) NULL COMMENT '투표 자동 종료 일시(UTC)',
    result_published_at DATETIME(6) NULL COMMENT '최종 결과 공개 일시(UTC)',
    created_by BIGINT NOT NULL COMMENT '생성 회원 식별자',
    use_yn CHAR(1) NOT NULL DEFAULT 'Y' COMMENT '목록 노출 여부',
    deleted_by BIGINT NULL COMMENT '삭제 처리 관리자 식별자',
    deleted_at DATETIME(6) NULL COMMENT '소프트 삭제 일시',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '생성 일시',
    PRIMARY KEY (poll_id),
    KEY idx_polls_status_created (use_yn, poll_status, created_at),
    CONSTRAINT fk_polls_member FOREIGN KEY (created_by) REFERENCES members(member_id),
    CONSTRAINT fk_polls_deleted_member FOREIGN KEY (deleted_by) REFERENCES members(member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='개발자 투표';

CREATE TABLE IF NOT EXISTS developer_snippets (
    developer_snippet_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '개발자 코드 조각 식별자',
    member_id BIGINT NOT NULL COMMENT '소유 회원 식별자',
    snippet_title VARCHAR(200) NOT NULL COMMENT '코드 조각 제목',
    snippet_description VARCHAR(1000) NOT NULL DEFAULT '' COMMENT '설명',
    snippet_language VARCHAR(50) NOT NULL COMMENT '코드 언어',
    snippet_code LONGTEXT NOT NULL COMMENT '코드 본문',
    tags_json JSON NOT NULL COMMENT '태그 JSON 배열',
    favorite_yn CHAR(1) NOT NULL DEFAULT 'N' COMMENT '즐겨찾기 여부',
    use_yn CHAR(1) NOT NULL DEFAULT 'Y' COMMENT '사용 여부',
    deleted_at DATETIME(6) NULL COMMENT '휴지통 이동 일시',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '생성 일시',
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '수정 일시',
    PRIMARY KEY (developer_snippet_id),
    KEY idx_developer_snippets_member_list (member_id, use_yn, favorite_yn, updated_at),
    CONSTRAINT fk_developer_snippets_member FOREIGN KEY (member_id) REFERENCES members(member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='회원별 개발자 코드 조각';

CREATE TABLE IF NOT EXISTS poll_options (
    poll_option_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '투표 선택지 식별자',
    poll_id BIGINT NOT NULL COMMENT '투표 식별자',
    option_label VARCHAR(200) NOT NULL COMMENT '선택지',
    sort_order INT NOT NULL DEFAULT 0 COMMENT '표시 순서',
    PRIMARY KEY (poll_option_id),
    CONSTRAINT fk_poll_options_poll FOREIGN KEY (poll_id) REFERENCES polls(poll_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='투표 선택지';

CREATE TABLE IF NOT EXISTS poll_votes (
    poll_vote_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '투표 참여 식별자',
    poll_id BIGINT NOT NULL COMMENT '투표 식별자',
    poll_option_id BIGINT NOT NULL COMMENT '선택지 식별자',
    visitor_key VARCHAR(64) NOT NULL COMMENT '중복 참여 방지용 방문자 키',
    member_id BIGINT NULL COMMENT '로그인 회원 식별자',
    voted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '투표 일시',
    PRIMARY KEY (poll_vote_id),
    UNIQUE KEY uk_poll_votes_visitor (poll_id, visitor_key),
    CONSTRAINT fk_poll_votes_poll FOREIGN KEY (poll_id) REFERENCES polls(poll_id),
    CONSTRAINT fk_poll_votes_option FOREIGN KEY (poll_option_id) REFERENCES poll_options(poll_option_id),
    CONSTRAINT fk_poll_votes_member FOREIGN KEY (member_id) REFERENCES members(member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='투표 참여';

-- 한 번의 참여(ballot)에 여러 선택지를 담아 복수 선택과 재참여 방지를 함께 표현합니다.
CREATE TABLE IF NOT EXISTS poll_ballots (
    poll_ballot_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '투표 참여 묶음 식별자',
    poll_id BIGINT NOT NULL COMMENT '투표 식별자',
    visitor_key VARCHAR(64) NOT NULL COMMENT '중복 참여 방지용 방문자 키',
    member_id BIGINT NULL COMMENT '로그인 회원 식별자',
    voted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '투표 일시',
    PRIMARY KEY (poll_ballot_id),
    UNIQUE KEY uk_poll_ballots_visitor (poll_id, visitor_key),
    CONSTRAINT fk_poll_ballots_poll FOREIGN KEY (poll_id) REFERENCES polls(poll_id),
    CONSTRAINT fk_poll_ballots_member FOREIGN KEY (member_id) REFERENCES members(member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='사용자별 투표 참여 묶음';

CREATE TABLE IF NOT EXISTS poll_ballot_selections (
    poll_ballot_selection_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '선택 식별자',
    poll_ballot_id BIGINT NOT NULL COMMENT '투표 참여 묶음 식별자',
    poll_option_id BIGINT NOT NULL COMMENT '선택한 문항 식별자',
    PRIMARY KEY (poll_ballot_selection_id),
    UNIQUE KEY uk_poll_ballot_selections_option (poll_ballot_id, poll_option_id),
    CONSTRAINT fk_poll_ballot_selections_ballot FOREIGN KEY (poll_ballot_id) REFERENCES poll_ballots(poll_ballot_id),
    CONSTRAINT fk_poll_ballot_selections_option FOREIGN KEY (poll_option_id) REFERENCES poll_options(poll_option_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='복수 선택 투표 문항';

CREATE TABLE IF NOT EXISTS file_resources (
    file_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '파일 식별자',
    uploader_id BIGINT NOT NULL COMMENT '업로드 회원 식별자',
    original_file_name VARCHAR(500) NOT NULL COMMENT '원본 파일명',
    stored_file_name VARCHAR(200) NOT NULL COMMENT '저장 파일명',
    file_extension VARCHAR(30) NOT NULL COMMENT '확장자',
    mime_type VARCHAR(200) NOT NULL COMMENT 'MIME 타입',
    file_size BIGINT NOT NULL COMMENT '파일 크기',
    storage_path VARCHAR(1000) NOT NULL COMMENT '저장 경로',
    file_status VARCHAR(30) NOT NULL COMMENT '파일 상태',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '생성 일시',
    deleted_at DATETIME(6) NULL COMMENT '삭제 일시',
    PRIMARY KEY (file_id),
    KEY idx_file_resources_uploader_status (uploader_id, file_status),
    CONSTRAINT fk_file_resources_member FOREIGN KEY (uploader_id) REFERENCES members(member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='파일 메타데이터';

CREATE TABLE IF NOT EXISTS documents (
    document_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '문서 식별자',
    member_id BIGINT NOT NULL COMMENT '작성 회원 식별자',
    thumbnail_file_id BIGINT NULL COMMENT '썸네일 대표 이미지 파일 식별자',
    document_title VARCHAR(200) NOT NULL COMMENT '문서 제목',
    document_scope VARCHAR(30) NOT NULL DEFAULT 'PRACTICE' COMMENT 'PRACTICE 또는 HISTORY',
    document_status VARCHAR(30) NOT NULL COMMENT '문서 상태',
    content_json JSON NOT NULL COMMENT 'Tiptap 원본 JSON',
    content_html LONGTEXT NOT NULL COMMENT '화면 표시용 HTML',
    content_text LONGTEXT NOT NULL COMMENT '검색용 텍스트',
    version_number BIGINT NOT NULL DEFAULT 1 COMMENT '낙관적 잠금 버전',
    view_count BIGINT NOT NULL DEFAULT 0 COMMENT '조회 수',
    use_yn CHAR(1) NOT NULL DEFAULT 'Y' COMMENT '사용 여부',
    deleted_at DATETIME(6) NULL COMMENT '삭제 일시',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '생성 일시',
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '수정 일시',
    PRIMARY KEY (document_id),
    KEY idx_documents_member_status (member_id, document_status, use_yn),
    KEY idx_documents_scope_status (document_scope, document_status, use_yn),
    KEY idx_documents_updated_at (updated_at, document_id),
    KEY idx_documents_thumbnail_file (thumbnail_file_id),
    FULLTEXT KEY ft_documents_title_content (document_title, content_text),
    CONSTRAINT fk_documents_member FOREIGN KEY (member_id) REFERENCES members(member_id),
    CONSTRAINT fk_documents_thumbnail_file FOREIGN KEY (thumbnail_file_id) REFERENCES file_resources(file_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='문서';

CREATE TABLE IF NOT EXISTS document_histories (
    document_history_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '문서 이력 식별자',
    document_id BIGINT NOT NULL COMMENT '문서 식별자',
    version_number BIGINT NOT NULL COMMENT '저장 당시 버전',
    thumbnail_file_id BIGINT NULL COMMENT '저장 당시 썸네일 파일 식별자',
    document_title VARCHAR(200) NOT NULL COMMENT '문서 제목',
    document_status VARCHAR(30) NOT NULL COMMENT '문서 상태',
    content_json JSON NOT NULL COMMENT 'Tiptap 원본 JSON',
    content_html LONGTEXT NOT NULL COMMENT '화면 표시용 HTML',
    content_text LONGTEXT NOT NULL COMMENT '검색용 텍스트',
    change_summary VARCHAR(500) NULL COMMENT '변경 요약',
    changed_by BIGINT NOT NULL COMMENT '변경 회원 식별자',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '생성 일시',
    PRIMARY KEY (document_history_id),
    UNIQUE KEY uk_document_histories_version (document_id, version_number),
    CONSTRAINT fk_document_histories_document FOREIGN KEY (document_id) REFERENCES documents(document_id),
    CONSTRAINT fk_document_histories_thumbnail_file FOREIGN KEY (thumbnail_file_id) REFERENCES file_resources(file_id),
    CONSTRAINT fk_document_histories_member FOREIGN KEY (changed_by) REFERENCES members(member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='문서 변경 이력';

CREATE TABLE IF NOT EXISTS document_files (
    document_file_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '문서 파일 연결 식별자',
    document_id BIGINT NOT NULL COMMENT '문서 식별자',
    file_id BIGINT NOT NULL COMMENT '파일 식별자',
    file_role VARCHAR(30) NOT NULL COMMENT 'EDITOR_IMAGE, ATTACHMENT 또는 THUMBNAIL',
    sort_order INT NOT NULL DEFAULT 0 COMMENT '표시 순서',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '생성 일시',
    PRIMARY KEY (document_file_id),
    UNIQUE KEY uk_document_files_document_file (document_id, file_id),
    CONSTRAINT fk_document_files_document FOREIGN KEY (document_id) REFERENCES documents(document_id),
    CONSTRAINT fk_document_files_file FOREIGN KEY (file_id) REFERENCES file_resources(file_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='문서 파일 연결';

CREATE TABLE IF NOT EXISTS portfolio_sections (
    portfolio_section_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '포트폴리오 섹션 식별자',
    section_type VARCHAR(30) NOT NULL COMMENT 'PROFILE, RICH_TEXT, EXPERIENCE, PROJECT 또는 SKILL',
    content_mode VARCHAR(30) NOT NULL COMMENT 'STRUCTURED, RICH_TEXT 또는 HYBRID',
    section_title VARCHAR(120) NOT NULL COMMENT '섹션 제목 또는 항목 제목',
    section_subtitle VARCHAR(200) NULL COMMENT '직무, 프로젝트 요약 또는 기술 분류',
    start_date DATE NULL COMMENT '경력 또는 프로젝트 시작일',
    end_date DATE NULL COMMENT '경력 또는 프로젝트 종료일',
    current_yn CHAR(1) NOT NULL DEFAULT 'N' COMMENT '현재 진행 여부',
    external_url VARCHAR(1000) NULL COMMENT '프로젝트 또는 외부 링크',
    thumbnail_file_id BIGINT NULL COMMENT '대표 이미지 파일 식별자',
    content_json JSON NOT NULL COMMENT 'Tiptap 원본 JSON',
    content_html LONGTEXT NOT NULL COMMENT '공개 화면 표시용 HTML',
    content_text LONGTEXT NOT NULL COMMENT '검색 및 미리보기용 텍스트',
    layout_type VARCHAR(30) NOT NULL DEFAULT 'DEFAULT' COMMENT '표시 레이아웃',
    sort_order INT NOT NULL DEFAULT 0 COMMENT '표시 순서',
    visibility VARCHAR(30) NOT NULL DEFAULT 'PUBLIC' COMMENT 'PUBLIC 또는 HIDDEN',
    version_number BIGINT NOT NULL DEFAULT 1 COMMENT '낙관적 잠금 버전',
    use_yn CHAR(1) NOT NULL DEFAULT 'Y' COMMENT '사용 여부',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '생성 일시',
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '수정 일시',
    PRIMARY KEY (portfolio_section_id),
    KEY idx_portfolio_sections_public_order (use_yn, visibility, sort_order, portfolio_section_id),
    KEY idx_portfolio_sections_thumbnail (thumbnail_file_id),
    CONSTRAINT fk_portfolio_sections_thumbnail FOREIGN KEY (thumbnail_file_id) REFERENCES file_resources(file_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='포트폴리오 페이지 섹션';

CREATE TABLE IF NOT EXISTS portfolio_section_files (
    portfolio_section_file_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '포트폴리오 섹션 파일 연결 식별자',
    portfolio_section_id BIGINT NOT NULL COMMENT '포트폴리오 섹션 식별자',
    file_id BIGINT NOT NULL COMMENT '파일 식별자',
    file_role VARCHAR(30) NOT NULL COMMENT 'EDITOR_IMAGE 또는 THUMBNAIL',
    sort_order INT NOT NULL DEFAULT 0 COMMENT '표시 순서',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '생성 일시',
    PRIMARY KEY (portfolio_section_file_id),
    UNIQUE KEY uk_portfolio_section_files (portfolio_section_id, file_id, file_role),
    CONSTRAINT fk_portfolio_section_files_section FOREIGN KEY (portfolio_section_id) REFERENCES portfolio_sections(portfolio_section_id),
    CONSTRAINT fk_portfolio_section_files_file FOREIGN KEY (file_id) REFERENCES file_resources(file_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='포트폴리오 섹션 파일 연결';

-- ============================================================================
-- 다이어그램 (ERD / UML / Flowchart / 시스템 구성도)
--
-- 설계 메모:
--  1) diagram_model 을 JSON 한 칸에 담는다.
--     노드·엣지를 별도 테이블로 정규화하면 조회 시 JOIN이 늘고, 저장할 때마다
--     delete-insert 가 필요하다. 다이어그램은 "통째로 읽고 통째로 저장"하는
--     사용 패턴이라 문서(documents.content_json)와 같은 방식이 더 단순하고 빠르다.
--     대신 "노드 단위 검색" 같은 쿼리는 못 한다 — 현재 요구사항에 없으므로 감수한다.
--  2) documents / document_histories 와 동일한 낙관적 잠금(version_number) 규약을 따른다.
--  3) soft delete(deleted_at)로 실수 삭제를 복구할 수 있게 한다.
-- ============================================================================
CREATE TABLE IF NOT EXISTS diagrams (
    diagram_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '다이어그램 식별자',
    member_id BIGINT NOT NULL COMMENT '소유 회원 식별자',
    diagram_title VARCHAR(200) NOT NULL COMMENT '다이어그램 제목',
    diagram_description VARCHAR(1000) NOT NULL DEFAULT '' COMMENT '설명',
    diagram_type VARCHAR(30) NOT NULL DEFAULT 'ERD' COMMENT 'ERD, FLOWCHART, UML, SYSTEM, GENERAL',
    diagram_model JSON NOT NULL COMMENT '노드와 엣지를 담은 편집기 모델 JSON',
    version_number BIGINT NOT NULL DEFAULT 1 COMMENT '낙관적 잠금 버전',
    use_yn CHAR(1) NOT NULL DEFAULT 'Y' COMMENT '사용 여부',
    deleted_at DATETIME(6) NULL COMMENT '휴지통 이동 일시',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '생성 일시',
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '수정 일시',
    PRIMARY KEY (diagram_id),
    KEY idx_diagrams_member_updated (member_id, use_yn, updated_at, diagram_id),
    KEY idx_diagrams_member_type (member_id, diagram_type, use_yn),
    CONSTRAINT fk_diagrams_member FOREIGN KEY (member_id) REFERENCES members(member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='다이어그램';

-- 다이어그램 수정 이력.
-- 저사양 서버를 고려해 "저장할 때마다 무조건 한 행"이 아니라
-- 직전 버전과 내용이 다를 때만 남기고, 다이어그램당 최대 보관 개수를 제한한다.
-- (보관 개수 제한은 DiagramServiceImpl 에서 수행한다)
CREATE TABLE IF NOT EXISTS diagram_versions (
    diagram_version_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '다이어그램 이력 식별자',
    diagram_id BIGINT NOT NULL COMMENT '다이어그램 식별자',
    version_number BIGINT NOT NULL COMMENT '저장 당시 버전',
    diagram_title VARCHAR(200) NOT NULL COMMENT '저장 당시 제목',
    diagram_type VARCHAR(30) NOT NULL COMMENT '저장 당시 종류',
    diagram_model JSON NOT NULL COMMENT '저장 당시 모델 JSON',
    change_summary VARCHAR(500) NULL COMMENT '변경 요약',
    changed_by BIGINT NOT NULL COMMENT '변경 회원 식별자',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '생성 일시',
    PRIMARY KEY (diagram_version_id),
    UNIQUE KEY uk_diagram_versions_version (diagram_id, version_number),
    KEY idx_diagram_versions_diagram_created (diagram_id, created_at, diagram_version_id),
    CONSTRAINT fk_diagram_versions_diagram FOREIGN KEY (diagram_id) REFERENCES diagrams(diagram_id),
    CONSTRAINT fk_diagram_versions_member FOREIGN KEY (changed_by) REFERENCES members(member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='다이어그램 변경 이력';
