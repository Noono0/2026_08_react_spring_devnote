package com.example.devnote.crawler.dto;

/** 브라우저 동작 화면을 어디에서 보고 조작할지 선택한다. */
public enum CrawlerBrowserWindow {
    /** 웹 화면 안에서 실행 화면을 보고, 필요하면 웹 화면에서 클릭·입력한다. */
    WEB,
    /** 사용자 PC에 새 Chromium/Chrome 창을 띄우고 그 창에서 직접 작업을 이어간다. */
    PC_WINDOW
}
