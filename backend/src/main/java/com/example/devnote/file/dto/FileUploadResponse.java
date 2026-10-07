package com.example.devnote.file.dto;

/**
 * 업로드 결과. 프론트는 fileId를 기억해 두었다가 문서를 저장할 때 함께 보낸다.
 * contentUrl은 이미지일 때만 값이 있다(에디터에 <img src=contentUrl>로 바로 넣는다). 이미지가 아니면 null.
 */
public record FileUploadResponse(
    Long fileId,
    String originalFileName,
    String fileExtension,
    String mimeType,
    Long fileSize,
    String fileStatus,
    String downloadUrl,
    String contentUrl
) {
}
