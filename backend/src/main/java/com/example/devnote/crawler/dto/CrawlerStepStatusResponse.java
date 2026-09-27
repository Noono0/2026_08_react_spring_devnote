package com.example.devnote.crawler.dto;

/**
 * 단계별 실행의 진행 상태 한 줄.
 * status: PENDING(대기) · RUNNING(진행 중) · DONE(완료) · BLOCKED(막힘, 사용자 선택 대기) · WAITING(직접 처리 대기) · SKIPPED(건너뜀) · FAILED(실패)
 */
public record CrawlerStepStatusResponse(int index, String label, String status, String detail) {
}
