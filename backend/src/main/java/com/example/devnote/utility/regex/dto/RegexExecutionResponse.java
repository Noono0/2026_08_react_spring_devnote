package com.example.devnote.utility.regex.dto;

import java.util.List;

/**
 * 정규식 실행 결과.
 *   matches   : 찾은 부분들(최대 200개). 각 항목에 위치(start·end)와 그룹 값(번호 그룹 + 이름 그룹)이 있다.
 *   replacedText: REPLACE 모드의 결과(다른 모드면 null)
 *   truncated : 200개를 넘어 더 있는데 잘랐는지
 * record 안에 record를 둔 것은 이 응답에서만 쓰는 작은 모양이라 한 파일에 모아 둔 것이다.
 */
public record RegexExecutionResponse(
    boolean matched,
    List<RegexMatchResponse> matches,
    String replacedText,
    boolean truncated
) {
    public record RegexMatchResponse(
        String match,
        int start,
        int end,
        List<RegexGroupResponse> groups
    ) {
    }

    public record RegexGroupResponse(String name, String value) {
    }
}

