package com.example.devnote.poll.dto;

import java.time.Instant;
import java.util.List;

/**
 * 투표 한 건의 응답. 화면이 버튼·결과 표시를 정할 수 있도록 "지금 사용자 기준" 값까지 서버가 계산해 준다.
 *   status                 : 마감 시각까지 반영한 현재 상태(OPEN / CLOSED / RESULTS_PUBLISHED)
 *   totalSelections        : 모든 선택 수의 합(결과 비공개면 null)
 *   participantCount       : 투표한 사람 수(복수 선택이어도 한 사람은 1)
 *   participated / selectedOptionIds: 지금 사용자가 투표했는지, 무엇을 골랐는지
 *   resultsVisible         : 결과를 보여 줘도 되는지
 *   manageableByCurrentUser: 수정·마감 버튼을 보여 줄지(만든 사람 또는 관리자)
 *   deletableByCurrentUser : 삭제 버튼을 보여 줄지(관리자)
 * ★ 버튼 표시용 값일 뿐이며, 실제 요청이 오면 Service가 권한을 다시 검사한다.
 */
public record PollResponse(
    Long pollId,
    String question,
    String status,
    List<PollOptionResponse> options,
    Long totalSelections,
    long participantCount,
    boolean participated,
    List<Long> selectedOptionIds,
    boolean allowMultiple,
    int maxSelections,
    boolean realtimeResults,
    boolean resultsVisible,
    boolean manageableByCurrentUser,
    boolean deletableByCurrentUser,
    Long createdBy,
    String creatorName,
    Instant endsAt,
    Instant resultPublishedAt,
    Instant createdAt
) {}
