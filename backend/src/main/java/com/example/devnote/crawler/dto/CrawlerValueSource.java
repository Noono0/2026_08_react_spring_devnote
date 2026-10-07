package com.example.devnote.crawler.dto;

/** 값을 읽는 방식. TEXT = 화면에 보이는 글자, ATTRIBUTE = 태그 속성 값(예: <a href>의 주소). */
public enum CrawlerValueSource {
    TEXT,
    ATTRIBUTE
}
