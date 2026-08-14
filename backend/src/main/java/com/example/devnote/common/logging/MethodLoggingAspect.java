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

@Slf4j
@Aspect
@Component
public class MethodLoggingAspect {
    private static final int MAXIMUM_PARAMETER_LOG_LENGTH = 800;
    private static final Pattern SENSITIVE_VALUE_PATTERN = Pattern.compile(
        "(?i)(password|accessToken|refreshToken|authorization)=([^,}]+)"
    );
    private static final Pattern LARGE_CONTENT_PATTERN = Pattern.compile(
        "(?i)(contentJson|contentHtml|contentText)=([^,}]+)"
    );

    @Around("execution(* com.example.devnote..controller..*(..)) || " +
            "execution(* com.example.devnote..service..*(..)) || " +
            "execution(* com.example.devnote..dao..*(..))")
    public Object logMethodExecution(ProceedingJoinPoint joinPoint) throws Throwable {
        String methodName = joinPoint.getSignature().toShortString();
        long startedAtNanoseconds = System.nanoTime();
        log.debug("[METHOD-START] method={}, parameters={}", methodName, sanitizeArguments(joinPoint.getArgs()));
        try {
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
        if (argument instanceof ServletRequest || argument instanceof ServletResponse) {
            return argument.getClass().getSimpleName();
        }
        if (argument instanceof MultipartFile multipartFile) {
            return "MultipartFile{name=" + multipartFile.getOriginalFilename()
                + ", size=" + multipartFile.getSize()
                + ", contentType=" + multipartFile.getContentType() + "}";
        }
        String rawValue = String.valueOf(argument);
        String maskedSensitiveValue = SENSITIVE_VALUE_PATTERN.matcher(rawValue)
            .replaceAll("$1=********");
        return LARGE_CONTENT_PATTERN.matcher(maskedSensitiveValue)
            .replaceAll("$1=<omitted>");
    }
}
