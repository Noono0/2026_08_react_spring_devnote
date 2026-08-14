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

    @Column(name = "document_scope", nullable = false, length = 30, columnDefinition = "varchar(30) default 'PRACTICE'")
    private String documentScope;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "content_json", nullable = false, columnDefinition = "json")
    private String contentJson;

    @Lob
    @Column(name = "content_html", nullable = false, columnDefinition = "longtext")
    private String contentHtml;

    @Lob
    @Column(name = "content_text", nullable = false, columnDefinition = "longtext")
    private String contentText;

    @Column(name = "document_status", nullable = false, length = 30)
    private String documentStatus;

    @Column(name = "version_number", nullable = false)
    private Long versionNumber;

    @Column(name = "view_count", nullable = false)
    private Long viewCount;

    @Column(name = "use_yn", nullable = false, columnDefinition = "char(1)")
    private String useYn;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
