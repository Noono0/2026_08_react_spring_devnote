package com.example.devnote.poll.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.List;

/** 투표 요청. 고른 선택지 번호 1~10개(각각 양수). 투표의 최대 선택 수와 중복 여부는 Service가 확인한다. */
public record PollVoteRequest(
    @NotNull @Size(min = 1, max = 10) List<@NotNull @Positive Long> optionIds
) {}
