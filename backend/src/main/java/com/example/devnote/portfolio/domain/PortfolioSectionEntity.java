package com.example.devnote.portfolio.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Entity
@Table(name = "portfolio_sections")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PortfolioSectionEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "portfolio_section_id") private Long portfolioSectionId;
    @Column(name = "section_type", nullable = false, length = 30) private String sectionType;
    @Column(name = "content_mode", nullable = false, length = 30) private String contentMode;
    @Column(name = "section_title", nullable = false, length = 120) private String sectionTitle;
    @Column(name = "section_subtitle", length = 200) private String sectionSubtitle;
    @Column(name = "start_date") private LocalDate startDate;
    @Column(name = "end_date") private LocalDate endDate;
    @Column(name = "current_yn", nullable = false, columnDefinition = "char(1)") private String currentYn;
    @Column(name = "external_url", length = 1000) private String externalUrl;
    @Column(name = "thumbnail_file_id") private Long thumbnailFileId;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "content_json", nullable = false, columnDefinition = "json") private String contentJson;
    @Column(name = "content_html", nullable = false, columnDefinition = "longtext") private String contentHtml;
    @Column(name = "content_text", nullable = false, columnDefinition = "longtext") private String contentText;
    @Column(name = "layout_type", nullable = false, length = 30) private String layoutType;
    @Column(name = "sort_order", nullable = false) private Integer sortOrder;
    @Column(name = "visibility", nullable = false, length = 30) private String visibility;
    @Column(name = "version_number", nullable = false) private Long versionNumber;
    @Column(name = "use_yn", nullable = false, columnDefinition = "char(1)") private String useYn;
    @Column(name = "created_at", nullable = false) private LocalDateTime createdAt;
    @Column(name = "updated_at", nullable = false) private LocalDateTime updatedAt;
}
