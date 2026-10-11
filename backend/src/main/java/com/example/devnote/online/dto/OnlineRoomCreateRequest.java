package com.example.devnote.online.dto;

import com.example.devnote.online.domain.OnlineGameType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * POST /api/v1/online/rooms 요청 본문.
 * 형식 검사는 여기(@Valid), "이 게임에서 고를 수 있는 인원인가" 같은 규칙 검사는 OnlineRoom이 한다.
 *
 * password: 비워 두면 비밀번호 없는 방. 넣으면 4~20자.
 * gameOption: 비워 두면 그 게임의 처음 옵션(OnlineGameType.getDefaultOption()). 옵션이 없는 게임은 비워 둔다.
 */
public record OnlineRoomCreateRequest(
    @NotBlank(message = "방 제목을 입력해 주세요.")
    @Size(max = 30, message = "방 제목은 30자 이하로 입력해 주세요.")
    String title,
    @NotNull(message = "게임을 골라 주세요.")
    OnlineGameType gameType,
    @Min(value = 1, message = "인원 수를 확인해 주세요.")
    @Max(value = 10, message = "인원 수를 확인해 주세요.")
    int seatCount,
    @Size(max = 20, message = "방 비밀번호는 20자 이하로 입력해 주세요.")
    String password,
    boolean membersOnly,
    @Size(max = 20, message = "게임 옵션을 확인해 주세요.")
    String gameOption
) {}
