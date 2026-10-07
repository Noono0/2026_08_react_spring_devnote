package com.example.devnote.document.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 문서 수정 요청 본문. 생성 요청(DocumentCreateRequest)과 같고, 두 값이 더 있다.
 *   versionNumber : 화면이 문서를 읽었을 때의 버전. 그사이 다른 곳에서 수정됐으면 409 충돌이 난다(낙관적 잠금).
 *   changeSummary : "무엇을 고쳤는지" 메모(선택). 이력 목록에 보인다.
 */
public record DocumentUpdateRequest(
    @NotBlank(message = "문서 제목은 필수입니다.")
    @Size(max = 200, message = "문서 제목은 200자 이하여야 합니다.")
    String documentTitle,

    Long thumbnailFileId,

    @Size(max = 20, message = "첨부파일은 최대 20개까지 등록할 수 있습니다.")
    List<Long> attachmentFileIds,

    // 태그는 앞뒤 공백·맨 앞 #을 지우고 대소문자를 무시해 중복을 없앤 뒤 저장한다(DocumentServiceImpl).
    @Size(max = 10, message = "태그는 최대 10개까지 붙일 수 있습니다.")
    // 21자까지 받는 이유: 맨 앞의 # 한 글자는 저장 전에 지워지기 때문(실제 태그는 20자 이하인지 Service가 다시 검사).
    List<@NotBlank(message = "빈 태그는 저장할 수 없습니다.") @Size(max = 21, message = "태그는 20자 이하여야 합니다.") String> tags,

    @NotNull(message = "문서 내용 JSON은 필수입니다.")
    JsonNode contentJson,

    @NotBlank(message = "문서 HTML은 필수입니다.")
    String contentHtml,

    @NotNull(message = "검색용 텍스트 값은 필수입니다.")
    String contentText,

    @NotNull(message = "문서 상태는 필수입니다.")
    DocumentStatus documentStatus,

    @NotNull(message = "문서 버전은 필수입니다.")
    Long versionNumber,

    @Size(max = 500, message = "변경 요약은 500자 이하여야 합니다.")
    String changeSummary
) {
    public List<String> normalizedTags() {
        return tags == null ? List.of() : tags;
    }

    public List<Long> normalizedAttachmentFileIds() {
        return attachmentFileIds == null ? List.of() : attachmentFileIds;
    }
}
