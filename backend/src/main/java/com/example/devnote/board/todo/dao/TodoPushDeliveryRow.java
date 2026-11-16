package com.example.devnote.board.todo.dao;

import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class TodoPushDeliveryRow {
    private Long deliveryId;
    private Long reminderId;
    private Long subscriptionId;
    private Integer attempts;
    private String endpoint;
}
