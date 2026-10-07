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

/**
 * 사용자가 보낸 정규식을 Java로 실행합니다.
 *
 * [왜 조심해야 하나? — ReDoS]
 *   (a+)+ 같은 "반복 안의 반복" 패턴은 특정 입력에서 계산량이 폭발적으로 늘어 서버 CPU를 오래 붙잡을 수 있다.
 *   그래서 세 겹으로 막는다:
 *   1. 위험해 보이는 패턴(중첩 반복, .*.*)은 실행 전에 거부
 *   2. 별도 작업 스레드에서 실행하고 1초가 넘으면 기다리기를 멈춤(Future.get 타임아웃)
 *   3. 결과는 최대 200개까지만 모음
 */
@Service
public class JavaRegexService {
    private static final int MAXIMUM_MATCH_COUNT = 200;
    private static final long TIMEOUT_MILLISECONDS = 1_000;
    // 패턴 안의 이름 있는 그룹 (?<이름>...)을 찾아 이름을 꺼내는 정규식.
    private static final Pattern NAMED_GROUP_PATTERN = Pattern.compile("\\(\\?<([A-Za-z][A-Za-z0-9]*)>");
    // "괄호 안에 + 또는 *가 있는데 괄호 뒤에 또 반복"(예: (a+)+) 또는 .*가 두 번 이상 이어지는 패턴을 찾는다.
    private static final Pattern POTENTIALLY_DANGEROUS_PATTERN = Pattern.compile("(\\([^)]*[+*][^)]*\\))[+*{]|(\\.\\*){2,}");
    // 정규식 전용 작업 스레드 2개. 데몬 스레드라서 서버를 끌 때 이 스레드 때문에 종료가 막히지 않는다.
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
            // 최대 1초까지만 결과를 기다린다.
            return execution.get(TIMEOUT_MILLISECONDS, TimeUnit.MILLISECONDS);
        } catch (TimeoutException exception) {
            // 작업 스레드에 중단 신호를 보낸다. (Java 정규식은 실행 중 중단 신호를 확인하지 않아 즉시 멈추지 않을 수 있지만,
            //   요청한 사용자는 더 기다리지 않고 바로 오류를 받는다. 1번 단계의 사전 차단이 그래서 함께 필요하다)
            execution.cancel(true);
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "정규식 실행이 1초를 초과해 중단했습니다. 반복 표현을 단순하게 바꿔 주세요.");
        } catch (InterruptedException exception) {
            // InterruptedException을 잡으면 중단 표시가 지워지므로 다시 켜 둔다(Java의 관례).
            Thread.currentThread().interrupt();
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "정규식 실행이 중단되었습니다.");
        } catch (ExecutionException exception) {
            // 작업 스레드에서 난 예외는 ExecutionException에 감싸여 온다. 안의 원래 예외를 꺼내 사용자용 오류로 바꾼다.
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
            // 200개를 채웠는데 하나 더 찾아지면 "잘린 결과"라고 표시한다.
            boolean truncated = matches.size() == MAXIMUM_MATCH_COUNT && matcher.find();
            String replacedText = "REPLACE".equals(request.mode())
                ? compiledPattern.matcher(request.input() == null ? "" : request.input()).replaceAll(normalizeReplacement(request.replacement()))
                : null;
            return new RegexExecutionResponse(!matches.isEmpty(), matches, replacedText, truncated);
        // 문법 오류는 몇 번째 글자에서 났는지 함께 알려 준다.
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
        // 번호 그룹(1, 2, …)을 먼저 담고, 이름 그룹은 아래에서 이름으로 한 번 더 담는다. 매칭되지 않은 그룹은 빈 문자열.
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

    /** 문자 플래그(i·m·s·u)를 Java Pattern의 옵션 비트로 바꾼다. |= 로 여러 옵션을 합친다. */
    private int resolveFlags(String flags) {
        if (flags == null) return 0;
        int options = 0;
        if (flags.contains("i")) options |= Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE;
        if (flags.contains("m")) options |= Pattern.MULTILINE;
        if (flags.contains("s")) options |= Pattern.DOTALL;
        if (flags.contains("u")) options |= Pattern.UNICODE_CHARACTER_CLASS;
        return options;
    }

    /** JavaScript식 치환 표기를 Java식으로: $& → $0(일치한 전체), $<이름> → ${이름}(이름 그룹). */
    private String normalizeReplacement(String replacement) {
        if (replacement == null) return "";
        return replacement.replace("$&", "$0").replaceAll("\\$<([A-Za-z][A-Za-z0-9]*)>", "\\${$1}");
    }

    private String valueOrEmpty(String value) {
        return value == null ? "" : value;
    }
}

