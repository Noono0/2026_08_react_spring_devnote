package com.example.devnote.common.logging;

import com.p6spy.engine.spy.appender.MessageFormattingStrategy;
import org.slf4j.MDC;

/**
 * P6Spy가 치환한 실제 SQL과 실행 시간을 사람이 읽기 쉬운 한 덩어리로 출력합니다.
  *
  * [어떻게 연결되나?]
  *   1. application.yml의 DB 주소가 jdbc:p6spy:mysql://… 이고 드라이버가 P6SpyDriver다.
  *      P6Spy가 진짜 MySQL 드라이버 앞에 서서 오가는 SQL을 엿본다.
  *   2. resources/spy.properties의 logMessageFormat이 이 클래스를 가리킨다.
  *   3. 운영(application-prod.yml)은 일반 MySQL 드라이버를 써서 P6Spy를 아예 거치지 않는다(성능·정보 노출 이유).
  *
  * 출력 예시:
  *   [SQL] traceId=ab12…, connectionId=3, category=statement, executionTime=2ms
  *   select … from tb_document where document_id = 1;
 */
public class P6SpySqlFormatter implements MessageFormattingStrategy {
    @Override
    public String formatMessage(
        int connectionId,
        String now,
        long elapsed,
        String category,
        String prepared,
        String sql,
        String url
    ) {
        // commit처럼 SQL 문장이 없는 이벤트는 빈 문자열을 돌려줘 아무것도 찍지 않는다.
        if (sql == null || sql.isBlank()) {
            return "";
        }
        // Mapper XML의 줄바꿈·들여쓰기를 공백 하나로 합쳐 한 줄로 만든다(\\s+ = 공백 문자 1개 이상).
        String compactSql = sql.replaceAll("\\s+", " ").trim();
        return System.lineSeparator()
            // TraceIdFilter가 MDC에 넣은 값. 요청 밖(예약 작업 등)에서 실행된 SQL은 none으로 찍힌다.
            + "[SQL] traceId=" + valueOrDefault(MDC.get("traceId"), "none")
            + ", connectionId=" + connectionId
            + ", category=" + category
            + ", executionTime=" + elapsed + "ms"
            + System.lineSeparator()
            + compactSql + ";";
    }

    private String valueOrDefault(String value, String defaultValue) {
        return value == null || value.isBlank() ? defaultValue : value;
    }
}
