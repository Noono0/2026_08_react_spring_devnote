/**
 * ============================================================================
 * useDocumentQueries.ts — 문서 기능의 TanStack Query 훅 모음
 * ============================================================================
 *
 * TaskManagementPage에서는 useQuery/useMutation을 페이지 안에 직접 썼다.
 * 여기서는 그걸 "커스텀 훅"으로 빼냈다.
 *
 * [커스텀 훅으로 빼는 이유]
 *   문서 목록은 두 페이지에서 쓴다 (/react/documents, /history).
 *   페이지마다 useQuery를 쓰면 queryKey를 각자 적게 되고,
 *   한 글자만 달라도 서로 다른 캐시가 되어 요청이 두 번 나간다.
 *   훅으로 묶으면 그런 실수가 원천적으로 불가능하다.
 *
 * [커스텀 훅이란?]
 *   이름이 `use`로 시작하고 안에서 다른 훅을 쓰는 그냥 평범한 함수다.
 *   특별한 문법은 없다. 훅을 쓰는 로직을 재사용하려고 함수로 묶은 것뿐이다.
 *
 * [파일 구성]
 *   1. documentQueryKeys — 캐시 키를 만드는 공장
 *   2. 조회 훅 2개 (목록, 상세)
 *   3. 변경 훅 3개 (등록, 수정, 삭제)
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDocument,
  deleteDocument,
  getDocumentDetail,
  getDocumentList,
  updateDocument,
} from "../api/documentApi";
import type { DocumentSaveRequest, DocumentSearchCondition } from "../types/documentTypes";

/**
 * ★★ Query Key Factory — TanStack Query를 쓸 때 꼭 익혀 둘 패턴이다.
 *
 * [해결하려는 문제]
 *   queryKey를 여기저기서 문자열로 직접 쓰면 이런 사고가 난다.
 *     A파일: ["documents", "list"]
 *     B파일: ["document", "list"]   ← 오타! 서로 다른 캐시가 된다
 *   무효화(invalidate)할 때 키가 안 맞아서 "저장했는데 목록이 그대로"인
 *   버그가 생기고, 원인 찾기가 매우 어렵다.
 *
 * [해결책]
 *   키를 만드는 곳을 한 군데로 모은다. 오타를 내면 TypeScript가 잡아 준다.
 *
 * [키가 계층 구조인 것이 핵심이다]
 *   all     → ["documents"]
 *   lists() → ["documents", "list"]
 *   list()  → ["documents", "list", "practice", { 검색조건 }]
 *   detail()→ ["documents", "detail", "practice", 42]
 *
 *   TanStack Query는 키를 "앞에서부터" 비교한다.
 *   그래서 상위 키로 무효화하면 그 아래가 전부 무효화된다.
 *     lists()로 무효화 → 모든 목록 캐시가 갱신 대상 (상세는 그대로)
 *     all로 무효화     → 목록과 상세 전부 갱신 대상
 *   덕분에 "어디까지 새로 받을지"를 정확하게 조절할 수 있다.
 *
 * [`as const`가 붙은 이유]
 *   이걸 안 붙이면 타입이 그냥 string[]이 된다.
 *   붙이면 readonly ["documents", "list"] 처럼 값까지 고정된 타입이 되어
 *   키를 잘못 조합했을 때 TypeScript가 잡아낼 수 있다.
 */
export const documentQueryKeys = {
  all: ["documents"] as const,
  lists: () => [...documentQueryKeys.all, "list"] as const,
  // ★ 검색 조건 객체를 키에 통째로 넣는다.
  //   조건이 하나라도 바뀌면 키가 달라지고 → 자동으로 새로 요청한다.
  //   "언제 다시 불러올지"를 우리가 고민할 필요가 없어진다.
  //   (조건별로 캐시가 따로 쌓이므로 뒤로 가면 즉시 표시되기도 한다)
  list: (condition: DocumentSearchCondition, history: boolean) => [...documentQueryKeys.lists(), history ? "history" : "practice", condition] as const,
  details: () => [...documentQueryKeys.all, "detail"] as const,
  detail: (documentId: number, history: boolean) => [...documentQueryKeys.details(), history ? "history" : "practice", documentId] as const,
};

/**
 * 【Read】 문서 목록 조회 훅.
 */
export const useDocumentListQuery = (condition: DocumentSearchCondition, history = false) =>
  useQuery({
    queryKey: documentQueryKeys.list(condition, history),

    // ★ queryFn이 받는 `{ signal }`에 주목!
    //   TanStack Query가 요청 취소용 signal을 자동으로 만들어 넘겨 준다.
    //   이걸 API로 전달하면, 화면을 떠나거나 조건이 바뀔 때
    //   진행 중이던 요청이 자동으로 취소된다.
    //   SearchAutocompletePracticePage에서 손으로 만들었던 AbortController를
    //   라이브러리가 대신 해 주는 것이다.
    queryFn: ({ signal }) => getDocumentList(condition, signal, history),

    // ★★ placeholderData — 사용자 경험을 크게 바꾸는 한 줄.
    //
    //   이게 없으면: 2페이지를 누르는 순간 목록이 사라지고(data가 undefined)
    //               로딩 화면이 떴다가 새 목록이 나타난다. 화면이 깜빡인다.
    //   이게 있으면: 새 데이터가 도착할 때까지 이전 페이지 내용을 그대로 보여준다.
    //               깜빡임 없이 부드럽게 전환된다.
    //
    //   (previousData) => previousData
    //     = "새 데이터를 기다리는 동안 직전 데이터를 그대로 써라"
    //
    //   페이지네이션이나 필터가 있는 목록에는 거의 항상 넣는 게 좋다.
    placeholderData: (previousData) => previousData,
  });

