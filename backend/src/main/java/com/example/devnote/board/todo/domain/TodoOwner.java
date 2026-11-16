package com.example.devnote.board.todo.domain;

/** HTTP 요청에서 바인딩하지 않는다. 세션 또는 서버가 확인한 비회원 쿠키에서만 만든다. */
public record TodoOwner(Long memberId, Long guestId) {
    public TodoOwner {
        if ((memberId == null) == (guestId == null) || (memberId != null && memberId < 1) || (guestId != null && guestId < 1)) {
            throw new IllegalArgumentException("TODO 소유자는 회원 또는 비회원 중 하나여야 합니다.");
        }
    }
    public static TodoOwner member(long memberId) { return new TodoOwner(memberId, null); }
    public static TodoOwner guest(long guestId) { return new TodoOwner(null, guestId); }
}
