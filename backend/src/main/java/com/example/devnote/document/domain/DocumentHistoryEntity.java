package com.example.devnote.document.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

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
