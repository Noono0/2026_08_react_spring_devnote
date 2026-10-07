package com.example.devnote.document.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 문서 생성 요청 본문(JSON). 프론트의 DocumentEditorPage가 보낸다.
 *
 * 각 필드 위의 검증 애너테이션은 Controller의 @Valid가 실행한다. 실패하면 message가 fieldErrors로 화면에 전달된다.
 *   @NotBlank: null·빈 문자열·공백 거부(문자열용)   @NotNull: null만 거부   @Size: 길이·개수 제한
 *
 * 본문을 세 가지 모양으로 받는 이유:
 *   contentJson = 에디터가 다시 열 때 쓰는 구조, contentHtml = 화면 표시용, contentText = 검색용 순수 글자
 *
 * ★ 작성자 번호는 받지 않는다. 서버가 로그인·현재 회원으로 정한다(남의 이름으로 쓰기 방지).
 */
public record DocumentCreateRequest(
    @NotBlank(message = "문서 제목은 필수입니다.")
    @Size(max = 200, message = "문서 제목은 200자 이하여야 합니다.")
    String documentTitle,

    // 대표 이미지로 쓸 업로드 파일 번호(없으면 null). 내 파일인지·이미지인지는 Service가 확인한다.
    Long thumbnailFileId,

    @Size(max = 20, message = "첨부파일은 최대 20개까지 등록할 수 있습니다.")
    List<Long> attachmentFileIds,

    // 태그는 앞뒤 공백·맨 앞 #을 지우고 대소문자를 무시해 중복을 없앤 뒤 저장한다(DocumentServiceImpl).
    @Size(max = 10, message = "태그는 최대 10개까지 붙일 수 있습니다.")
    // 목록 안의 각 글자에도 검증을 붙일 수 있다(List<@NotBlank String>). 21자까지 받는 이유: 맨 앞의 # 한 글자는 저장 전에 지워지기 때문.
    List<@NotBlank(message = "빈 태그는 저장할 수 없습니다.") @Size(max = 21, message = "태그는 20자 이하여야 합니다.") String> tags,

    @NotNull(message = "문서 내용 JSON은 필수입니다.")
    JsonNode contentJson,

    @NotBlank(message = "문서 HTML은 필수입니다.")
    String contentHtml,

    @NotNull(message = "검색용 텍스트 값은 필수입니다.")
    String contentText,

    @NotNull(message = "문서 상태는 필수입니다.")
    // enum 타입이라 "DRAFT"·"PUBLISHED"·"ARCHIVED" 외의 값이 오면 JSON 변환 단계에서 400이 된다.
    DocumentStatus documentStatus
) {
    /** 프론트가 tags를 아예 보내지 않으면 null이므로, Service가 null 검사 없이 쓰도록 빈 목록으로 바꿔 준다. */
    public List<String> normalizedTags() {
        return tags == null ? List.of() : tags;
    }

    public List<Long> normalizedAttachmentFileIds() {
        return attachmentFileIds == null ? List.of() : attachmentFileIds;
    }
}
