package com.example.devnote.ranking.controller;

import com.example.devnote.common.api.ApiResponse;
import com.example.devnote.ranking.dto.OnlineRankingEntryResponse;
import com.example.devnote.ranking.dto.OnlineRankingSearchCondition;
import com.example.devnote.ranking.dto.SoloGameRecordRequest;
import com.example.devnote.ranking.dto.SoloGameRecordResponse;
import com.example.devnote.ranking.dto.SoloRankingEntryResponse;
import com.example.devnote.ranking.dto.SoloRankingSearchCondition;
import com.example.devnote.ranking.service.GameRankingService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 게임 랭킹 API입니다. (/api/v1/game-rankings) 보기·등록 모두 누구나 할 수 있다.
 *
 *   GET  /online?gameType=OMOK&from=2026-10-01&to=2026-10-31  온라인 대전 승수 랭킹
 *   GET  /solo?gameCode=MINESWEEPER&difficulty=BEGINNER        혼자 하는 게임 최고 기록 랭킹
 *   POST /solo                                                혼자 하는 게임 기록 등록(비회원은 닉네임 필요)
 *
 * from·to는 한국 날짜(yyyy-MM-dd)이고, 둘 다 비우면 전체 기간이다.
 * 온라인 대전 결과는 이 API로 받지 않는다. 브라우저가 승패를 꾸밀 수 없게 게임이 끝날 때 서버가 직접 저장한다.
 */
@RestController
@RequestMapping("/api/v1/game-rankings")
@RequiredArgsConstructor
public class GameRankingController {
    private final GameRankingService gameRankingService;

    @GetMapping("/online")
    public ApiResponse<List<OnlineRankingEntryResponse>> getOnlineRanking(@Valid OnlineRankingSearchCondition condition) {
        return ApiResponse.success(gameRankingService.getOnlineRanking(condition));
    }

    @GetMapping("/solo")
    public ApiResponse<List<SoloRankingEntryResponse>> getSoloRanking(@Valid SoloRankingSearchCondition condition) {
        return ApiResponse.success(gameRankingService.getSoloRanking(condition));
    }

    @PostMapping("/solo")
    public ApiResponse<SoloGameRecordResponse> recordSoloGame(@Valid @RequestBody SoloGameRecordRequest request, HttpServletRequest servletRequest) {
        return ApiResponse.created(gameRankingService.recordSoloGame(request, servletRequest));
    }
}
