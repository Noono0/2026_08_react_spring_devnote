/**
 * ============================================================================
 * ConfirmDialog.tsx — "정말 삭제할까요?" 같은 확인 창
 * ============================================================================
 *
 * [이 파일의 핵심 — 컴포넌트 위에 컴포넌트 쌓기]
 *   이 컴포넌트는 ModalDialog를 처음부터 다시 만들지 않는다.
 *   ModalDialog를 가져다 쓰면서 "확인/취소 버튼"만 미리 채워 넣었다.
 *
 *   ModalDialog  = 아무 내용이나 담을 수 있는 범용 모달 (재료)
 *   ConfirmDialog = 그중 "확인용"으로 미리 세팅한 특화 모달 (완제품)
 *
 *   덕분에 삭제 확인이 필요한 화면마다 버튼 두 개를 매번 만들 필요가 없고,
 *   모든 확인 창의 생김새와 동작이 저절로 통일된다.
 *
 * [처리 중 상태(isConfirming)를 다루는 법도 눈여겨보자]
 *   서버에 삭제 요청을 보낸 뒤 응답을 기다리는 몇 초 동안
 *   사용자가 확인 버튼을 여러 번 누르면 삭제 요청이 여러 번 나간다.
 *   그걸 막는 처리가 아래에 들어 있다. 실무에서 아주 중요한 부분이다.
 */

import { ModalDialog } from "./ModalDialog";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;   // ModalDialog와 달리 필수다. 확인 창은 설명이 없으면 곤란하다.

  // 버튼 문구를 바꿀 수 있게 열어 뒀다.
  // "확인" 대신 "삭제하기", "복구하기"처럼 구체적으로 쓰면 사용자가 덜 헷갈린다.
  confirmButtonLabel?: string;
  cancelButtonLabel?: string;

  // 지금 서버 요청을 처리하는 중인지.
  // true면 버튼이 잠기고 문구가 "처리 중..."으로 바뀐다.
  isConfirming?: boolean;

  onConfirm: () => void;  // 확인을 눌렀을 때
  onCancel: () => void;   // 취소하거나 닫으려 할 때
}

/**
 * 삭제·복구처럼 사용자의 확인이 필요한 작업에 사용하는 공통 확인 모달입니다.
 */
export const ConfirmDialog = ({
  isOpen,
  title,
  description,
  confirmButtonLabel = "확인",
  cancelButtonLabel = "취소",
  isConfirming = false,
  onConfirm,
  onCancel,
// 함수 본문에 중괄호 `{}`가 없고 바로 `(` 로 시작한다.
// "이 JSX를 그대로 return 한다"는 뜻이다. State도 훅도 없는 단순한 컴포넌트라 가능하다.
}: ConfirmDialogProps) => (
  <ModalDialog
    isOpen={isOpen}
    title={title}
    description={description}

    // ModalDialog가 "닫고 싶어요"라고 하면 취소로 처리한다.
    // ESC를 누르거나 × 버튼을 누르는 것 = 취소하는 것, 이라는 자연스러운 해석이다.
    onRequestClose={onCancel}

    // ★ 처리 중일 때는 배경을 클릭해도 안 닫히게 만든다.
    //   삭제 요청을 보내는 중에 실수로 배경을 눌러 창이 사라지면
    //   사용자는 삭제가 됐는지 취소됐는지 알 수 없게 된다.
    //   `!isConfirming` → 처리 중이면 false가 되어 배경 클릭이 막힌다.
    closeOnBackdropClick={!isConfirming}

    // ★ JSX를 props로 넘기는 모습. 이게 위에서 말한 "슬롯" 패턴이다.
    //   값이 여러 줄이므로 소괄호로 감쌌다.
    footer={(
      // Fragment로 버튼 두 개를 묶는다. 감싸는 div를 만들지 않아
      // ModalDialog의 <footer> 안에서 CSS 정렬이 그대로 먹는다.
      <>
        <button type="button" className="ghost-button" onClick={onCancel} disabled={isConfirming}>
          {cancelButtonLabel}
        </button>
        {/* ★ disabled={isConfirming} 이 한 줄이 중복 요청을 막는다.
            처리 중에는 버튼이 회색으로 잠겨서 두 번 클릭할 수 없다.
            이런 걸 빼먹으면 "삭제를 두 번 눌렀더니 에러가 나요" 같은 버그가 생긴다.

            문구도 "확인"에서 "처리 중..."으로 바뀐다.
            버튼이 잠긴 이유를 사용자에게 알려 주는 것이다.
            잠기기만 하고 아무 설명이 없으면 "고장 났나?" 하고 오해한다. */}
        <button type="button" className="danger-button" onClick={onConfirm} disabled={isConfirming}>
          {isConfirming ? "처리 중..." : confirmButtonLabel}
        </button>
      </>
    )}
  >
    {/* 여기 있는 내용이 ModalDialog의 children으로 들어간다.
        (태그 사이에 넣은 것이 children이 된다는 규칙을 떠올려 보자) */}
    <div className="confirm-dialog-message">
      {/* aria-hidden="true": 화면 낭독기가 "느낌표"를 읽지 않게 한다.
          이 기호는 시각적 강조일 뿐 정보가 아니며, 진짜 내용은 옆의 문장에 있다. */}
      <span className="confirm-dialog-symbol" aria-hidden="true">!</span>
      <p>이 작업은 목록 상태에 바로 반영됩니다.</p>
    </div>
  </ModalDialog>
);
