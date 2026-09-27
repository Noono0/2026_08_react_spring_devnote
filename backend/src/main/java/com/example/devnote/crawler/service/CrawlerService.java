package com.example.devnote.crawler.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.crawler.dto.CrawlerRecordingRequest;
import com.example.devnote.crawler.dto.CrawlerRunRequest;
import com.example.devnote.crawler.dto.CrawlerRunResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CrawlerService {
    private final WebCrawlerEngine webCrawlerEngine;

    public CrawlerRunResponse run(CrawlerRunRequest request) {
        validateSteps(request);
        Set<String> uniqueFieldNames = request.fields().stream()
            .map(field -> field.name().trim().toLowerCase(Locale.ROOT))
            .collect(Collectors.toSet());
        if (uniqueFieldNames.size() != request.fields().size()) {
            throw new BusinessException(ErrorCode.CRAWLER_CONFIGURATION_INVALID, "수집 필드 이름은 서로 달라야 합니다.");
        }
        return webCrawlerEngine.crawl(request);
    }

    public static void validateSteps(CrawlerRunRequest request) {
        boolean collected = false;
        for (int index = 0; index < request.steps().size(); index++) {
            var step = request.steps().get(index);
            if (step.type() == com.example.devnote.crawler.dto.CrawlerStepType.CSV
                && (!collected || index != request.steps().size() - 1)) {
                throw new BusinessException(ErrorCode.CRAWLER_CONFIGURATION_INVALID, "CSV 저장은 목록 반복 뒤 마지막 단계에 놓아 주세요.");
            }
            if (step.type() == com.example.devnote.crawler.dto.CrawlerStepType.SCROLL) {
                try {
                    double distance = Double.parseDouble(step.value());
                    if (!Double.isFinite(distance) || Math.abs(distance) > 10_000) throw new NumberFormatException();
                } catch (NumberFormatException exception) {
                    throw new BusinessException(ErrorCode.CRAWLER_CONFIGURATION_INVALID, "스크롤 거리는 -10000~10000 사이 숫자로 입력해 주세요.");
                }
            }
            if (step.type() == com.example.devnote.crawler.dto.CrawlerStepType.COLLECT) {
                collected = true;
                if (!step.target().isBlank() && step.targetMode() != com.example.devnote.crawler.dto.CrawlerTargetMode.SELECTOR) {
                    throw new BusinessException(ErrorCode.CRAWLER_CONFIGURATION_INVALID, "목록 반복의 대상은 CSS 선택자로 지정해 주세요.");
                }
                if (step.fields() != null) {
                    long unique = step.fields().stream().map(field -> field.name().trim().toLowerCase(Locale.ROOT)).distinct().count();
                    if (unique != step.fields().size()) {
                        throw new BusinessException(ErrorCode.CRAWLER_CONFIGURATION_INVALID, "목록 반복 안의 추출 이름은 서로 달라야 합니다.");
                    }
                }
            }
        }
    }

    public void startRecording(CrawlerRecordingRequest request) {
        webCrawlerEngine.startRecording(request);
    }

    public void stopRecording() {
        webCrawlerEngine.stopRecording();
    }
}
