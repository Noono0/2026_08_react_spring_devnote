package com.example.devnote.online.domain;

import java.util.List;

/**
 * 끝난 한 판의 결과(랭킹 기록용). OnlineRoom이 게임이 끝날 때 만들고, OnlineRoomService가 방 잠금 밖에서 꺼내 저장한다.
 *
 *   players    : 게임을 시작할 때 자리에 앉아 있던 사람(중간에 나간 사람도 포함), 자리 순서 그대로
 *   won        : 이긴 사람이면 true. 무승부면 모두 false. 기권하거나 나간 사람은 이긴 팀이어도 false
 *   finishedAt : 끝난 시각(밀리초, UTC)
 */
public record OnlineMatchResult(OnlineGameType gameType, List<Player> players, long finishedAt) {
    /** memberId: 로그인 회원이면 회원 번호, 비회원이면 null */
    public record Player(Long memberId, String nickname, boolean won) {}
}
