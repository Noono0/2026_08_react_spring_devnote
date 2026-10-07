package com.example.devnote.common.logging;

import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.util.Arrays;
import java.util.regex.Pattern;

/**
 * Controller·Service·DAO의 모든 메서드 호출을 자동으로 기록하는 AOP(관점 지향 프로그래밍) 클래스입니다.
 *
 * [AOP란?]
 *   "로그 남기기"처럼 여러 클래스에 똑같이 필요한 일을, 각 메서드에 코드를 넣지 않고 바깥에서 끼워 넣는 방법.
 *   Spring은 대상 Bean을 감싼 "대리 객체(proxy)"를 만들어, 메서드가 불릴 때 이 클래스의 코드를 먼저 실행한다.
 *
 * [로그 예시] (DEBUG 수준이라 개발 환경에서만 보인다)
 *   [METHOD-START] method=DocumentController.getDocument(..), parameters=[1, ...]
 *   [METHOD-END]   method=DocumentController.getDocument(..), elapsedMs=12, resultType=ResponseEntity
 *   → 같은 traceId의 START/END를 따라가면 Controller → Service → DAO 순서로 요청 흐름이 보인다.
 *
 * ★ 비밀번호·토큰은 ********로 가리고, 긴 본문(contentJson 등)과 로그인 세션 JSON은 생략해 로그로 새지 않게 한다.
 */
@Slf4j
@Aspect
@Component
public class MethodLoggingAspect {
    // 파라미터 로그가 너무 길면 이 길이에서 자르고 ...을 붙인다.
    private static final int MAXIMUM_PARAMETER_LOG_LENGTH = 800;
    // 객체의 toString() 결과(예: LoginRequest[loginId=a, password=1234])에서 "이름=값"을 찾는 정규식.
    // (?i)는 대소문자 무시, $1은 첫 번째 괄호(이름) 부분이다. → password=******** 로 바뀐다.
    private static final Pattern SENSITIVE_VALUE_PATTERN = Pattern.compile(
        "(?i)(password|accessToken|refreshToken|authorization)=([^,}]+)"
    );
    // 문서 본문은 수천 글자일 수 있어 내용 대신 <omitted>만 남긴다.
    private static final Pattern LARGE_CONTENT_PATTERN = Pattern.compile(
        "(?i)(contentJson|contentHtml|contentText)=([^,}]+)"
    );

    // @Around("execution(...)"): 어떤 메서드를 감쌀지 고르는 식(포인트컷).
    //   com.example.devnote..controller..*(..) = devnote 아래 모든 controller 패키지의, 모든 클래스의, 모든 메서드(인자 무관).
    @Around("execution(* com.example.devnote..controller..*(..)) || " +
            "execution(* com.example.devnote..service..*(..)) || " +
            "execution(* com.example.devnote..dao..*(..))")
    public Object logMethodExecution(ProceedingJoinPoint joinPoint) throws Throwable {
        String methodName = joinPoint.getSignature().toShortString();
        long startedAtNanoseconds = System.nanoTime();
        log.debug("[METHOD-START] method={}, parameters={}", methodName, sanitizeArguments(joinPoint.getArgs()));
        try {
            // proceed(): 원래 메서드를 실제로 실행한다. 이 줄 앞은 "호출 전", 뒤는 "호출 후"다.
            Object result = joinPoint.proceed();
            long elapsedMilliseconds = (System.nanoTime() - startedAtNanoseconds) / 1_000_000;
            log.debug("[METHOD-END] method={}, elapsedMs={}, resultType={}",
                methodName,
                elapsedMilliseconds,
                result == null ? "void" : result.getClass().getSimpleName()
            );
            return result;
        } catch (Throwable throwable) {
            long elapsedMilliseconds = (System.nanoTime() - startedAtNanoseconds) / 1_000_000;
            log.error("[METHOD-ERROR] method={}, elapsedMs={}, exception={}, message={}",
                methodName,
                elapsedMilliseconds,
                throwable.getClass().getSimpleName(),
                throwable.getMessage()
            );
            // 기록만 하고 예외는 그대로 다시 던진다. 여기서 삼키면 GlobalExceptionHandler가 오류를 알 수 없게 된다.
            throw throwable;
        }
    }

    private String sanitizeArguments(Object[] arguments) {
        String joinedArguments = Arrays.stream(arguments)
            .map(this::sanitizeArgument)
            .toList()
            .toString();
        return joinedArguments.length() <= MAXIMUM_PARAMETER_LOG_LENGTH
            ? joinedArguments
            : joinedArguments.substring(0, MAXIMUM_PARAMETER_LOG_LENGTH) + "...";
    }

    private String sanitizeArgument(Object argument) {
        if (argument == null) {
            return "null";
        }
        // 요청·응답 객체의 toString()은 길고 쓸모가 없어 클래스 이름만 남긴다.
        if (argument instanceof ServletRequest || argument instanceof ServletResponse) {
            return argument.getClass().getSimpleName();
        }
        // 업로드 파일은 내용(바이트) 대신 이름·크기·종류만 남긴다.
        if (argument instanceof MultipartFile multipartFile) {
            return "MultipartFile{name=" + multipartFile.getOriginalFilename()
                + ", size=" + multipartFile.getSize()
                + ", contentType=" + multipartFile.getContentType() + "}";
        }
        String rawValue = String.valueOf(argument);
        // 브라우저 로그인 세션(Playwright storageState JSON)에는 로그인 쿠키가 들어 있으므로 로그에 남기지 않는다.
        if (rawValue.startsWith("{\"cookies\"")) {
            return "<browser-session omitted, length=" + rawValue.length() + ">";
        }
        String maskedSensitiveValue = SENSITIVE_VALUE_PATTERN.matcher(rawValue)
            .replaceAll("$1=********");
        return LARGE_CONTENT_PATTERN.matcher(maskedSensitiveValue)
            .replaceAll("$1=<omitted>");
    }
}
