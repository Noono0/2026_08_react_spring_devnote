import type { ReactNode } from "react";
import { ModalDialog } from "@/shared/ui/ModalDialog";

interface UtilityHelpDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
}

export const UtilityHelpDialog = ({ isOpen, title, description, children, onClose }: UtilityHelpDialogProps) => (
  <ModalDialog
    isOpen={isOpen}
    title={`${title} 도움말`}
    description={description}
    size="large"
    resizable
    resizeStorageKey={`utility-help:${title}`}
    onRequestClose={onClose}
  >
    <div className="utility-help-content">{children}</div>
    <div className="api-help-warning"><strong>공통 개인정보 안내</strong><p>이 도구의 입력은 브라우저 안에서만 처리하며 서버·DB·URL·분석 로그에 저장하지 않습니다.</p></div>
  </ModalDialog>
);

interface UtilityPageTitleProps {
  kicker: string;
  title: string;
  description: string;
  helpLabel?: string;
  onHelpOpen: () => void;
}

export const UtilityPageTitle = ({ kicker, title, description, helpLabel = title, onHelpOpen }: UtilityPageTitleProps) => (
  <div className="page-hero utility-page-title">
    <div>
      <span className="page-kicker">{kicker}</span>
      <div className="page-title-with-guide">
        <h1>{title}</h1>
        <button type="button" className="learning-guide-icon-button" aria-label={`${helpLabel} 도움말`} onClick={onHelpOpen}>?</button>
      </div>
      <p>{description}</p>
    </div>
  </div>
);
