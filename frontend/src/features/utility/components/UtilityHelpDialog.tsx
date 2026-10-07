import type { ReactNode } from "react";
import { ModalDialog } from "@/shared/ui/ModalDialog";

interface UtilityHelpDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
}

// 유틸리티 화면 공통 "사용법" 대화상자(공통 ModalDialog를 감싼 것).
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
    <div className="api-help-warning"><strong>데이터 보관 안내</strong><p>도구마다 처리·저장 위치가 다릅니다. 현재 도구의 설명에서 서버 전송 여부와 저장 범위를 확인하고, 비밀번호·토큰 등 민감한 값은 입력 전에 주의해 주세요.</p></div>
  </ModalDialog>
);

interface UtilityPageTitleProps {
  kicker: string;
  title: string;
  description: string;
  helpLabel?: string;
  onHelpOpen: () => void;
}

// 유틸리티 화면 공통 제목 영역: 작은 분류 글(kicker)·제목·설명과 사용법 열기 버튼.
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
