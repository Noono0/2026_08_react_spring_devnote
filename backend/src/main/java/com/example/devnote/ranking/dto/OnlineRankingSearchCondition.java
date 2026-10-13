package com.example.devnote.ranking.dto;

import com.example.devnote.online.domain.OnlineGameType;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;

/**
 * 온라인 대전 랭킹 조건(쿼리 문자열). 예) ?gameType=OMOK&from=2026-10-01&to=2026-10-31
 * from·to는 한국 날짜이고 그날 전체를 포함한다. 비우면 그쪽 끝은 제한하지 않는다(둘 다 비우면 전체 기간).
 */
@Getter
@Setter
public class OnlineRankingSearchCondition {
    @NotNull
    private OnlineGameType gameType;

    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDate from;

    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDate to;
}
