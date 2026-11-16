package com.example.devnote.board.todo.push;

import com.example.devnote.board.todo.dao.TodoPushDeliveryRow;
import com.example.devnote.board.todo.service.TodoPushService;
import com.example.devnote.common.logging.P6SpySqlFormatter;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.time.Instant;
import java.util.Base64;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class VapidAuthorizationTest {
    private final ObjectMapper json = new ObjectMapper();
    private static KeyPair keys() throws Exception {
        var generator = KeyPairGenerator.getInstance("EC"); generator.initialize(new ECGenParameterSpec("secp256r1")); return generator.generateKeyPair();
    }
    private static byte[] unsigned32(java.math.BigInteger number) {
        byte[] bytes = number.toByteArray(); byte[] padded = new byte[32]; int count = Math.min(32, bytes.length);
        System.arraycopy(bytes, bytes.length - count, padded, 32 - count, count); return padded;
    }
    private static String publicKey(KeyPair keys) {
        var point = ((ECPublicKey) keys.getPublic()).getW(); byte[] bytes = new byte[65]; bytes[0] = 4;
        System.arraycopy(unsigned32(point.getAffineX()), 0, bytes, 1, 32); System.arraycopy(unsigned32(point.getAffineY()), 0, bytes, 33, 32);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
    private static String privateKey(KeyPair keys) { return Base64.getUrlEncoder().withoutPadding().encodeToString(unsigned32(((ECPrivateKey) keys.getPrivate()).getS())); }

    @Test void signsStandardEs256ClaimsWithCorrectAudienceExpiryAndPublicKey() throws Exception {
        var keys = keys(); var vapid = new VapidAuthorization(publicKey(keys), privateKey(keys), "mailto:operator@example.com", json);
        var now = Instant.parse("2026-11-16T00:00:00Z");
        String value = vapid.header(URI.create("https://fcm.googleapis.com/wp/private-subscription"), now);
        String token = value.substring("vapid t=".length(), value.indexOf(", k=")); String[] parts = token.split("\\.");
        var claims = json.readTree(Base64.getUrlDecoder().decode(parts[1]));
        assertThat(claims.path("aud").asText()).isEqualTo("https://fcm.googleapis.com");
        assertThat(claims.path("exp").asLong()).isEqualTo(now.plusSeconds(43200).getEpochSecond());
        assertThat(claims.path("sub").asText()).isEqualTo("mailto:operator@example.com");
        var verifier = Signature.getInstance("SHA256withECDSAinP1363Format"); verifier.initVerify(keys.getPublic());
        verifier.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
        assertThat(verifier.verify(Base64.getUrlDecoder().decode(parts[2]))).isTrue();
        assertThat(value).endsWith(", k=" + publicKey(keys));
    }
    @Test void emitsAnEmptyPushRequestWithTtlAndNoPrivateTodoContent() throws Exception {
        var keys = keys(); var sender = new JdkWebPushTransport(publicKey(keys), privateKey(keys), "mailto:operator@example.com", json);
        try {
            var row = new TodoPushDeliveryRow(); row.setEndpoint("https://web.push.apple.com/private"); row.setReminderId(123L);
            var request = sender.request(row, Instant.now());
            assertThat(request.method()).isEqualTo("POST"); assertThat(request.bodyPublisher().orElseThrow().contentLength()).isZero();
            assertThat(request.headers().firstValue("TTL")).contains("86400");
            assertThat(request.headers().firstValue("Topic")).contains("todo-123");
            assertThat(request.headers().firstValue("Content-Encoding")).isEmpty();
        } finally { sender.close(); }
    }
    @Test void rejectsMismatchedKeysAndMalformedConfigurationWithoutEchoingSecrets() throws Exception {
        var first = keys(); var second = keys();
        assertThatThrownBy(() -> new VapidAuthorization(publicKey(first), privateKey(second), "mailto:operator@example.com", json))
            .isInstanceOf(IllegalStateException.class).hasMessageNotContaining(privateKey(second));
        assertThatThrownBy(() -> new VapidAuthorization("secret-public", "secret-private", "invalid", json)).hasMessageNotContaining("secret-private");
        var disabled = new JdkWebPushTransport("", "", "", json);
        try { assertThat(disabled.configured()).isFalse(); assertThat(disabled.publicKey()).isEmpty(); } finally { disabled.close(); }
    }
    @Test void rejectsPrivateUrlsRedirectTargetsAndFakeProviderSuffixes() {
        for (String url : new String[]{"http://fcm.googleapis.com/a", "https://127.0.0.1/a", "https://fcm.googleapis.com.attacker.test/a",
            "https://fcm.googleapis.com:8080/a", "https://user@fcm.googleapis.com/a", "https://fcm.googleapis.com/a#fragment"}) {
            assertThatThrownBy(() -> TodoPushService.validateEndpoint(url)).isInstanceOf(RuntimeException.class);
        }
        TodoPushService.validateEndpoint("https://updates.push.services.mozilla.com/wpush/private");
        TodoPushService.validateEndpoint("https://web.push.apple.com/private");
    }
    @Test void omitsPushEndpointValuesFromDevelopmentSqlLogs() {
        var formatter = new P6SpySqlFormatter();
        String formatted = formatter.formatMessage(1, "", 1, "statement", "INSERT INTO board_todo_push_subscriptions(endpoint) VALUES (?)",
            "INSERT INTO board_todo_push_subscriptions(endpoint) VALUES ('https://secret-endpoint')", "");
        assertThat(formatted).contains("VALUES (?)").doesNotContain("secret-endpoint");
    }
}
