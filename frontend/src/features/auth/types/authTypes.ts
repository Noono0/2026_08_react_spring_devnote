/**
 * ============================================================================
 * authTypes.ts — 로그인·회원 관련 타입
 * ============================================================================
 */

/** 회원의 역할(권한 등급). */
export type MemberRole = "USER" | "ADMIN" | "SUPER_ADMIN";

/** 회원 등급(활동 등급). 역할과는 다른 개념이다. */
export type MemberGrade = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND";

/**
 * 현재 로그인 상태.
 *
 * ★ `?`가 붙은 것과 안 붙은 것의 차이가 이 타입의 핵심이다.
 *
 *   authenticated / memberName / administrator / superAdministrator
 *     → `?` 없음. 로그인 안 했을 때도 반드시 값이 온다.
 *   memberId / loginId / email / grade / role
 *     → `?` 있음. 로그인해야만 값이 있다.
 *
 *   비로그인 상태의 응답은 대략 이렇다:
 *     { authenticated: false, memberName: "손님",
 *       administrator: false, superAdministrator: false }
 *
 *   ★ 왜 이렇게 설계하면 좋은가?
 *     "로그인 안 했으면 null을 준다"고 하면 쓰는 쪽에서 매번
 *     `session === null` 을 확인해야 하고, 빠뜨리면 앱이 죽는다.
 *     항상 객체가 오되 authenticated로 구분하면 훨씬 다루기 쉽다.
 */
export interface AuthSession {
  authenticated: boolean;
  memberId?: number;
  loginId?: string;
  memberName: string;
  email?: string;
  grade?: MemberGrade;
  role?: MemberRole;

  // ★ role만 있어도 계산할 수 있는데 왜 boolean을 따로 줄까?
  //   화면 코드가 `role === "ADMIN" || role === "SUPER_ADMIN"` 같은
  //   판정 규칙을 알아야 하는 상황을 피하기 위해서다.
  //   나중에 "MANAGER도 관리자에 포함"으로 규칙이 바뀌면
  //   서버만 고치면 되고 프론트는 손댈 필요가 없다.
  //   판단은 서버가, 화면은 결과만 쓰는 구조다.
  administrator: boolean;
  superAdministrator: boolean;
}

/** 회원가입 요청. */
export interface RegisterRequest {
  loginId: string;
  // ★ 비밀번호는 응답 타입(AuthSession)에는 절대 없어야 한다.
  //   서버가 비밀번호를 돌려주는 일은 있어서는 안 된다.
  //   타입만 봐도 "보내기만 하고 받지 않는 값"임이 드러난다.
  password: string;
  memberName: string;
  email: string;
}

/** 로그인 요청. */
export interface LoginRequest {
  loginId: string;
  password: string;
  // 자동 로그인 체크 여부. 서버가 세션 유지 기간을 길게 잡는 데 쓴다.
  autoLogin: boolean;
}
