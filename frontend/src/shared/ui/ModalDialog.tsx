import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from "react";

interface ModalDialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onRequestClose: () => void;
  closeOnBackdropClick?: boolean;
  size?: "default" | "large";
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
  closeOnBackdropClick = true,
  size = "default",
}: ModalDialogProps) => {
  const dialogReference = useRef<HTMLDialogElement>(null);
  const titleElementId = useId();
  const descriptionElementId = useId();

  useEffect(() => {
    const dialogElement = dialogReference.current;
    if (!dialogElement) {
      return;
    }

    if (isOpen && !dialogElement.open) {
      dialogElement.showModal();
      return;
    }

    if (!isOpen && dialogElement.open) {
      dialogElement.close();
    }
  }, [isOpen]);

  const handleBackdropClick = (clickEvent: MouseEvent<HTMLDialogElement>): void => {
    if (!closeOnBackdropClick || clickEvent.target !== clickEvent.currentTarget) {
      return;
    }

    onRequestClose();
  };

  return (
    <dialog
      ref={dialogReference}
      className={`modal-dialog${size === "large" ? " modal-dialog-large" : ""}`}
      aria-labelledby={titleElementId}
      aria-describedby={description ? descriptionElementId : undefined}
      onCancel={(cancelEvent) => {
        cancelEvent.preventDefault();
        onRequestClose();
      }}
      onClick={handleBackdropClick}
    >
      <section className="modal-dialog-panel">
        <header className="modal-dialog-header">
          <div>
            <h2 id={titleElementId}>{title}</h2>
            {description ? <p id={descriptionElementId}>{description}</p> : null}
          </div>
          <button
            type="button"
            className="modal-close-button"
            onClick={onRequestClose}
            aria-label={`${title} 닫기`}
          >
            ×
          </button>
        </header>

        <div className="modal-dialog-content">{children}</div>

        {footer ? <footer className="modal-dialog-footer">{footer}</footer> : null}
      </section>
    </dialog>
  );
};
