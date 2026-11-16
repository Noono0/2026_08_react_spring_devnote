package com.example.devnote.board.todo.push;

import com.example.devnote.board.todo.dao.TodoPushDeliveryRow;
import com.example.devnote.board.todo.service.TodoPushService;
import com.example.devnote.board.todo.service.WebPushTransport;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import jakarta.annotation.PreDestroy;

/** 본문 없는 웹 푸시: 개인 TODO 내용·브라우저 암호화 키를 수집하거나 전송하지 않는다.
 * Payload-free Web Push: no private TODO content or browser encryption keys are collected or sent. */
@Component @Slf4j
public class JdkWebPushTransport implements WebPushTransport {
    private final VapidAuthorization vapid;
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();

    public JdkWebPushTransport(@Value("${application.todo-push.public-key:}") String publicKey,
        @Value("${application.todo-push.private-key:}") String privateKey,
        @Value("${application.todo-push.subject:}") String subject, ObjectMapper json) {
        vapid = publicKey.isBlank() && privateKey.isBlank() && subject.isBlank() ? null : new VapidAuthorization(publicKey, privateKey, subject, json);
    }
    @Override public boolean configured() { return vapid != null; }
    @Override public String publicKey() { return vapid == null ? "" : vapid.publicKey(); }
    @PreDestroy public void close() { client.shutdownNow(); }
    @Override public int send(TodoPushDeliveryRow delivery) throws InterruptedException {
        if (vapid == null) return 503;
        try {
            var request = request(delivery, Instant.now());
            return client.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
        } catch (InterruptedException exception) { throw exception; }
        catch (Exception exception) {
            log.warn("TODO push delivery={} transportError={}", delivery.getDeliveryId(), exception.getClass().getSimpleName());
            return 503;
        }
    }
    public HttpRequest request(TodoPushDeliveryRow delivery, Instant now) throws Exception {
        if (vapid == null) throw new IllegalStateException("웹 푸시 설정이 필요합니다.");
        TodoPushService.validateEndpoint(delivery.getEndpoint());
        URI endpoint = URI.create(delivery.getEndpoint());
        return HttpRequest.newBuilder(endpoint).timeout(Duration.ofSeconds(10))
            .header("Authorization", vapid.header(endpoint, now)).header("TTL", "86400").header("Urgency", "normal")
            .header("Topic", "todo-" + delivery.getReminderId()).POST(HttpRequest.BodyPublishers.noBody()).build();
    }
}
