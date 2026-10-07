package com.example.devnote.poll.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

/**
 * 투표 생성·수정 요청 본문.
 *   options       : 선택지 2~10개(각 200자 이하). 대소문자만 다른 중복은 Service가 거부한다.
 *   allowMultiple : 복수 선택 허용 여부. 허용하면 maxSelections는 2 이상, 아니면 반드시 1.
 *   realtimeResults: true면 투표 중에도 결과를 보여 주고, false면 결과 공개(RESULTS_PUBLISHED) 후에만 보여 준다.
 *   endsAt        : 마감 시각(선택). 비우면 지금부터 60분, 최대 60분까지 정할 수 있다.
 *                   Instant = 시간대가 없는 "세계 공통 시각". 프론트는 ISO 문자열(2026-10-05T03:00:00Z)로 보낸다.
 */
public record PollCreateRequest(
    @NotBlank @Size(max = 300) String question,
    @NotNull @Size(min = 2, max = 10) List<@NotBlank @Size(max = 200) String> options,
    @NotNull Boolean allowMultiple,
    @NotNull @Min(1) @Max(10) Integer maxSelections,
    @NotNull Boolean realtimeResults,
    Instant endsAt
) {}
