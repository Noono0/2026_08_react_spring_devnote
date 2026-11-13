package com.example.devnote.board.service;

import com.example.devnote.board.dto.CalendarHolidayDtos.HolidayKind;
import com.example.devnote.board.dto.CalendarHolidayDtos.OfficialDay;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.w3c.dom.Element;
import org.xml.sax.SAXException;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.ByteBuffer;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.Flow;
import java.time.Duration;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** 인증키는 서버에서만 사용한다. URI와 원본 예외에는 키가 들어갈 수 있어 로그로 전달하지 않는다. */
@Component
public class KoreanHolidayApiClient {
    public static final String SOURCE_URL = "https://www.data.go.kr/data/15012690/openapi.do";
    private static final int MAX_RESPONSE_BYTES = 262_144;
    private static final URI ENDPOINT = URI.create("https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo");
    private final HttpClient client;
    private final String serviceKey;
    private final URI endpoint;

    @Autowired
    public KoreanHolidayApiClient(@Value("${application.calendar-holidays.service-key:}") String serviceKey) {
        this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).followRedirects(HttpClient.Redirect.NEVER).build(), serviceKey, ENDPOINT);
    }

    KoreanHolidayApiClient(HttpClient client, String serviceKey, URI endpoint) {
        this.client = client;
        this.serviceKey = serviceKey.trim();
        this.endpoint = endpoint;
    }

    public boolean isConfigured() { return !serviceKey.isBlank(); }

    public List<OfficialDay> fetchYear(int year) throws IOException {
        if (!isConfigured() || year < 1900 || year > 2100) throw new IOException("공휴일 API 설정·연도를 확인해 주세요.");
        // 포털의 Encoding·Decoding 키를 모두 지원하되 이중 URL 인코딩을 피한다.
        String rawKey;
        try { rawKey = serviceKey.contains("%") ? URLDecoder.decode(serviceKey, StandardCharsets.UTF_8) : serviceKey; }
        catch (IllegalArgumentException exception) { throw new IOException("공휴일 API 인증키 형식이 올바르지 않습니다."); }
        String query = "?solYear=" + year + "&numOfRows=100&pageNo=1&ServiceKey=" + URLEncoder.encode(rawKey, StandardCharsets.UTF_8);
        HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint + query)).timeout(Duration.ofSeconds(6))
            .header("Accept", "application/xml").GET().build();
        try {
            var response = client.send(request, ignored -> limitedBody());
            if (response.statusCode() != 200) throw new IOException("공휴일 API HTTP 오류: " + response.statusCode());
            byte[] xml = response.body();
            return parse(xml, year);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IOException("공휴일 API 요청이 중단되었습니다.");
        } catch (IOException exception) {
            // 네트워크 구현이 인증키가 들어간 요청 주소를 예외에 넣을 수 있다.
            throw new IOException("공휴일 API 응답을 확인할 수 없습니다.");
        }
    }

    /** 본문 전체를 받은 뒤 검사하면 늦다. 수신 중 상한을 넘는 순간 구독을 취소한다. */
    private static HttpResponse.BodySubscriber<byte[]> limitedBody() {
        var delegate = HttpResponse.BodySubscribers.ofByteArray();
        return new HttpResponse.BodySubscriber<>() {
            private Flow.Subscription subscription;
            private int received;
            private boolean finished;

            @Override public CompletionStage<byte[]> getBody() { return delegate.getBody(); }
            @Override public void onSubscribe(Flow.Subscription value) { subscription = value; delegate.onSubscribe(value); }
            @Override public void onNext(List<ByteBuffer> buffers) {
                if (finished) return;
                for (var buffer : buffers) {
                    if (buffer.remaining() > MAX_RESPONSE_BYTES - received) {
                        finished = true;
                        subscription.cancel();
                        delegate.onError(new IOException("공휴일 API 응답이 너무 큽니다."));
                        return;
                    }
                    received += buffer.remaining();
                }
                delegate.onNext(buffers);
            }
            @Override public void onError(Throwable error) { if (!finished) { finished = true; delegate.onError(error); } }
            @Override public void onComplete() { if (!finished) { finished = true; delegate.onComplete(); } }
        };
    }

    static List<OfficialDay> parse(byte[] xml, int year) throws IOException {
        try {
            var factory = DocumentBuilderFactory.newInstance();
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            var builder = factory.newDocumentBuilder();
            builder.setErrorHandler(new org.xml.sax.helpers.DefaultHandler() {
                @Override public void error(org.xml.sax.SAXParseException exception) throws SAXException { throw exception; }
                @Override public void fatalError(org.xml.sax.SAXParseException exception) throws SAXException { throw exception; }
            });
            var root = builder.parse(new ByteArrayInputStream(xml)).getDocumentElement();
            if (!root.getTagName().equals("response") || !text(root, "resultCode").equals("00")) throw new IOException("공휴일 API가 정상 응답하지 않았습니다.");
            int totalCount = Integer.parseInt(text(root, "totalCount"));
            var items = root.getElementsByTagName("item");
            // 일부 페이지만 저장하거나 아직 발표되지 않은 연도를 '휴일 없음'으로 확정하지 않는다.
            if (totalCount < 1 || totalCount > 100 || totalCount != items.getLength()) throw new IOException("공휴일 API의 연간 자료가 완전하지 않습니다.");
            List<OfficialDay> days = new ArrayList<>();
            for (int index = 0; index < items.getLength(); index++) {
                Element item = (Element) items.item(index);
                String holidayFlag = text(item, "isHoliday");
                if (!holidayFlag.equals("Y") && !holidayFlag.equals("N")) throw new IOException("공휴일 여부 값이 올바르지 않습니다.");
                LocalDate date = LocalDate.parse(text(item, "locdate"), DateTimeFormatter.BASIC_ISO_DATE);
                String name = text(item, "dateName").trim();
                if (date.getYear() != year || name.isBlank() || name.length() > 80) throw new IOException("공휴일 날짜·이름이 올바르지 않습니다.");
                if (holidayFlag.equals("N")) continue;
                HolidayKind kind = name.contains("대체공휴일") ? HolidayKind.SUBSTITUTE
                    : name.contains("임시공휴일") ? HolidayKind.TEMPORARY : HolidayKind.PUBLIC;
                days.add(new OfficialDay(date, name, kind));
            }
            if (days.isEmpty() || days.stream().noneMatch(day -> day.date().equals(LocalDate.of(year, 1, 1)))) {
                throw new IOException("발표된 연간 공휴일 자료가 없습니다.");
            }
            return days.stream().distinct().sorted(Comparator.comparing(OfficialDay::date).thenComparing(OfficialDay::name)).toList();
        } catch (ParserConfigurationException | SAXException | IllegalArgumentException | DateTimeException exception) {
            throw new IOException("공휴일 API XML 형식이 올바르지 않습니다.");
        }
    }

    private static String text(Element element, String name) throws IOException {
        var fields = element.getElementsByTagName(name);
        if (fields.getLength() != 1) throw new IOException("공휴일 API 필수 항목이 누락되었습니다.");
        return fields.item(0).getTextContent();
    }
}
