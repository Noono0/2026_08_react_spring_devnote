package com.example.devnote.online.controller;

import com.example.devnote.common.api.ApiResponse;
import com.example.devnote.online.dto.OnlineGameTypeResponse;
import com.example.devnote.online.dto.OnlineRoomCreateRequest;
import com.example.devnote.online.dto.OnlineRoomCreatedResponse;
import com.example.devnote.online.dto.OnlineRoomSummaryResponse;
import com.example.devnote.online.service.OnlineRoomService;
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
 * 온라인 대전 대기실 API입니다. (/api/v1/online)
 *
 * 대기실(게임 목록·방 목록·방 만들기)은 평범한 HTTP로, 방 안의 실시간 일(자리·게임·채팅)은 WebSocket으로 한다.
 *   방 목록은 화면이 몇 초마다 다시 받아 온다(TanStack Query). 대기실 사람에게까지 실시간으로 보낼 필요는 없다.
 */
@RestController
@RequestMapping("/api/v1/online")
@RequiredArgsConstructor
public class OnlineRoomController {
    private final OnlineRoomService roomService;

    @GetMapping("/game-types")
    public ApiResponse<List<OnlineGameTypeResponse>> getGameTypes() {
        return ApiResponse.success(roomService.getGameTypes());
    }

    @GetMapping("/rooms")
    public ApiResponse<List<OnlineRoomSummaryResponse>> getRooms() {
        return ApiResponse.success(roomService.getRooms());
    }

    // POST /api/v1/online/rooms { "title": "한 판 해요", "gameType": "OMOK", "seatCount": 2, "password": "", "membersOnly": false }
    @PostMapping("/rooms")
    public ApiResponse<OnlineRoomCreatedResponse> createRoom(@Valid @RequestBody OnlineRoomCreateRequest request, HttpServletRequest servletRequest) {
        return ApiResponse.created(roomService.createRoom(request, servletRequest));
    }
}
