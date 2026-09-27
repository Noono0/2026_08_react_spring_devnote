package com.example.devnote.crawler.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.crawler.dto.CrawlerRecordingRequest;
import com.example.devnote.crawler.dto.CrawlerRunRequest;
import com.example.devnote.crawler.dto.CrawlerRunResponse;

public interface WebCrawlerEngine {
    CrawlerRunResponse crawl(CrawlerRunRequest request);

    /** 브라우저를 열고 사용자의 클릭·입력을 단계로 녹화하기 시작한다. */
    default void startRecording(CrawlerRecordingRequest request) {
        throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "이 크롤러 엔진은 녹화를 지원하지 않습니다.");
    }

    /** 녹화를 멈춘다. 기록된 단계는 실시간 화면 응답의 recordedSteps로 확인한다. */
    default void stopRecording() {
    }
}
