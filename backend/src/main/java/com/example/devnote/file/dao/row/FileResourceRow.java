package com.example.devnote.file.dao.row;

import lombok.Getter;
import lombok.Setter;

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