/**
 * 【Read】 문서 상세 조회 훅.
 *
 * 매개변수가 `number | undefined`인 이유:
 * URL에서 꺼낸 id는 없을 수도 있고 숫자가 아닐 수도 있다.
 * 그 불확실함을 타입에 정직하게 드러낸 것이다.
 */
export const useDocumentDetailQuery = (documentId: number | undefined, history = false) =>
  useQuery({
    // id가 없으면 임시로 0을 쓴다. 어차피 아래 enabled가 false라 실행되지 않는다.
    // (queryKey 자리에는 undefined를 넣을 수 없어서 넣는 자리채움 값이다)
    queryKey: documentQueryKeys.detail(documentId ?? 0, history),

    // `documentId as number` — enabled 조건 덕분에 여기 도달했다면
    // documentId는 반드시 숫자다. 그걸 TypeScript에 알려 주는 단언이다.
    queryFn: ({ signal }) => getDocumentDetail(documentId as number, signal, history),

    // ★★ enabled — "조건이 맞을 때만 요청해라"
    //
    //   이게 없으면 /documents/바나나 같은 주소에서
    //   id가 undefined인 채로 요청이 나가 서버에 400 오류를 유발한다.
    //
    //   세 가지를 확인한다:
    //     documentId !== undefined      → 값이 있는가
    //     Number.isSafeInteger(id)      → 정수인가 (3.5나 NaN, 문자열 배제)
    //     documentId > 0                → 양수인가 (id는 1부터 시작)
    //
    //   ★ Number.isSafeInteger를 쓴 이유
    //     그냥 typeof === "number"로 하면 NaN도 통과한다. (NaN의 타입은 number다!)
    //     isSafeInteger는 NaN, Infinity, 소수를 전부 걸러 준다.
    //
    //   "URL은 사용자가 조작할 수 있는 입력값"이라는 원칙을 여기서도 적용한 것이다.
    enabled: documentId !== undefined && Number.isSafeInteger(documentId) && documentId > 0,
  });

/**
 * 【Create】 문서 등록 훅.
 *
 * ★ 훅 안에서 useQueryClient를 부르는 게 포인트다.
 *   덕분에 쓰는 쪽 페이지는 캐시 무효화를 신경 쓸 필요가 전혀 없다.
 *   그냥 .mutate(데이터)만 부르면 목록이 알아서 갱신된다.
 */
export const useCreateDocumentMutation = (history = false) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: DocumentSaveRequest) => createDocument(request, history),
    onSuccess: async () => {
      // ★ lists()로 무효화한다. all이 아니라는 점이 중요하다.
      //   새 문서가 생기면 목록은 달라지지만,
      //   기존 문서들의 "상세" 내용은 전혀 바뀌지 않았다.
      //   그것까지 다시 받으면 불필요한 요청이 생긴다.
      //   딱 필요한 범위만 무효화하는 것이 좋은 습관이다.
      await queryClient.invalidateQueries({ queryKey: documentQueryKeys.lists() });
    },
  });
};

/**
 * 【Update】 문서 수정 훅.
 */
export const useUpdateDocumentMutation = (documentId: number, history = false) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: DocumentSaveRequest) => updateDocument(documentId, request, history),

    // onSuccess의 첫 번째 인자 = mutationFn이 돌려준 값.
    // 여기서는 서버가 응답한 "수정된 문서"가 들어온다.
    onSuccess: async (updatedDocument) => {
      // ★★ 두 가지를 다르게 처리한 점이 이 훅의 핵심이다.
      //
      //   (1) 상세 캐시 → setQueryData 로 "바로 채워 넣는다"
      //       서버가 이미 최신 문서를 돌려줬는데
      //       똑같은 걸 또 요청하는 건 낭비다. 그냥 넣어 준다.
      //       덕분에 저장 후 상세 화면이 지연 없이 즉시 최신 내용을 보여준다.
      //
      //   (2) 목록 캐시 → invalidateQueries 로 "다시 받는다"
      //       목록은 정렬 순서나 페이지 구성이 달라졌을 수 있다.
      //       응답 하나로는 그걸 알 수 없으므로 서버에 다시 물어본다.
      //
      //   "알 수 있으면 채워 넣고, 모르면 다시 받는다"는 판단 기준을 익혀 두자.
      queryClient.setQueryData(documentQueryKeys.detail(documentId, history), updatedDocument);
      await queryClient.invalidateQueries({ queryKey: documentQueryKeys.lists() });
    },
  });
};

/**
 * 【Delete】 문서 삭제 훅.
 */
export const useDeleteDocumentMutation = (history = false) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: number) => deleteDocument(documentId, history),
    onSuccess: async () => {
      // ★ 여기서는 lists()가 아니라 all로 무효화한다.
      //   삭제된 문서의 "상세" 캐시가 남아 있으면
      //   뒤로 가기로 그 주소에 들어갔을 때 이미 없는 문서가 멀쩡히 보인다.
      //   목록과 상세를 전부 무효화해야 안전하다.
      await queryClient.invalidateQueries({ queryKey: documentQueryKeys.all });
    },
  });
};
