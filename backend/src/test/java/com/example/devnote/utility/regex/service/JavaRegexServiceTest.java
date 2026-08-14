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
    void omitsPatternAndInputFromLogRepresentation() {
        var request = new RegexExecutionRequest("secret-pattern", "i", "private-test-input", "FIND", "secret-replacement");

        assertThat(request.toString())
            .doesNotContain("secret-pattern", "private-test-input", "secret-replacement")
            .contains("<omitted>");
    }
}
