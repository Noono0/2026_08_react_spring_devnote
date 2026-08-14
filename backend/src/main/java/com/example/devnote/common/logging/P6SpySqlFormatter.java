package com.example.devnote.common.logging;

import com.p6spy.engine.spy.appender.MessageFormattingStrategy;
import org.slf4j.MDC;

/**
 * P6Spy가 치환한 실제 SQL과 실행 시간을 사람이 읽기 쉬운 한 덩어리로 출력합니다.
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
        if (sql == null || sql.isBlank()) {
            return "";
        }
        String compactSql = sql.replaceAll("\\s+", " ").trim();
        return System.lineSeparator()
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
