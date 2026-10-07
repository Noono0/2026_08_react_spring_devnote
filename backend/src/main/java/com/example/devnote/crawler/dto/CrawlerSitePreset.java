package com.example.devnote.crawler.dto;

/** 설정에 저장하는 사이트 종류 표시. GENERIC = 일반 사이트, NAVER_CAFE = 네이버 카페(화면이 저장 세션 상태 확인·전용 입력칸을 보여 준다). 서버 실행 동작은 바꾸지 않는다. */
public enum CrawlerSitePreset {
    GENERIC,
    NAVER_CAFE
}
