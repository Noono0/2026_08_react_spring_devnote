package com.example.devnote.online.dto;

import com.example.devnote.online.domain.OnlineGameOption;

import java.util.List;

/**
 * 고를 수 있는 게임 목록(available=false는 화면에 "준비 중").
 * options·defaultOption: 방장이 고르는 게임 옵션(목표 타일·난이도 등). 옵션이 없는 게임은 빈 목록과 null
 */
public record OnlineGameTypeResponse(
    String code, String label, int minSeats, int maxSeats, boolean available, List<OnlineGameOption> options, String defaultOption
) {}
