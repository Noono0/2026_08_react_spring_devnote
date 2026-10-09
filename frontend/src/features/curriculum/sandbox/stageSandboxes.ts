/**
 * stageSandboxes.ts — 학습 단계(guideId) → 사이트 안 편집기(Sandpack)에 넣을 예제 원문
 *
 * `?raw`: Vite가 파일을 실행하지 않고 "파일 내용 문자열"로 가져온다. 편집기에 그 문자열을 그대로 넣는다.
 * 예제는 진짜 .tsx 파일이라 tsc·ESLint가 함께 검사한다. 그래서 학습자에게 깨진 예제가 보이지 않는다.
 *
 * ★ 이 파일은 StageSandboxDialog에서만 import한다(편집기를 열 때 함께 불러오는 지연 로딩 묶음).
 *   다른 곳에서 import하면 25개 예제 원문이 첫 화면 번들에 섞인다.
 */
import fundamentals from "./examples/01-fundamentals.tsx?raw";
import todo from "./examples/02-todo.tsx?raw";
import contact from "./examples/03-contact.tsx?raw";
import product from "./examples/04-product.tsx?raw";
import search from "./examples/05-search.tsx?raw";
import board from "./examples/06-board.tsx?raw";
import gallery from "./examples/07-gallery.tsx?raw";
import comment from "./examples/08-comment.tsx?raw";
import reservation from "./examples/09-reservation.tsx?raw";
import task from "./examples/10-task.tsx?raw";
import inquiry from "./examples/11-inquiry.tsx?raw";
import category from "./examples/12-category.tsx?raw";
import admin from "./examples/13-admin-users.tsx?raw";
import documentExample from "./examples/14-documents.tsx?raw";
import infiniteFeed from "./examples/15-infinite-feed.tsx?raw";
import dynamicForm from "./examples/16-dynamic-form.tsx?raw";
import contextAuth from "./examples/17-context-auth.tsx?raw";
import reactActions from "./examples/18-react19-actions.tsx?raw";
import customHooks from "./examples/19-custom-hooks.tsx?raw";
import performance from "./examples/20-performance.tsx?raw";
import zustand from "./examples/21-zustand.tsx?raw";
import urlState from "./examples/22-url-state.tsx?raw";
import refsFocus from "./examples/23-refs-focus.tsx?raw";
import useSuspense from "./examples/24-use-suspense.tsx?raw";
import testing from "./examples/25-testing.tsx?raw";

/** 키는 learningGuides.ts의 guideId와 같다. 새 단계를 추가하면 예제 파일과 이 표를 함께 늘린다. */
export const stageSandboxSources: Record<string, string> = {
  fundamentals,
  todo,
  contact,
  product,
  search,
  board,
  gallery,
  comment,
  reservation,
  task,
  inquiry,
  category,
  admin,
  document: documentExample,
  "infinite-feed": infiniteFeed,
  "dynamic-form": dynamicForm,
  "context-auth": contextAuth,
  "react19-actions": reactActions,
  "custom-hooks": customHooks,
  performance,
  zustand,
  "url-state": urlState,
  "refs-focus": refsFocus,
  "use-suspense": useSuspense,
  testing,
};
