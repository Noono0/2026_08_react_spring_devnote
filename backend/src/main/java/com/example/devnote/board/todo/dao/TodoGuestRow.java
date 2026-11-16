package com.example.devnote.board.todo.dao;

import lombok.Getter;
import lombok.Setter;

/** 비밀 쿠키 원문은 저장하지 않는다. publicId는 화면 캐시 구분용이며 인증에 사용하지 않는다. */
@Getter @Setter
public class TodoGuestRow {
    private Long guestId;
    private String tokenHash;
    private String publicId;
}
