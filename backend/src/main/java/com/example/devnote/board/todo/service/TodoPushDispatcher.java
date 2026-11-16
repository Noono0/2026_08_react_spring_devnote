package com.example.devnote.board.todo.service;

import com.example.devnote.board.todo.dao.TodoPushDao;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/** DB에 남은 기기별 발송을 짧게 점유한다. / Persist retries and claim each device delivery atomically. */
@Service @RequiredArgsConstructor @Slf4j
public class TodoPushDispatcher {
    private final TodoPushDao dao;
    private final WebPushTransport transport;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(Thread.ofPlatform().daemon(true).name("todo-push-", 0).factory());
    private final AtomicBoolean running = new AtomicBoolean();

    @Scheduled(fixedDelayString = "${application.todo-push.poll-interval-ms:10000}", initialDelayString = "${application.todo-push.initial-delay-ms:10000}")
    public void dispatch() {
        if (!transport.configured() || !running.compareAndSet(false, true)) return;
        // 네트워크 전송이 게임 등 기존 예약 작업을 막지 않도록 전용 스레드를 쓴다.
        // Keep network IO off the application's shared scheduling thread.
        executor.execute(() -> {
            try { dispatchAt(LocalDateTime.now(ZoneOffset.UTC)); }
            catch (RuntimeException exception) { log.error("TODO push dispatchError={}", exception.getClass().getSimpleName()); }
            finally { running.set(false); }
        });
    }

    @PreDestroy public void close() { executor.shutdownNow(); }

    public void dispatchAt(LocalDateTime now) {
        if (!transport.configured()) return;
        long started = System.nanoTime();
        dao.expire(now.minusDays(1));
        dao.enqueue(now, now.minusDays(1));
        for (long id : dao.due(now)) {
            LocalDateTime attemptNow = now.plusNanos(System.nanoTime() - started);
            String token = UUID.randomUUID().toString();
            if (dao.claim(id, attemptNow, attemptNow.plusMinutes(2), token) == 0) continue;
            var delivery = dao.target(id, token);
            // 중단된 작업의 점유를 회수해도 네트워크 발송은 3회를 넘기지 않는다.
            // Recovering an abandoned lease must not exceed three network attempts.
            if (delivery == null || delivery.getAttempts() > 3) { dao.finish(id, token, "FAILED", attemptNow); continue; }
            int code;
            try { code = transport.send(delivery); }
            catch (InterruptedException exception) { Thread.currentThread().interrupt(); return; }
            catch (Exception exception) {
                // 구독 URL·키·TODO 내용은 오류 메시지에도 남기지 않는다. / Never log capabilities or private content.
                log.warn("TODO push delivery={} transportError={}", id, exception.getClass().getSimpleName());
                code = 503;
            }
            boolean accepted = code >= 200 && code < 300;
            if (code == 404 || code == 410) dao.disableSubscription(delivery.getSubscriptionId());
            boolean retry = !accepted && (code == 429 || code >= 500) && delivery.getAttempts() < 3;
            dao.finish(id, token, accepted ? "SENT" : retry ? "PENDING" : "FAILED", attemptNow.plusMinutes(delivery.getAttempts() == 1 ? 1 : 5));
            if (!accepted) log.warn("TODO push delivery={} status={} retry={}", id, code, retry);
        }
        dao.settle();
    }
}
