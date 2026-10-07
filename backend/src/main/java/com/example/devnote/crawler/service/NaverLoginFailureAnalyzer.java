package com.example.devnote.crawler.service;

/**
 * 네이버 로그인이 끝나지 않았을 때 화면 글자를 보고 원인을 추정합니다.
 * 원인마다 단계 이름·설명·해 볼 일과 "사람이 화면에서 직접 처리하면 이어서 진행할 수 있는지"(manualActionRequired)를 정한다.
 *   보호조치·비밀번호 오류 → 자동으로 더 시도하지 않음(false)
 *   보안 질문·캡차·2단계 인증 → 사람이 실시간 화면에서 직접 풀면 계속(true)
 * ★ 크롤러는 캡차를 자동으로 풀지 않는다. 사람이 직접 처리하도록 안내만 한다.
 */
final class NaverLoginFailureAnalyzer {
    record Diagnosis(String stage, String reason, String action, boolean manualActionRequired) {
    }

    private NaverLoginFailureAnalyzer() {
    }

    static Diagnosis diagnose(String bodyText) {
        String text = bodyText == null ? "" : bodyText.replaceAll("\\s+", " ").trim();
        if (text.contains("보호조치 해제") || text.contains("아이디가 보호조치")) {
            return new Diagnosis(
                "네이버 계정 보호조치",
                "네이버가 이 아이디에 보호조치를 적용했습니다. 크롤러에서 추가 로그인을 시도하지 않습니다.",
                "네이버 공식 화면에서 본인 확인과 로그인 기록 확인을 마친 뒤, 수집 허용 범위를 검토해 주세요.",
                false
            );
        }
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
