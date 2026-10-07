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

/**
 * 크롤링 실행의 입구입니다. 요청 설정을 검사한 뒤 실제 브라우저 작업은 WebCrawlerEngine(Playwright 구현)에 맡긴다.
 * 엔진을 인터페이스로 두어, 테스트에서는 가짜 엔진으로 바꿔 끼울 수 있다.
 */
@Service
@RequiredArgsConstructor
public class CrawlerService {
    private final WebCrawlerEngine webCrawlerEngine;

    public CrawlerRunResponse run(CrawlerRunRequest request) {
        validateSteps(request);
        // 수집 필드 이름은 결과 표의 열 이름이 되므로 대소문자·앞뒤 공백을 무시하고 겹치면 안 된다.
        Set<String> uniqueFieldNames = request.fields().stream()
            .map(field -> field.name().trim().toLowerCase(Locale.ROOT))
            .collect(Collectors.toSet());
        if (uniqueFieldNames.size() != request.fields().size()) {
            throw new BusinessException(ErrorCode.CRAWLER_CONFIGURATION_INVALID, "수집 필드 이름은 서로 달라야 합니다.");
        }
        return webCrawlerEngine.crawl(request);
    }

    /**
     * 단계(steps) 순서 규칙 검사. 설정 저장(CrawlerConfigurationService)에서도 같은 검사를 쓰려고 static으로 열어 두었다.
     *   CSV 저장 : 목록 반복(COLLECT) 뒤, 맨 마지막 단계에만
     *   스크롤   : 거리 -10000~10000 숫자
     *   목록 반복: 대상은 CSS 선택자, 안의 추출 이름은 서로 달라야 함
     */
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
                    // NaN·Infinity 같은 값도 거부한다. 범위를 벗어나면 일부러 같은 예외를 던져 아래 catch에서 한 번에 처리한다.
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
