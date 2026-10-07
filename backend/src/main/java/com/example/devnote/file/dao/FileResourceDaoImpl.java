package com.example.devnote.file.dao;

import com.example.devnote.file.dao.parameter.FileCreateParameter;
import com.example.devnote.file.dao.row.FileResourceRow;
import lombok.RequiredArgsConstructor;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;

/** FileResourceDao의 MyBatis 구현. FileResourceMapper.xml의 같은 id SQL을 실행한다. */
@Repository
@RequiredArgsConstructor
public class FileResourceDaoImpl implements FileResourceDao {
    private static final String NAMESPACE = "com.example.devnote.file.FileResourceMapper.";
    private final SqlSessionTemplate sqlSessionTemplate;

    @Override
    public void insertFile(FileCreateParameter parameter) {
        sqlSessionTemplate.insert(NAMESPACE + "insertFile", parameter);
    }

    @Override
    public FileResourceRow selectFileById(Long fileId) {
        return sqlSessionTemplate.selectOne(NAMESPACE + "selectFileById", fileId);
    }

    @Override
    public int updateFileStatus(Long fileId, Long uploaderId, String fileStatus) {
        return sqlSessionTemplate.update(
            NAMESPACE + "updateFileStatus",
            Map.of("fileId", fileId, "uploaderId", uploaderId, "fileStatus", fileStatus)
        );
    }

    @Override
    public List<FileResourceRow> selectUnusedTemporaryFiles(long retentionMinutes, int limit) {
        return sqlSessionTemplate.selectList(
            NAMESPACE + "selectUnusedTemporaryFiles",
            Map.of("retentionMinutes", retentionMinutes, "limit", limit)
        );
    }

    @Override
    public int markUnusedTemporaryFileDeleted(Long fileId, long retentionMinutes) {
        return sqlSessionTemplate.update(
            NAMESPACE + "markUnusedTemporaryFileDeleted",
            Map.of("fileId", fileId, "retentionMinutes", retentionMinutes)
        );
    }
}
