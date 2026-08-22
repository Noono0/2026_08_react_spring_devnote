/**
 * ============================================================================
 * ModalDialog.tsx — 앱 전체가 함께 쓰는 공통 모달(팝업) 컴포넌트
 * ============================================================================
 *
 * [이 파일에서 배울 개념 — 아주 중요한 것들이 모여 있다]
 *   1. useRef   : 실제 DOM 요소를 직접 잡는 방법
 *   2. useId    : 접근성 연결용 고유 id 만들기
 *   3. useEffect: React 상태와 브라우저 기능을 동기화하기
 *   4. children / ReactNode : 컴포넌트에 "내용물"을 끼워 넣는 패턴
 *   5. 이벤트 버블링과 target/currentTarget의 차이
 *
 * [<dialog> 태그를 쓰는 이유]
 *   모달을 <div>로 직접 만들면 신경 쓸 게 산더미다.
 *     - 뒤 배경을 어둡게 깔기
 *     - 모달 밖으로 Tab 키가 빠져나가지 않게 가두기(focus trap)
 *     - ESC 키로 닫기
 *     - 열렸을 때 뒤쪽 내용을 화면 낭독기에서 숨기기
 *     - 다른 요소보다 항상 위에 그리기(z-index 전쟁)
 *
 *   브라우저 기본 <dialog> 태그의 showModal()을 쓰면 이걸 전부 공짜로 해 준다.
 *   "직접 만들 수 있다"와 "직접 만드는 게 낫다"는 전혀 다른 이야기다.
 */

import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

interface StoredModalSize {
  width: number;
  height: number;
}

interface ModalResizePointerState extends StoredModalSize {
  pointerId: number;
  pointerX: number;
  pointerY: number;
}

const MODAL_SIZE_STORAGE_PREFIX = "devnote:modal-size:";
const MODAL_MINIMUM_WIDTH = 420;
const MODAL_MINIMUM_HEIGHT = 300;
const MODAL_VIEWPORT_GAP = 32;
const MODAL_MOBILE_BREAKPOINT = 600;
const MODAL_KEYBOARD_RESIZE_STEP = 16;

const getModalSizeBounds = (): StoredModalSize => ({
  width: Math.max(1, window.innerWidth - MODAL_VIEWPORT_GAP),
  height: Math.max(1, window.innerHeight - MODAL_VIEWPORT_GAP),
});

const clampModalSize = (width: number, height: number): StoredModalSize => {
  const maximumSize = getModalSizeBounds();
  const minimumWidth = Math.min(MODAL_MINIMUM_WIDTH, maximumSize.width);
  const minimumHeight = Math.min(MODAL_MINIMUM_HEIGHT, maximumSize.height);

  return {
    width: Math.min(Math.max(width, minimumWidth), maximumSize.width),
    height: Math.min(Math.max(height, minimumHeight), maximumSize.height),
  };
};

const applyModalSize = (dialogElement: HTMLDialogElement, width: number, height: number): void => {
  const nextSize = clampModalSize(width, height);
  dialogElement.style.width = `${nextSize.width}px`;
  dialogElement.style.height = `${nextSize.height}px`;
};

const readStoredModalSize = (storageKey: string): StoredModalSize | undefined => {
  const storedValue = localStorage.getItem(storageKey);
  if (!storedValue) return undefined;

  try {
    const parsedValue: unknown = JSON.parse(storedValue);
    if (
      typeof parsedValue === "object"
      && parsedValue !== null
      && "width" in parsedValue
      && "height" in parsedValue
      && typeof parsedValue.width === "number"
      && Number.isFinite(parsedValue.width)
      && typeof parsedValue.height === "number"
      && Number.isFinite(parsedValue.height)
    ) {
      return clampModalSize(parsedValue.width, parsedValue.height);
    }
  } catch (error: unknown) {
    console.warn("[ModalDialog] 저장된 모달 크기를 해석하지 못했습니다.", { storageKey, error });
  }

  localStorage.removeItem(storageKey);
  return undefined;
};

