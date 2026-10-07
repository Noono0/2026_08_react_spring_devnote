package com.example.devnote.member.dto;

/**
 * "지금 누가 로그인해 있는가"를 프론트에 알려 주는 응답입니다. (비밀번호 해시는 절대 담지 않는다)
 *
 * record: 값만 담는 불변 클래스를 짧게 쓰는 문법. 생성자·getter(authenticated())·equals·toString을 자동으로 만든다.
 * administrator / superAdministrator: 프론트가 관리자 메뉴를 보여 줄지 정할 때 쓴다(화면 표시용).
 *   ★ 실제 권한 검사는 서버의 Service가 다시 한다. 화면에서 메뉴를 숨기는 것만으로는 보안이 되지 않는다.
 */
public record AuthSessionResponse(
    boolean authenticated,
    Long memberId,
    String loginId,
    String memberName,
    String email,
    MemberGrade grade,
    MemberRole role,
    boolean administrator,
    boolean superAdministrator
) {
    /** 로그인하지 않은 사용자. null 대신 이 값을 돌려줘 프론트가 "비회원"을 따로 처리하지 않아도 되게 한다. */
    public static AuthSessionResponse guest() {
        return new AuthSessionResponse(false, null, null, "비회원", null, null, null, false, false);
    }
}
