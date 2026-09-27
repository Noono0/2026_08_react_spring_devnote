package com.example.devnote.crawler.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class NaverLoginFailureAnalyzerTest {
    @Test
    void classifiesImageSecurityQuestionAsAdditionalVerification() {
        NaverLoginFailureAnalyzer.Diagnosis diagnosis = NaverLoginFailureAnalyzer.diagnose(
            "보안을 위해 추가 확인을 해주세요 해당 영수증은 가상으로 제작된 것으로 실제 영수증 사진이 아니에요. 정답을 입력해 주세요"
        );

        assertThat(diagnosis.stage()).isEqualTo("네이버 추가 보안 확인");
        assertThat(diagnosis.reason()).contains("이미지 보안 질문");
        assertThat(diagnosis.action()).contains("직접 완료");
        assertThat(diagnosis.manualActionRequired()).isTrue();
    }

    @Test
    void keepsUnknownLoginFailuresHonest() {
        NaverLoginFailureAnalyzer.Diagnosis diagnosis = NaverLoginFailureAnalyzer.diagnose("로그인");

        assertThat(diagnosis.stage()).isEqualTo("로그인 완료 확인");
        assertThat(diagnosis.reason()).contains("구체적인 안내 문구를 찾지 못했습니다");
        assertThat(diagnosis.manualActionRequired()).isTrue();
    }
}
