/**
 * ============================================================================
 * VisitTracker.tsx — 페이지 방문 기록을 서버에 남기는 "보이지 않는" 컴포넌트
 * ============================================================================
 *
 * [핵심 개념: 화면을 안 그리는 컴포넌트도 있다]
 *   컴포넌트라고 해서 반드시 무언가를 그려야 하는 건 아니다.
 *   `return null`을 하면 화면에는 아무것도 안 나온다.
 *   대신 useEffect를 통해 "부수 효과(side effect)"만 실행한다.
 *   이 패턴은 방문 통계, 분석 도구 연동, 전역 단축키 등록 등에 자주 쓴다.
 *
 * [useEffect 3줄 요약]
 *   화면을 그리는 것 말고, 바깥 세상과 상호작용해야 할 때 쓰는 훅이다.
 *   (API 호출, 타이머, 이벤트 등록, localStorage 접근 등)
 *   컴포넌트 본문에서 바로 하면 안 되고, 반드시 useEffect 안에서 해야 한다.
 */

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { selectedHttpClient } from "@/shared/api/http/selectedHttpClient";

export const VisitTracker = () => {
  // 현재 주소 정보를 가져온다. 주소가 바뀌면 이 컴포넌트가 자동으로 다시 실행된다.
  const location = useLocation();

  useEffect(() => {
    void selectedHttpClient.post(`/visits?path=${encodeURIComponent(location.pathname)}`).catch(() => undefined);

    // ↑ 이 한 줄에 문법이 세 개나 겹쳐 있으니 하나씩 뜯어보자.
    //
    // 1) encodeURIComponent(...)
    //    주소에 그냥 넣으면 안 되는 글자(한글, 공백, & ? # 등)를 안전한 형태로 바꾼다.
    //    "/할 일" → "%2F%ED%95%A0%20%EC%9D%BC"
    //    이걸 안 하면 주소가 깨지거나, 악의적인 값이 끼어들 수 있다.
    //
    // 2) .catch(() => undefined)
    //    방문 통계는 "실패해도 사용자가 몰라도 되는" 부가 기능이다.
    //    통계 서버가 죽었다고 화면에 빨간 에러를 띄우면 오히려 이상하다.
    //    그래서 에러를 조용히 삼킨다.
    //    ★ 단, 이건 "실패해도 진짜 상관없는" 경우에만 허용되는 예외다.
    //      문서 저장 같은 중요한 요청에서 이러면 사용자가 데이터를 잃고도 모른다.
    //
    // 3) void
    //    post(...)는 Promise를 돌려주는데 결과를 안 기다린다.
    //    "일부러 안 기다리는 것"임을 린트 도구에 알려주는 표시다.

    // ── 의존성 배열(dependency array) ──────────────────────────────
    // 대괄호 안에 적은 값이 "이전과 달라졌을 때만" 위 코드를 다시 실행한다.
    //   [location.pathname] → 주소 경로가 바뀔 때마다 실행 (원하는 동작)
    //   []                  → 앱 켤 때 딱 한 번만 실행
    //   생략                → 다시 그려질 때마다 매번 실행 (대부분 실수! 무한 루프의 원인)
    //
    // 여기서 `location` 전체가 아니라 `location.pathname`만 넣은 게 포인트다.
    // location은 주소가 같아도 매번 새 객체로 만들어질 수 있어서
    // 그걸 넣으면 쓸데없이 여러 번 실행될 수 있다.
  }, [location.pathname]);

  // 그릴 화면이 없다는 뜻. `return null`은 React에서 정상적인 반환값이다.
  return null;
};
