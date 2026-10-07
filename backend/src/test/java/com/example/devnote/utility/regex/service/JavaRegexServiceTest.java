package com.example.devnote.utility.regex.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.utility.regex.dto.RegexExecutionRequest;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JavaRegexServiceTest {
    private final JavaRegexService service = new JavaRegexService();

    @Test
    void findsNamedAndNumberedGroupsWithJavaPattern() {
        var response = service.execute(new RegexExecutionRequest("(?<word>[A-Za-z]+)", "", "One TWO", "FIND", ""));

        assertThat(response.matches()).hasSize(2);
        assertThat(response.matches().getFirst().groups()).anyMatch(group -> "word".equals(group.name()) && "One".equals(group.value()));
    }

    @Test
    void replacesJavaMatchesAndNormalizesJavascriptWholeMatchToken() {
        var response = service.execute(new RegexExecutionRequest("\\d+", "", "A1 B22", "REPLACE", "[$&]"));

        assertThat(response.replacedText()).isEqualTo("A[1] B[22]");
    }

    @Test
    void rejectsPotentiallyCatastrophicPattern() {
        assertThatThrownBy(() -> service.execute(new RegexExecutionRequest("(a+)+$", "", "aaaa", "FIND", "")))
            .isInstanceOf(BusinessException.class);
    }

    @Test
    void slowPatternThatPassesPreCheckStopsWorkerThreadsSoServiceKeepsWorking() {
        // \d*\d*\d*z 는 사전 차단을 통과하지만, z가 없는 긴 숫자 입력에서 계산량이 폭발한다.
        String slowInput = "1".repeat(5_000);
        RegexExecutionRequest slowRequest = new RegexExecutionRequest("\\d*\\d*\\d*z", "", slowInput, "FIND", "");

        // 작업 스레드는 2개. 예전에는 이런 요청 두 번이면 두 스레드가 계속 계산에 붙잡혀 이후 요청이 모두 막혔다.
        for (int attempt = 0; attempt < 2; attempt++) {
            assertThatThrownBy(() -> service.execute(slowRequest))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("1초");
        }

        // 스레드가 실제로 멈췄다면 정상 요청이 다시 처리된다.
        var response = service.execute(new RegexExecutionRequest("\\d+", "", "A1 B22", "FIND", ""));
        assertThat(response.matches()).hasSize(2);
    }

    @Test
    void omitsPatternAndInputFromLogRepresentation() {
        var request = new RegexExecutionRequest("secret-pattern", "i", "private-test-input", "FIND", "secret-replacement");

        assertThat(request.toString())
            .doesNotContain("secret-pattern", "private-test-input", "secret-replacement")
            .contains("<omitted>");
    }
}
