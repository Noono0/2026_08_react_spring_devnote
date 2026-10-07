/**
 * 테스트 전용 도우미.
 *
 * getAllByRole(...)[0]은 TypeScript가 "없을 수도 있다(undefined)"고 보므로 단언(as) 없이 꺼내기 위한 함수다.
 * 항목이 없으면 원인을 알려 주는 오류로 테스트를 실패시킨다.
 */
export const firstItem = <Item>(items: Item[]): Item => {
  const [item] = items;
  if (item === undefined) throw new Error("찾는 요소가 없습니다.");
  return item;
};

/**
 * jsdom에는 <dialog>의 showModal()/close()가 없다. 모달을 여는 화면 테스트에서 beforeAll로 한 번 설치한다.
 * (실제 브라우저처럼 open 속성만 켜고 끈다. 포커스 가두기 같은 브라우저 동작까지 흉내 내지는 않는다)
 */
export const installDialogPolyfill = (): void => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) { this.open = true; },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) { this.open = false; },
  });
};

/** element에서 가장 가까운 조상 중 selector에 맞는 요소. 없으면 테스트를 실패시킨다. (예: 댓글 본문 → 그 댓글 카드) */
export const closestElement = (element: Element, selector: string): HTMLElement => {
  const ancestor = element.closest(selector);
  if (!(ancestor instanceof HTMLElement)) throw new Error(`${selector} 조상 요소가 없습니다.`);
  return ancestor;
};
