import { ModalDialog } from "./ModalDialog";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmButtonLabel?: string;
  cancelButtonLabel?: string;
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
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
}: ConfirmDialogProps) => (
  <ModalDialog
    isOpen={isOpen}
    title={title}
    description={description}
    onRequestClose={onCancel}
    closeOnBackdropClick={!isConfirming}
    footer={(
      <>
        <button type="button" className="ghost-button" onClick={onCancel} disabled={isConfirming}>
          {cancelButtonLabel}
        </button>
        <button type="button" className="danger-button" onClick={onConfirm} disabled={isConfirming}>
          {isConfirming ? "처리 중..." : confirmButtonLabel}
        </button>
      </>
    )}
  >
    <div className="confirm-dialog-message">
      <span className="confirm-dialog-symbol" aria-hidden="true">!</span>
      <p>이 작업은 목록 상태에 바로 반영됩니다.</p>
    </div>
  </ModalDialog>
);
