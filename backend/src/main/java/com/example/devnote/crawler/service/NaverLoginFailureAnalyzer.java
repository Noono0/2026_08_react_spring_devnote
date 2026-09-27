package com.example.devnote.crawler.service;

final class NaverLoginFailureAnalyzer {
    record Diagnosis(String stage, String reason, String action, boolean manualActionRequired) {
    }

    private NaverLoginFailureAnalyzer() {
    }

    static Diagnosis diagnose(String bodyText) {
        String text = bodyText == null ? "" : bodyText.replaceAll("\\s+", " ").trim();
        if (text.contains("보안을 위해 추가 확인") || text.contains("정답을 입력해 주세요")) {
            return new Diagnosis(
                "네이버 추가 보안 확인",
                "네이버가 자동 로그인 대신 사람이 풀어야 하는 이미지 보안 질문을 표시했습니다.",
                "아래 Chromium 화면에서 보안 질문을 직접 완료해 주세요. 통과하면 크롤링이 자동으로 이어집니다.",
                true
            );
        }
        if (text.contains("자동입력 방지") || text.contains("보안문자") || text.contains("CAPTCHA")) {
            return new Diagnosis(
                "네이버 캡차 확인",
                "네이버가 자동입력 방지문자 또는 캡차 인증을 요구했습니다.",
                "아래 Chromium 화면에서 캡차를 직접 완료해 주세요. 통과하면 크롤링이 자동으로 이어집니다.",
                true
            );
        }
        if (text.contains("2단계 인증") || text.contains("2차 인증")) {
            return new Diagnosis(
                "네이버 2단계 인증",
                "네이버가 계정의 2단계 인증을 요구했습니다.",
                "아래 Chromium 화면과 인증 기기에서 2단계 인증을 완료해 주세요. 통과하면 크롤링이 자동으로 이어집니다.",
                true
            );
        }
        if (text.contains("아이디 또는 비밀번호") || text.contains("비밀번호를 확인")) {
            return new Diagnosis(
                "네이버 계정정보 확인",
                "네이버 로그인 화면이 아이디 또는 비밀번호가 맞지 않는다고 안내했습니다.",
                "입력한 아이디와 비밀번호를 확인한 뒤 다시 실행해 주세요.",
                false
            );
        }
        return new Diagnosis(
            "로그인 완료 확인",
            "로그인 버튼을 눌렀지만 네이버 로그인 쿠키가 만들어지지 않았습니다. 화면에서 구체적인 안내 문구를 찾지 못했습니다.",
            "아래 Chromium 화면에서 필요한 조작을 직접 완료해 보세요. 로그인 쿠키가 생기면 크롤링이 자동으로 이어집니다.",
            true
        );
    }
}
