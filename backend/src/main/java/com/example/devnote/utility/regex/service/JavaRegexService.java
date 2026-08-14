package com.example.devnote.utility.regex.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.utility.regex.dto.RegexExecutionRequest;
import com.example.devnote.utility.regex.dto.RegexExecutionResponse;
import com.example.devnote.utility.regex.dto.RegexExecutionResponse.RegexGroupResponse;
import com.example.devnote.utility.regex.dto.RegexExecutionResponse.RegexMatchResponse;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

@Service
public class JavaRegexService {
    private static final int MAXIMUM_MATCH_COUNT = 200;
    private static final long TIMEOUT_MILLISECONDS = 1_000;
    private static final Pattern NAMED_GROUP_PATTERN = Pattern.compile("\\(\\?<([A-Za-z][A-Za-z0-9]*)>");
    private static final Pattern POTENTIALLY_DANGEROUS_PATTERN = Pattern.compile("(\\([^)]*[+*][^)]*\\))[+*{]|(\\.\\*){2,}");
    private final ExecutorService executor = Executors.newFixedThreadPool(2, runnable -> {
        Thread thread = new Thread(runnable, "java-regex-worker");
        thread.setDaemon(true);
        return thread;
    });

    public RegexExecutionResponse execute(RegexExecutionRequest request) {
        if (POTENTIALLY_DANGEROUS_PATTERN.matcher(request.pattern()).find()) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "중첩 반복으로 실행 시간이 길어질 수 있는 패턴은 Java 서버에서 실행할 수 없습니다.");
        }
        Future<RegexExecutionResponse> execution = executor.submit(() -> executePattern(request));
        try {
            return execution.get(TIMEOUT_MILLISECONDS, TimeUnit.MILLISECONDS);
        } catch (TimeoutException exception) {
            execution.cancel(true);
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "정규식 실행이 1초를 초과해 중단했습니다. 반복 표현을 단순하게 바꿔 주세요.");
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "정규식 실행이 중단되었습니다.");
        } catch (ExecutionException exception) {
            Throwable cause = exception.getCause();
            if (cause instanceof BusinessException businessException) throw businessException;
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, cause == null ? "정규식을 실행하지 못했습니다." : cause.getMessage());
        }
    }

    private RegexExecutionResponse executePattern(RegexExecutionRequest request) {
        try {
            Pattern compiledPattern = Pattern.compile(request.pattern(), resolveFlags(request.flags()));
            if ("FULL".equals(request.mode())) return executeFullMatch(compiledPattern, request);
            Matcher matcher = compiledPattern.matcher(request.input() == null ? "" : request.input());
            List<RegexMatchResponse> matches = collectMatches(matcher, request.pattern());
            boolean truncated = matches.size() == MAXIMUM_MATCH_COUNT && matcher.find();
            String replacedText = "REPLACE".equals(request.mode())
                ? compiledPattern.matcher(request.input() == null ? "" : request.input()).replaceAll(normalizeReplacement(request.replacement()))
                : null;
            return new RegexExecutionResponse(!matches.isEmpty(), matches, replacedText, truncated);
        } catch (PatternSyntaxException exception) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST,
                "정규식 문법 오류" + (exception.getIndex() >= 0 ? " (위치 " + exception.getIndex() + ")" : "") + ": " + exception.getDescription());
        } catch (IllegalArgumentException | IndexOutOfBoundsException exception) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "치환 문자열 또는 그룹 참조를 확인해 주세요: " + exception.getMessage());
        }
    }

    private RegexExecutionResponse executeFullMatch(Pattern pattern, RegexExecutionRequest request) {
        Matcher matcher = pattern.matcher(request.input() == null ? "" : request.input());
        if (!matcher.matches()) return new RegexExecutionResponse(false, List.of(), null, false);
        return new RegexExecutionResponse(true, List.of(toMatch(matcher, request.pattern())), null, false);
    }

    private List<RegexMatchResponse> collectMatches(Matcher matcher, String pattern) {
        List<RegexMatchResponse> matches = new ArrayList<>();
        while (matches.size() < MAXIMUM_MATCH_COUNT && matcher.find()) matches.add(toMatch(matcher, pattern));
        return matches;
    }

    private RegexMatchResponse toMatch(Matcher matcher, String pattern) {
        List<RegexGroupResponse> groups = new ArrayList<>();
        for (int groupIndex = 1; groupIndex <= matcher.groupCount(); groupIndex++) {
            groups.add(new RegexGroupResponse(String.valueOf(groupIndex), valueOrEmpty(matcher.group(groupIndex))));
        }
        for (String groupName : extractNamedGroups(pattern)) {
            groups.add(new RegexGroupResponse(groupName, valueOrEmpty(matcher.group(groupName))));
        }
        return new RegexMatchResponse(matcher.group(), matcher.start(), matcher.end(), groups);
    }

    private Set<String> extractNamedGroups(String pattern) {
        Set<String> names = new LinkedHashSet<>();
        Matcher groupMatcher = NAMED_GROUP_PATTERN.matcher(pattern);
        while (groupMatcher.find()) names.add(groupMatcher.group(1));
        return names;
    }

    private int resolveFlags(String flags) {
        if (flags == null) return 0;
        int options = 0;
        if (flags.contains("i")) options |= Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE;
        if (flags.contains("m")) options |= Pattern.MULTILINE;
        if (flags.contains("s")) options |= Pattern.DOTALL;
        if (flags.contains("u")) options |= Pattern.UNICODE_CHARACTER_CLASS;
        return options;
    }

    private String normalizeReplacement(String replacement) {
        if (replacement == null) return "";
        return replacement.replace("$&", "$0").replaceAll("\\$<([A-Za-z][A-Za-z0-9]*)>", "\\${$1}");
    }

    private String valueOrEmpty(String value) {
        return value == null ? "" : value;
    }
}

