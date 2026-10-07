package com.example.devnote.poll.dto;

/** 선택지 응답. votes는 결과를 볼 수 없는 상태면 null(아직 공개 안 됨)이다. 0과 구분하기 위해 Long을 쓴다. */
public record PollOptionResponse(Long optionId, String label, Long votes) {}