const storeModalSize = (storageKey: string, dialogElement: HTMLDialogElement): void => {
  const dialogRectangle = dialogElement.getBoundingClientRect();
  const width = dialogRectangle.width || Number.parseFloat(dialogElement.style.width);
  const height = dialogRectangle.height || Number.parseFloat(dialogElement.style.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return;

  try {
    localStorage.setItem(storageKey, JSON.stringify(clampModalSize(width, height)));
  } catch (error: unknown) {
    console.warn("[ModalDialog] 사용자가 조절한 모달 크기를 저장하지 못했습니다.", { storageKey, error });
  }
};

/**
 * 이 컴포넌트가 받는 props 목록.
 *
 * ★ props 타입을 이렇게 따로 정의해 두면
 *   다른 사람이 <ModalDialog />를 쓸 때 에디터가 자동완성으로 알려 준다.
 *   필수 항목을 빠뜨리면 빨간 줄이 바로 뜬다.
 */
interface ModalDialogProps {
  isOpen: boolean;        // 열려 있는지 여부. 부모가 State로 관리해서 넘겨 준다.
  title: string;          // 모달 제목 (필수)
  description?: string;   // 제목 밑 부가 설명 (선택)

  // ReactNode: "React가 그릴 수 있는 모든 것"을 담는 타입.
  // JSX 태그, 문자열, 숫자, 배열, null 전부 가능하다.
  // children이라는 이름은 특별해서, 태그 사이에 넣은 내용이 여기로 들어온다.
  //   <ModalDialog>여기 있는 게 children</ModalDialog>
  children: ReactNode;

  // 아래쪽 버튼 영역. 이것도 JSX를 통째로 받는다.
  // 확인/취소 버튼의 개수와 문구가 상황마다 달라서, 내부에서 정하지 않고 밖에서 받는다.
  // 이런 패턴을 "슬롯(slot)"이라고 부른다.
  footer?: ReactNode;

  // 닫아 달라는 "요청"을 부모에게 전달하는 함수.
  //
  // ★ 이름이 onClose가 아니라 onRequestClose인 게 의미심장하다.
  //   이 컴포넌트는 스스로 닫히지 않는다. 닫을 권한이 없다.
  //   isOpen을 가진 건 부모이므로, "닫고 싶어요"라고 알리기만 한다.
  //   실제로 닫을지는 부모가 결정한다. (저장 중엔 안 닫을 수도 있다)
  //   이런 구조를 "제어 컴포넌트(controlled component)"라고 한다.
  onRequestClose: () => void;

  closeOnBackdropClick?: boolean;  // 배경 클릭으로 닫히게 할지
  size?: "default" | "large";      // 모달 크기
  resizable?: boolean;             // 사용자가 가로·세로 크기를 조절할 수 있게 할지
  resizeStorageKey?: string;       // 조절한 크기를 다시 열 때 복원할 저장 키
}

/**
 * 브라우저의 native dialog 요소를 감싼 공통 모달입니다.
 *
 * 학습 포인트:
 * - isOpen 상태를 실제 dialog.showModal()/close()와 동기화합니다.
 * - ESC 키와 배경 클릭으로 닫을 수 있습니다.
 * - 제목과 설명을 aria 속성으로 연결해 접근성을 높입니다.
 */
export const ModalDialog = ({
  isOpen,
  title,
  description,
  children,
  footer,
  onRequestClose,
  // `= true` 는 기본값(default parameter)이다.
  // 안 넘기면 true가 되고, 필요할 때만 false로 덮어쓸 수 있다.
  // "대부분의 경우 이렇게 동작하고, 예외적으로 바꿀 수 있다"를 표현하는 좋은 방법이다.
  closeOnBackdropClick = true,
  size = "default",
  resizable = false,
  resizeStorageKey,
}: ModalDialogProps) => {
  // ── useRef: 실제 DOM 요소를 손에 쥐기 ────────────────────────────
  // React는 보통 "상태를 바꾸면 화면이 알아서 바뀐다"는 방식이라
  // DOM을 직접 만질 일이 거의 없다.
  // 하지만 showModal() 같은 "DOM에만 있는 명령"은 직접 불러야 한다.
  //
  // 아래 JSX에서 ref={dialogReference} 라고 연결해 두면
  // React가 실제 <dialog> 요소를 dialogReference.current에 넣어 준다.
  //
  // 처음 값이 null인 이유: 화면에 그려지기 전에는 요소가 아직 없기 때문이다.
  const dialogReference = useRef<HTMLDialogElement>(null);
  const resizePointerStateReference = useRef<ModalResizePointerState | undefined>(undefined);
  const resolvedResizeStorageKey = resizeStorageKey
    ? `${MODAL_SIZE_STORAGE_PREFIX}${resizeStorageKey}`
    : undefined;

  // ── useId: 충돌하지 않는 고유 id 만들기 ──────────────────────────
  // 아래에서 aria-labelledby로 "제목이 어디 있는지" 연결하려면 id가 필요하다.
  //
  // ★ 그냥 id="modal-title" 이라고 고정하면 안 되나?
  //   모달이 화면에 두 개 열리면 같은 id가 두 개 생긴다.
  //   HTML에서 id는 페이지 안에서 유일해야 한다는 규칙이 있고,
  //   중복되면 화면 낭독기가 엉뚱한 걸 읽는다.
  //   useId는 React가 매번 다른 값("«r1»" 같은 것)을 만들어 줘서 이 문제를 없앤다.
  const titleElementId = useId();
  const descriptionElementId = useId();

  // ── useEffect: React 상태와 브라우저 기능 맞추기 ─────────────────
  // isOpen은 React의 세계에 있는 true/false일 뿐이다.
  // 실제로 모달을 띄우려면 DOM의 showModal()을 불러 줘야 한다.
  // 이렇게 "React 바깥 세상과 상태를 맞추는" 일이 useEffect의 대표적인 용도다.
  useEffect(() => {
    const dialogElement = dialogReference.current;
    // 아직 요소가 없으면(첫 렌더 직전 등) 아무것도 하지 않는다.
    if (!dialogElement) {
      return;
    }

    // ★ `!dialogElement.open` 조건이 왜 필요할까?
    //   이미 열려 있는 dialog에 showModal()을 또 부르면 브라우저가 에러를 던진다.
    //   "지금 상태"를 확인하고 필요할 때만 명령하는 것을 방어적 코딩이라고 한다.
    if (isOpen && !dialogElement.open) {
      dialogElement.showModal();
      return;
    }

    // 반대 방향: 닫으라고 했는데 아직 열려 있으면 닫는다.
    if (!isOpen && dialogElement.open) {
      dialogElement.close();
    }
    // 의존성 배열에 isOpen만 넣었다.
    // isOpen이 바뀔 때만 열고 닫기를 다시 판단하면 되기 때문이다.
  }, [isOpen]);

  // 긴 도움말이나 에디터 모달은 사용자가 조절한 크기를 다음 실행에서도 복원한다.
  // 모바일에서는 화면 너비에 맞춘 반응형 크기가 우선이므로 저장 크기를 적용하지 않는다.
  useEffect(() => {
    const dialogElement = dialogReference.current;
    if (
      !isOpen
      || !resizable
      || !resolvedResizeStorageKey
      || !dialogElement
      || window.innerWidth <= MODAL_MOBILE_BREAKPOINT
    ) {
      return;
    }

    const storedSize = readStoredModalSize(resolvedResizeStorageKey);
    if (storedSize) applyModalSize(dialogElement, storedSize.width, storedSize.height);
  }, [isOpen, resizable, resolvedResizeStorageKey]);

  const getCurrentModalSize = (): StoredModalSize => {
    const dialogElement = dialogReference.current;
    const fallbackWidth = size === "large" ? 980 : 620;
    const fallbackHeight = Math.min(680, window.innerHeight - MODAL_VIEWPORT_GAP);
    if (!dialogElement) return clampModalSize(fallbackWidth, fallbackHeight);

    const dialogRectangle = dialogElement.getBoundingClientRect();
    return clampModalSize(
      dialogRectangle.width || Number.parseFloat(dialogElement.style.width) || fallbackWidth,
      dialogRectangle.height || Number.parseFloat(dialogElement.style.height) || fallbackHeight,
    );
  };

  const saveCurrentModalSize = (): void => {
    const dialogElement = dialogReference.current;
    if (dialogElement && resolvedResizeStorageKey) storeModalSize(resolvedResizeStorageKey, dialogElement);
  };

  const handleResizePointerDown = (pointerEvent: PointerEvent<HTMLButtonElement>): void => {
    if (window.innerWidth <= MODAL_MOBILE_BREAKPOINT) return;

    const currentSize = getCurrentModalSize();
    resizePointerStateReference.current = {
      pointerId: pointerEvent.pointerId,
      pointerX: pointerEvent.clientX,
      pointerY: pointerEvent.clientY,
      ...currentSize,
    };
    pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId);
    pointerEvent.preventDefault();
  };

  const handleResizePointerMove = (pointerEvent: PointerEvent<HTMLButtonElement>): void => {
    const resizeState = resizePointerStateReference.current;
    const dialogElement = dialogReference.current;
    if (!resizeState || resizeState.pointerId !== pointerEvent.pointerId || !dialogElement) return;

    applyModalSize(
      dialogElement,
      resizeState.width + pointerEvent.clientX - resizeState.pointerX,
      resizeState.height + pointerEvent.clientY - resizeState.pointerY,
    );
  };

  const finishPointerResize = (pointerEvent: PointerEvent<HTMLButtonElement>): void => {
    const resizeState = resizePointerStateReference.current;
    if (!resizeState || resizeState.pointerId !== pointerEvent.pointerId) return;

    resizePointerStateReference.current = undefined;
    if (pointerEvent.currentTarget.hasPointerCapture(pointerEvent.pointerId)) {
      pointerEvent.currentTarget.releasePointerCapture(pointerEvent.pointerId);
    }
    saveCurrentModalSize();
  };

  const handleResizeKeyDown = (keyboardEvent: KeyboardEvent<HTMLButtonElement>): void => {
    const horizontalDirection = keyboardEvent.key === "ArrowRight" ? 1 : keyboardEvent.key === "ArrowLeft" ? -1 : 0;
    const verticalDirection = keyboardEvent.key === "ArrowDown" ? 1 : keyboardEvent.key === "ArrowUp" ? -1 : 0;
    if (horizontalDirection === 0 && verticalDirection === 0) return;

    const dialogElement = dialogReference.current;
    if (!dialogElement) return;

    keyboardEvent.preventDefault();
    const resizeStep = keyboardEvent.shiftKey ? MODAL_KEYBOARD_RESIZE_STEP * 3 : MODAL_KEYBOARD_RESIZE_STEP;
    const currentSize = getCurrentModalSize();
    applyModalSize(
      dialogElement,
      currentSize.width + horizontalDirection * resizeStep,
      currentSize.height + verticalDirection * resizeStep,
    );
    saveCurrentModalSize();
  };

  const resetModalSize = (): void => {
    const dialogElement = dialogReference.current;
    if (!dialogElement) return;

    dialogElement.style.removeProperty("width");
    dialogElement.style.removeProperty("height");
    if (resolvedResizeStorageKey) localStorage.removeItem(resolvedResizeStorageKey);
  };

  /**
   * 모달 바깥(어두운 배경)을 클릭했을 때 닫는 처리.
   *
   * ★★ 여기가 이 파일에서 가장 헷갈리는 부분이다. 천천히 보자.
   *
   * [이벤트 버블링(bubbling)]
   *   안쪽 요소를 클릭하면 그 이벤트가 바깥 요소로 "거품처럼 올라간다".
   *   모달 내용 안의 버튼을 눌러도 그 클릭은 결국 <dialog>까지 전달된다.
   *   그래서 아무 조건 없이 닫으면, 안쪽을 눌러도 모달이 닫혀 버린다.
   *
   * [target vs currentTarget — 이 둘의 차이가 해결책이다]
   *   target        = 실제로 클릭된 요소 (가장 안쪽 것)
   *   currentTarget = 이 핸들러가 붙어 있는 요소 (여기서는 항상 <dialog>)
   *
   *   배경을 눌렀다면        → target === currentTarget (둘 다 dialog)  → 닫는다
   *   모달 안 버튼을 눌렀다면 → target(button) ≠ currentTarget(dialog) → 무시한다
   *
   *   ※ <dialog>의 어두운 배경(::backdrop)은 dialog 자신의 일부라서
   *     배경 클릭도 target이 dialog로 잡힌다. 그래서 이 방법이 통한다.
   */
  const handleBackdropClick = (clickEvent: MouseEvent<HTMLDialogElement>): void => {
    if (!closeOnBackdropClick || clickEvent.target !== clickEvent.currentTarget) {
      return;
    }

    onRequestClose();
  };

  return (
    <dialog
      // ref로 위에서 만든 상자와 실제 DOM 요소를 연결한다.
      ref={dialogReference}
      className={`modal-dialog${size === "large" ? " modal-dialog-large" : ""}${resizable ? " modal-dialog-resizable" : ""}`}

      // aria-labelledby: "이 모달의 이름은 저 id를 가진 요소의 글자다"라는 연결.
      // 화면 낭독기가 모달이 열릴 때 제목을 먼저 읽어 준다.
      aria-labelledby={titleElementId}

      // 설명이 없으면 undefined를 줘서 속성 자체를 안 붙인다.
      // 존재하지 않는 id를 가리키는 aria 속성은 오히려 접근성을 해친다.
      aria-describedby={description ? descriptionElementId : undefined}

      // onCancel: <dialog>가 ESC 키를 감지했을 때 부르는 전용 이벤트.
      //
      // ★ preventDefault()를 부르는 이유가 핵심이다.
      //   기본 동작은 "브라우저가 dialog를 그냥 닫아 버리는 것"이다.
      //   그러면 DOM은 닫혔는데 React의 isOpen은 여전히 true로 남아
      //   둘의 상태가 어긋난다. 다음에 열려고 해도 "이미 열림"으로 알고 안 열린다.
      //   그래서 기본 동작을 막고, 반드시 React 상태를 통해 닫히게 만든다.
      //   "화면의 진실은 항상 React 상태에 있다"는 원칙을 지키는 것이다.
      onCancel={(cancelEvent) => {
        cancelEvent.preventDefault();
        onRequestClose();
      }}
      onClick={handleBackdropClick}
    >
      {/* 안쪽을 <section>으로 한 겹 더 감싼 이유:
          위 handleBackdropClick이 "dialog 자신이 클릭됐을 때만" 닫도록 되어 있는데,
          내용물이 dialog의 직계 자식이면 클릭 판정이 애매해질 수 있다.
          내용 전체를 다른 태그로 감싸면 안쪽 클릭의 target은 항상 그 안쪽 요소가 된다. */}
      <section className="modal-dialog-panel">
        <header className="modal-dialog-header">
          <div>
            {/* 위 aria-labelledby가 가리키는 바로 그 요소다. id가 짝을 이룬다. */}
            <h2 id={titleElementId}>{title}</h2>
            {description ? <p id={descriptionElementId}>{description}</p> : null}
          </div>
          <button
            type="button"
            className="modal-close-button"
            onClick={onRequestClose}
            // "닫기"라고만 하면 모달이 여러 개일 때 뭘 닫는지 모른다.
            // 제목을 넣어 "상품 수정 닫기"처럼 구체적으로 만든다.
            aria-label={`${title} 닫기`}
          >
            ×
          </button>
        </header>

        {/* ★ children이 그려지는 자리.
            이 컴포넌트는 안에 무엇이 들어올지 전혀 모르고 알 필요도 없다.
            폼이든 표든 이미지든 부모가 넣어 주는 대로 그린다.
            덕분에 하나의 모달 컴포넌트를 앱 전체에서 재사용할 수 있다.
            이 패턴을 "합성(composition)"이라고 부르며, React 설계의 핵심 사고방식이다. */}
        <div className="modal-dialog-content">{children}</div>

        {/* footer를 안 넘기면 아래 영역 자체를 안 그린다.
            빈 <footer>가 남아 있으면 CSS 여백 때문에 어색한 공백이 생긴다. */}
        {footer ? <footer className="modal-dialog-footer">{footer}</footer> : null}
      </section>

      {resizable ? (
        <button
          type="button"
          className="modal-resize-handle"
          aria-label={`${title} 모달 크기 조절`}
          title="드래그 또는 방향키로 크기 조절 · 더블클릭으로 초기화"
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={finishPointerResize}
          onPointerCancel={finishPointerResize}
          onKeyDown={handleResizeKeyDown}
          onDoubleClick={resetModalSize}
        >
          <span aria-hidden="true">◢</span>
        </button>
      ) : null}
    </dialog>
  );
};
