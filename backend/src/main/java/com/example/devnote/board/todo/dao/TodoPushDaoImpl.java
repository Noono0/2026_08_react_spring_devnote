package com.example.devnote.board.todo.dao;

import com.example.devnote.board.todo.domain.TodoOwner;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

@Repository @RequiredArgsConstructor
public class TodoPushDaoImpl implements TodoPushDao {
    private static final String NAMESPACE = "com.example.devnote.board.TodoPushMapper.";
    private final SqlSessionTemplate sqlSession;
    @Override public TodoPushSubscriptionRow device(String deviceHash) { return sqlSession.selectOne(NAMESPACE + "device", deviceHash); }
    @Override public long countDevices(TodoOwner owner) { return sqlSession.selectOne(NAMESPACE + "countDevices", Map.of("owner", owner)); }
    @Override public void saveDevice(TodoPushSubscriptionRow row) { sqlSession.insert(NAMESPACE + "saveDevice", row); }
    @Override public void removeDevice(String deviceHash) { sqlSession.delete(NAMESPACE + "removeDevice", deviceHash); }
    @Override public void disableSubscription(long subscriptionId) { sqlSession.update(NAMESPACE + "disableSubscription", subscriptionId); }
    @Override public void enqueue(LocalDateTime now, LocalDateTime cutoff) { sqlSession.insert(NAMESPACE + "enqueue", Map.of("now", now, "cutoff", cutoff)); }
    @Override public void expire(LocalDateTime cutoff) { sqlSession.update(NAMESPACE + "expire", cutoff); }
    @Override public List<Long> due(LocalDateTime now) { return sqlSession.selectList(NAMESPACE + "due", now); }
    @Override public int claim(long deliveryId, LocalDateTime now, LocalDateTime leaseUntil, String claimToken) {
        return sqlSession.update(NAMESPACE + "claim", Map.of("deliveryId", deliveryId, "now", now, "leaseUntil", leaseUntil, "claimToken", claimToken));
    }
    @Override public TodoPushDeliveryRow target(long deliveryId, String claimToken) {
        return sqlSession.selectOne(NAMESPACE + "target", Map.of("deliveryId", deliveryId, "claimToken", claimToken));
    }
    @Override public void finish(long deliveryId, String claimToken, String status, LocalDateTime nextAttempt) {
        sqlSession.update(NAMESPACE + "finish", Map.of("deliveryId", deliveryId, "claimToken", claimToken, "status", status, "nextAttempt", nextAttempt));
    }
    @Override public void settle() { sqlSession.update(NAMESPACE + "settle"); }
    @Override public void clearGuestDeliveries(long guestId, long throughTodoId) {
        sqlSession.delete(NAMESPACE + "clearGuestDeliveries", Map.of("guestId", guestId, "throughTodoId", throughTodoId));
    }
}
