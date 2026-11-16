package com.example.devnote.board.todo.dao;

import com.example.devnote.board.todo.domain.TodoOwner;
import java.time.LocalDateTime;
import java.util.List;

public interface TodoPushDao {
    TodoPushSubscriptionRow device(String deviceHash);
    long countDevices(TodoOwner owner);
    void saveDevice(TodoPushSubscriptionRow row);
    void removeDevice(String deviceHash);
    void disableSubscription(long subscriptionId);
    void enqueue(LocalDateTime now, LocalDateTime cutoff);
    void expire(LocalDateTime cutoff);
    List<Long> due(LocalDateTime now);
    int claim(long deliveryId, LocalDateTime now, LocalDateTime leaseUntil, String claimToken);
    TodoPushDeliveryRow target(long deliveryId, String claimToken);
    void finish(long deliveryId, String claimToken, String status, LocalDateTime nextAttempt);
    void settle();
    void clearGuestDeliveries(long guestId, long throughTodoId);
}
