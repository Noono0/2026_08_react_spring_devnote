package com.example.devnote.utility.regex.dto;

import java.util.List;

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

