package com.example.devnote.online.domain;

/**
 * 방장이 시작 전에 고르는 게임 옵션 하나(예: 2048 목표 타일 "512", 지뢰 찾기 난이도 "BEGINNER").
 *   code : 서버와 화면이 주고받는 값(방 상태·방 만들기·방 정보 수정에 그대로 쓴다)
 *   label: 화면에 보여 줄 한국어 이름
 * 게임마다 고를 수 있는 값과 처음 값은 OnlineGameType.getOptions()·getDefaultOption()에 모아 둔다.
 */
public record OnlineGameOption(String code, String label) {}
