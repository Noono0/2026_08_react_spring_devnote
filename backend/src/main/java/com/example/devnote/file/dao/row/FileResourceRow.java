package com.example.devnote.file.dao.row;

import lombok.Getter;
import lombok.Setter;

/**
 * file_resources 한 행. storagePath(서버 내부 경로)가 들어 있으므로 API 응답으로 그대로 내보내지 않는다.
 * 응답은 FileUploadResponse·DocumentAttachmentResponse처럼 필요한 값만 담은 DTO로 바꿔 보낸다.
 */
@Getter
@Setter
public class FileResourceRow {
    private Long fileId;
    private Long uploaderId;
    private String originalFileName;
    private String storedFileName;
    private String fileExtension;
    private String mimeType;
    private Long fileSize;
    private String storagePath;
    private String fileStatus;
}
