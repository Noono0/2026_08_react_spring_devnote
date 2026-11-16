package com.example.devnote.board.todo.dao;

import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class TodoPushSubscriptionRow {
    private Long subscriptionId;
    private String deviceHash;
    private String endpointHash;
    private String endpoint;
    private Long authorId;
    private Long guestId;
    private Boolean enabled;
}
