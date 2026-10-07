package com.example.devnote.document.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * document_histories 테이블 구조(JPA 엔티티, 구조 확인용).
 * 문서를 수정할 때마다 "수정 전" 내용이 한 행씩 쌓인다. 문서 본문 컬럼을 그대로 복사해 두므로 예전 버전을 다시 볼 수 있다.
 * schema.sql에서 (document_id, version_number)가 UNIQUE라서 같은 버전 이력이 두 번 저장되지 않는다.
 */
@Getter
@Entity
@Table(name = "document_histories")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DocumentHistoryEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "document_history_id")
    private Long documentHistoryId;

    @Column(name = "document_id", nullable = false)
    private Long documentId;

    @Column(name = "version_number", nullable = false)
    private Long versionNumber;

    @Column(name = "thumbnail_file_id")
    private Long thumbnailFileId;

    @Column(name = "document_title", nullable = false, length = 200)
    private String documentTitle;

    @Column(name = "document_status", nullable = false, length = 30)
    private String documentStatus;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "content_json", nullable = false, columnDefinition = "json")
    private String contentJson;

    @Lob
    @Column(name = "content_html", nullable = false, columnDefinition = "longtext")
    private String contentHtml;

    @Lob
    @Column(name = "content_text", nullable = false, columnDefinition = "longtext")
    private String contentText;

    @Column(name = "change_summary", length = 500)
    private String changeSummary;

    @Column(name = "changed_by", nullable = false)
    private Long changedBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
