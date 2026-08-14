package com.example.devnote.file.dao;

import com.example.devnote.file.dao.parameter.FileCreateParameter;
import com.example.devnote.file.dao.row.FileResourceRow;

public interface FileResourceDao {
    void insertFile(FileCreateParameter parameter);
    FileResourceRow selectFileById(Long fileId);
    int updateFileStatus(Long fileId, Long uploaderId, String fileStatus);
}
