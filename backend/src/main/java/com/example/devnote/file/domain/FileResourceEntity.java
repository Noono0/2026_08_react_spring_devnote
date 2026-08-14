package com.example.devnote.file.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@Entity
@Table(name = "file_resources")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class FileResourceEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "file_id")
    private Long fileId;

    @Column(name = "uploader_id", nullable = false)
    private Long uploaderId;

    @Column(name = "original_file_name", nullable = false, length = 500)
    private String originalFileName;

    @Column(name = "stored_file_name", nullable = false, length = 200)
    private String storedFileName;

    @Column(name = "file_extension", nullable = false, length = 30)
    private String fileExtension;

    @Column(name = "mime_type", nullable = false, length = 200)
    private String mimeType;

    @Column(name = "file_size", nullable = false)
    private Long fileSize;

    @Column(name = "storage_path", nullable = false, length = 1000)
    private String storagePath;

    @Column(name = "file_status", nullable = false, length = 30)
    private String fileStatus;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;
}
