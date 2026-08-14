package com.example.devnote.file.dao.parameter;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FileCreateParameter {
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
