package com.example.devnote.file.dao;

import com.example.devnote.file.dao.parameter.FileCreateParameter;
import com.example.devnote.file.dao.row.FileResourceRow;

import java.util.List;

/** 업로드 파일 정보(file_resources 테이블) 접근 약속. 실제 파일 내용은 DB가 아니라 디스크(rootDirectory)에 있다. */
public interface FileResourceDao {
    void insertFile(FileCreateParameter parameter);
    FileResourceRow selectFileById(Long fileId);
    // TEMP → ACTIVE 등 상태 변경. 올린 사람(uploaderId)이 맞을 때만 바뀐다. 돌려주는 값 = 바뀐 행 수.
    int updateFileStatus(Long fileId, Long uploaderId, String fileStatus);
    // 정리 작업용: retentionMinutes분보다 오래됐고 어디에서도 쓰지 않는 TEMP 파일을 limit개까지.
    List<FileResourceRow> selectUnusedTemporaryFiles(long retentionMinutes, int limit);
    int markUnusedTemporaryFileDeleted(Long fileId, long retentionMinutes);
}
