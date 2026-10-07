package com.example.devnote.document.dto;

/** 태그 필터 버튼에 보여 줄 태그 이름과 그 태그가 붙은 문서 수 */
public record DocumentTagCountResponse(String tagName, long documentCount) {
}
