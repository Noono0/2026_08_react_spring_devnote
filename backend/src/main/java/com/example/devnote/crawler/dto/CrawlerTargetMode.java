package com.example.devnote.crawler.dto;

/** 단계의 대상을 찾는 방법. */
public enum CrawlerTargetMode {
    /** 화면에 보이는 글자로 찾는다(버튼·링크 글자, 입력칸의 제목·안내문·라벨). 기본값. */
    TEXT,
    /** CSS 선택자로 찾는다. */
    SELECTOR,
    /** 화면 좌표(x, y)를 누른다. 창 크기·스크롤이 바뀌면 어긋날 수 있다. */
    COORDINATE
}
