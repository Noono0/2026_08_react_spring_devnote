package com.example.devnote.document.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * documents 테이블 구조를 적은 JPA 엔티티. 읽기·쓰기는 MyBatis가 하고, 이 클래스는 테이블 구조 확인용이다.
 * (개발: ddl-auto update로 빠진 컬럼 추가 / 운영: validate로 구조가 다르면 시작 중단 — MemberEntity 설명 참고)
 * ★ 컬럼을 바꿀 때는 schema.sql, 이 엔티티, DocumentMapper.xml, Row/Parameter/DTO를 함께 고친다.
 */
@Getter
@Entity
@Table(name = "documents")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DocumentEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "document_id")
    private Long documentId;

    @Column(name = "member_id", nullable = false)
    private Long memberId;

    @Column(name = "thumbnail_file_id")
    private Long thumbnailFileId;

    @Column(name = "document_title", nullable = false, length = 200)
    private String documentTitle;

    // PRACTICE = React 연습장 문서, HISTORY = 포트폴리오 업무 History 글. 같은 테이블을 범위로 나눠 쓴다.
    @Column(name = "document_scope", nullable = false, length = 30, columnDefinition = "varchar(30) default 'PRACTICE'")
    private String documentScope;

    // 에디터(Tiptap)가 만든 문서 구조 JSON. MySQL의 JSON 타입 컬럼이다.
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "content_json", nullable = false, columnDefinition = "json")
    private String contentJson;

    // 화면에 그대로 보여 줄 HTML. 길 수 있어 longtext(@Lob = 큰 데이터)로 둔다.
    @Lob
    @Column(name = "content_html", nullable = false, columnDefinition = "longtext")
    private String contentHtml;

    // 태그를 뺀 순수 글자. 본문 검색(LIKE)에 쓴다.
    @Lob
    @Column(name = "content_text", nullable = false, columnDefinition = "longtext")
    private String contentText;

    @Column(name = "document_status", nullable = false, length = 30)
    private String documentStatus;

    // 낙관적 잠금용 버전. 수정할 때마다 1씩 오른다.
    @Column(name = "version_number", nullable = false)
    private Long versionNumber;

    @Column(name = "view_count", nullable = false)
    private Long viewCount;

    // ★ 로컬 프로필(JPA_DDL_AUTO=update)에서는 Hibernate가 기동할 때마다 이 컬럼을 columnDefinition대로 다시 정의한다.
    //   여기에 default를 빼면 schema.sql의 DEFAULT 'Y'가 지워져 use_yn을 넣지 않는 INSERT가 실패한다.
    @Column(name = "use_yn", nullable = false, columnDefinition = "char(1) default 'Y'")
    private String useYn;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
