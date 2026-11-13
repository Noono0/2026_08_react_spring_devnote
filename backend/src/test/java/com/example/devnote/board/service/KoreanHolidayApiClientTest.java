package com.example.devnote.board.service;

import com.example.devnote.board.dto.CalendarHolidayDtos.HolidayKind;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import static org.assertj.core.api.Assertions.*;

class KoreanHolidayApiClientTest {
    @Test void parsesSingleItemAndRecognizesSubstituteAndTemporaryHolidays() throws Exception {
        assertThat(parse(response(item("20270101", "1월1일", "Y"), 1))).hasSize(1);
        var days = parse(response(item("20270101", "1월1일", "Y") + item("20270209", "대체공휴일(설날)", "Y")
            + item("20270303", "임시공휴일", "Y") + item("20270508", "어버이날", "N"), 4));
        assertThat(days).extracting(day -> day.kind()).containsExactly(HolidayKind.PUBLIC, HolidayKind.SUBSTITUTE, HolidayKind.TEMPORARY);
    }

    @Test void rejectsErrorResponsesEmptyYearsAndTruncatedPagination() {
        assertThatThrownBy(() -> parse("<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SECRET_URL</errMsg></cmmMsgHeader></OpenAPI_ServiceResponse>"))
            .isInstanceOf(IOException.class).hasMessageNotContaining("SECRET_URL");
        assertThatThrownBy(() -> parse(response("", 0))).isInstanceOf(IOException.class);
        assertThatThrownBy(() -> parse(response(item("20270101", "신정", "Y"), 12))).isInstanceOf(IOException.class);
        assertThatThrownBy(() -> parse(response(item("20270101", "신정", "Y"), 101))).isInstanceOf(IOException.class);
    }

    @Test void rejectsInvalidDateWrongYearFlagAndMissingName() {
        for (String item : new String[] { item("20270230", "휴일", "Y"), item("20260101", "휴일", "Y"),
            item("20270101", "", "Y"), item("20270101", "신정", "Z") }) {
            assertThatThrownBy(() -> parse(response(item, 1))).isInstanceOf(IOException.class);
        }
    }

    @Test void rejectsExternalEntitiesAndMalformedXml() {
        assertThatThrownBy(() -> parse("<!DOCTYPE response [<!ENTITY secret SYSTEM 'file:///not-readable'>]><response>&secret;</response>"))
            .isInstanceOf(IOException.class);
        assertThatThrownBy(() -> parse("<response>")).isInstanceOf(IOException.class);
    }

    @Test void sendsEncodedAndDecodedKeysOnceAndDoesNotLeakHttpErrorDetails() throws Exception {
        var query = new AtomicReference<String>();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/holidays", exchange -> {
            query.set(exchange.getRequestURI().getRawQuery());
            byte[] xml = response(item("20270101", "신정", "Y"), 1).getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, xml.length);
            try (var body = exchange.getResponseBody()) { body.write(xml); }
        });
        server.createContext("/error", exchange -> { exchange.sendResponseHeaders(401, -1); exchange.close(); });
        server.start();
        try {
            var base = "http://127.0.0.1:" + server.getAddress().getPort();
            for (String key : new String[] { "sample+/=", "sample%2B%2F%3D" }) {
                var client = new KoreanHolidayApiClient(HttpClient.newHttpClient(), key, URI.create(base + "/holidays"));
                assertThat(client.fetchYear(2027)).hasSize(1);
                assertThat(query.get()).contains("ServiceKey=sample%2B%2F%3D", "solYear=2027").doesNotContain("%252B");
            }
            var failing = new KoreanHolidayApiClient(HttpClient.newHttpClient(), "private-key", URI.create(base + "/error"));
            assertThatThrownBy(() -> failing.fetchYear(2027)).isInstanceOf(IOException.class).hasMessageNotContaining("private-key").hasNoCause();
        } finally { server.stop(0); }
    }

    @Test void cancelsAnOversizedBodyWithoutWaitingForItsRemainingContent() throws Exception {
        var release = new java.util.concurrent.CountDownLatch(1);
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/large", exchange -> {
            exchange.sendResponseHeaders(200, 1_048_576);
            try {
                exchange.getResponseBody().write(new byte[262_145]);
                exchange.getResponseBody().flush();
                if (!release.await(5, java.util.concurrent.TimeUnit.SECONDS)) throw new IOException("테스트 응답 대기 초과");
            } catch (InterruptedException exception) { Thread.currentThread().interrupt(); }
            finally { exchange.close(); }
        });
        server.start();
        var executor = java.util.concurrent.Executors.newSingleThreadExecutor();
        try {
            var client = new KoreanHolidayApiClient(HttpClient.newHttpClient(), "private-key", URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/large"));
            var result = executor.submit(() -> {
                assertThatThrownBy(() -> client.fetchYear(2027)).isInstanceOf(IOException.class).hasMessageNotContaining("private-key").hasNoCause();
                return true;
            });
            assertThat(result.get(2, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
        } finally { release.countDown(); server.stop(0); executor.shutdownNow(); }
    }

    private static java.util.List<com.example.devnote.board.dto.CalendarHolidayDtos.OfficialDay> parse(String xml) throws IOException {
        return KoreanHolidayApiClient.parse(xml.getBytes(StandardCharsets.UTF_8), 2027);
    }
    static String response(String items, int count) { return "<response><header><resultCode>00</resultCode></header><body><items>" + items + "</items><totalCount>" + count + "</totalCount></body></response>"; }
    static String item(String date, String name, String flag) { return "<item><locdate>" + date + "</locdate><dateName>" + name + "</dateName><isHoliday>" + flag + "</isHoliday></item>"; }
}
