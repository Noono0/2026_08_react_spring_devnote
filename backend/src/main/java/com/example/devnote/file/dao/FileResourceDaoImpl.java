package com.example.devnote.file.dao;

import com.example.devnote.file.dao.parameter.FileCreateParameter;
import com.example.devnote.file.dao.row.FileResourceRow;
import lombok.RequiredArgsConstructor;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

import java.util.Map;

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
}
