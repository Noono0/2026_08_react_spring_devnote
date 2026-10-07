package com.example.devnote.document.dto;

/**
 * 문서가 어느 기능에 속하는지. 같은 documents 테이블을 두 기능이 나눠 쓴다.
 *   PRACTICE: React 연습장 문서(/api/v1/documents)
 *   HISTORY : 포트폴리오 업무 History 글(/api/v1/history)
 * Controller가 범위를 고정해 넘기므로, 한 API로 다른 범위의 글을 읽거나 고칠 수 없다.
 */
public enum DocumentScope {
    PRACTICE,
    HISTORY
}
