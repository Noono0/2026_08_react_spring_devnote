package com.example.devnote.diagram.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 다이어그램 생성/수정 요청.
 *
 * 설계 메모: diagramModelJson 을 파싱된 객체가 아니라 "JSON 문자열 그대로" 받는다.
 * 백엔드가 노드/엣지 구조를 알 필요가 없고, 편집기 모델이 바뀌어도 서버를 고치지 않아도 된다.
 * 대신 서비스 계층에서 (1) 유효한 JSON인지 (2) 크기가 상한 이내인지 검증한다.
 */
public record DiagramSaveRequest(
    @NotBlank @Size(max = 200) String diagramTitle,
    @NotNull @Size(max = 1000) String diagramDescription,
    @NotNull DiagramType diagramType,
    @NotBlank @Size(max = 2_000_000) String diagramModelJson,
    @Size(max = 500) String changeSummary,
    /** 수정 시에만 보낸다. 낙관적 잠금 판정에 사용한다. */
    Long versionNumber
) {
    /** 모델 JSON 전체가 로그에 찍히지 않도록 요약만 남긴다. */
    @Override
    public String toString() {
        return "DiagramSaveRequest[diagramTitle=<omitted>, diagramType=" + diagramType
            + ", modelLength=" + (diagramModelJson == null ? 0 : diagramModelJson.length())
            + ", versionNumber=" + versionNumber + "]";
    }
}
