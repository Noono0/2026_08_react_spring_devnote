package com.example.devnote.crawler.dto;

/** 단계별 실행에서 한 단계가 하는 일. */
public enum CrawlerStepType {
    /** value의 주소로 이동한다. */
    GOTO,
    /** 대상을 클릭한다. */
    CLICK,
    /** 대상 입력칸에 value를 입력한다. value의 {{username}}, {{password}}는 입력한 계정정보로 바뀐다. */
    FILL,
    /** value의 키(예: Enter)를 누른다. 대상이 있으면 그 요소에서 누른다. */
    PRESS,
    /** value 밀리초만큼 기다린다. */
    WAIT,
    /** 대상이 화면에 나타날 때까지 기다린다. */
    WAIT_FOR,
    /** 사람이 직접 처리할 때까지 멈춘다(캡차 등). 대상이 있으면 그 요소가 보이는 순간 자동으로 계속한다. */
    MANUAL,
    /** 수집 설정(반복 항목·필드·다음 페이지)으로 현재 화면의 목록을 수집한다. */
    COLLECT,
    SCROLL,
    NEXT_PAGE,
    CSV
}
