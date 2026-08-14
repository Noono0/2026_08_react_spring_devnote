package com.example.devnote.portfolio.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@Entity
@Table(name = "portfolio_section_files")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PortfolioSectionFileEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "portfolio_section_file_id") private Long portfolioSectionFileId;
    @Column(name = "portfolio_section_id", nullable = false) private Long portfolioSectionId;
    @Column(name = "file_id", nullable = false) private Long fileId;
    @Column(name = "file_role", nullable = false, length = 30) private String fileRole;
    @Column(name = "sort_order", nullable = false) private Integer sortOrder;
    @Column(name = "created_at", nullable = false) private LocalDateTime createdAt;
}
