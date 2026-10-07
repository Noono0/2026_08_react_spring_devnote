package com.example.devnote.file.dao.parameter;

import lombok.Getter;
import lombok.Setter;

/**
 * 파일 정보 INSERT용 값 묶음.
 *   originalFileName: 사용자가 올린 이름(다운로드할 때 이 이름으로 돌려준다)
 *   storedFileName  : 디스크에 실제로 저장한 이름(무작위 UUID + 확장자). 같은 이름 덮어쓰기·경로 조작을 막는다.
 *   storagePath     : 디스크의 전체 경로
 *   fileStatus      : TEMP(업로드 직후) → ACTIVE(문서 등에 연결됨) → DELETED(정리됨)
 * fileId는 INSERT 후 MyBatis가 채운다(useGeneratedKeys).
 */
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
