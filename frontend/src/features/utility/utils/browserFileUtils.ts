/**
 * ============================================================================
 * browserFileUtils.ts — 복사하기 / 파일로 내려받기
 * ============================================================================
 *
 * 유틸리티 도구 대부분이 결과를 "복사" 또는 "다운로드"로 내보낸다.
 * 그 두 동작을 한곳에 모아 도구마다 다시 만들지 않게 했다.
 *
 * ★ 두 기능 모두 서버가 전혀 필요 없다.
 *   브라우저가 제공하는 기능만으로 처리하므로 저사양 서버에 부담이 없다.
 */

/**
 * 글자를 클립보드에 복사한다.
 *
 * navigator.clipboard: 브라우저의 클립보드 API.
 *
 * ★ 이 API는 아무 데서나 동작하지 않는다.
 *   - HTTPS(또는 localhost)에서만 쓸 수 있다
 *   - 사용자의 클릭 같은 동작에서 이어져 호출돼야 한다
 *     (페이지가 열리자마자 몰래 클립보드를 건드리는 것을 막기 위해서다)
 *   그래서 실패할 수 있고, 호출하는 쪽에서 catch로 안내를 띄운다.
 *
 * 빈 값이면 미리 막는다.
 * 복사는 됐는데 붙여넣으면 아무것도 없는 상황이 더 혼란스럽기 때문이다.
 */
export const copyText = async (value: string): Promise<void> => {
  if (!value) throw new Error("복사할 내용이 없습니다.");
  await navigator.clipboard.writeText(value);
};

/**
 * 글자를 파일로 만들어 내려받는다.
 *
 * ★ 서버에 파일을 만들지 않는다. 브라우저 메모리에서 만들어 바로 저장한다.
 *
 * [동작 순서]
 *   1) Blob — 글자를 "파일 같은 덩어리"로 만든다
 *   2) createObjectURL — 그 덩어리를 가리키는 임시 주소(blob:...)를 만든다
 *   3) <a download> — 화면에 붙이지 않은 링크를 만들어 코드로 클릭한다
 *   4) revokeObjectURL — 임시 주소를 해제한다
 *
 * ★ 4번을 빼먹으면 안 된다.
 *   임시 주소는 페이지를 떠날 때까지 메모리를 붙잡고 있다.
 *   큰 파일을 여러 번 내려받으면 메모리가 계속 쌓인다.
 *   "만들었으면 해제한다"는 짝을 지키는 습관이 중요하다.
 *
 * mimeType 기본값이 text/plain 인 이유:
 * 대부분 텍스트를 내려받지만, JSON·CSV·SVG처럼 종류를 알려야 하는 경우가 있어
 * 필요할 때만 바꿔 쓸 수 있게 열어 뒀다.
 */
export const downloadText = (fileName: string, value: string, mimeType = "text/plain;charset=utf-8"): void => {
  const blob = new Blob([value], { type: mimeType });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  // download 속성이 있어야 "이동"이 아니라 "저장"이 된다.
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(downloadUrl);
};
