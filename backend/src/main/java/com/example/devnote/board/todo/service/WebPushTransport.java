package com.example.devnote.board.todo.service;

import com.example.devnote.board.todo.dao.TodoPushDeliveryRow;

/** 전송 응답은 푸시 서비스 접수를 뜻하며 기기 표시를 보장하지 않는다. / Acceptance is not a delivery receipt. */
public interface WebPushTransport {
    boolean configured();
    String publicKey();
    int send(TodoPushDeliveryRow delivery) throws Exception;
}
