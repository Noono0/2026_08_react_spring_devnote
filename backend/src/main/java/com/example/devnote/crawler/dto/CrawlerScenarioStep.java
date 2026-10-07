package com.example.devnote.crawler.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.Valid;
import java.util.List;

/**
 * 단계별 실행의 한 단계.
 * 예) CLICK · TEXT · "로그인" / FILL · TEXT · "카페글 검색어 입력" · value="LH" / PRESS · value="Enter"
 *
 * 필드 설명
 *   type          : 무엇을 할지(GOTO 이동, CLICK, FILL 입력, PRESS 키, WAIT, WAIT_FOR, MANUAL 직접 처리,
 *                   COLLECT 목록 반복, SCROLL, NEXT_PAGE, CSV)
 *   targetMode    : 대상을 찾는 방법(TEXT 화면 글자 / SELECTOR CSS 선택자 / COORDINATE 화면 좌표)
 *   target, x, y  : 대상(글자·선택자) 또는 좌표
 *   value         : 입력할 글자·키 이름·대기 시간 등 단계마다 의미가 다른 값
 *   timeoutMillis : 이 단계에서 기다릴 최대 시간
 *   fields        : COLLECT(목록 반복) 단계에서 항목마다 추출할 값들
 */
public record CrawlerScenarioStep(
    @NotNull(message = "단계 종류를 선택해 주세요.")
    CrawlerStepType type,

    CrawlerTargetMode targetMode,

    @Size(max = 500, message = "단계 대상은 500자 이하여야 합니다.")
    String target,

    @Min(value = 0, message = "x 좌표는 0 이상이어야 합니다.")
    @Max(value = 5_000, message = "x 좌표가 너무 큽니다.")
    Double x,

    @Min(value = 0, message = "y 좌표는 0 이상이어야 합니다.")
    @Max(value = 5_000, message = "y 좌표가 너무 큽니다.")
    Double y,

    @Size(max = 2_000, message = "단계 값은 2,000자 이하여야 합니다.")
    String value,

    @Size(max = 200, message = "단계 메모는 200자 이하여야 합니다.")
    String memo,

    @Min(value = 0, message = "대기 시간은 0 이상이어야 합니다.")
    @Max(value = 600_000, message = "단계 대기 시간은 최대 10분입니다.")
    Integer timeoutMillis,
    @Size(max = 12, message = "반복 안의 추출 단계는 최대 12개입니다.")
    List<@Valid CrawlerFieldRequest> fields
) {
    // 빠진 값은 빈 문자열·TEXT로 채워, 실행 코드가 null 검사를 반복하지 않게 한다. fields만은 "설정 안 함"을 구분하려고 null을 유지한다.
    public CrawlerScenarioStep {
        targetMode = targetMode == null ? CrawlerTargetMode.TEXT : targetMode;
        target = target == null ? "" : target;
        value = value == null ? "" : value;
        memo = memo == null ? "" : memo;
        fields = fields == null ? null : List.copyOf(fields);
    }

    public CrawlerScenarioStep(CrawlerStepType type, CrawlerTargetMode targetMode, String target,
        Double x, Double y, String value, String memo, Integer timeoutMillis) {
        this(type, targetMode, target, x, y, value, memo, timeoutMillis, null);
    }

    /** 진행 표시와 실패 메시지에 쓰는 한 줄 설명. 비밀번호 같은 값은 그대로 보이도록 사용자가 선택한 정책을 따른다. */
    public String label() {
        String where = switch (targetMode) {
            case COORDINATE -> "(" + format(x) + ", " + format(y) + ")";
            case SELECTOR -> target.isBlank() ? "" : "선택자 " + target;
            case TEXT -> target.isBlank() ? "" : "'" + target + "'";
        };
        // switch 식(Java 14+): 각 경우의 값을 바로 돌려준다. enum의 모든 경우를 다루지 않으면 컴파일 오류가 나서 빠뜨림을 막아 준다.
        String text = switch (type) {
            case GOTO -> "이동 " + value;
            case CLICK -> "클릭 " + where;
            case FILL -> "입력 " + (where.isBlank() ? "(검색창 자동 탐색)" : where) + " ← \"" + value + "\"";
            case PRESS -> "키 " + value + (where.isBlank() ? "" : " @ " + where);
            case WAIT -> "대기 " + value + "ms";
            case WAIT_FOR -> "나타날 때까지 대기 " + where;
            case MANUAL -> "직접 처리" + (value.isBlank() ? "" : ": " + value);
            case COLLECT -> "목록 반복" + (fields == null ? "" : " · 하위 추출 " + fields.size() + "개");
            case SCROLL -> "스크롤 " + value + "px";
            case NEXT_PAGE -> "다음 페이지 " + where;
            case CSV -> "CSV 저장 준비 " + value;
        };
        return memo.isBlank() ? text.trim() : text.trim() + " — " + memo;
    }

    private static String format(Double value) {
        return value == null ? "?" : String.valueOf(Math.round(value));
    }
}
