import { useState } from "react";
import { featureHelpGuides, type FeatureHelpTopic } from "@/features/help/featureHelpGuides";
import { ModalDialog } from "@/shared/ui/ModalDialog";

/** 화면 제목 옆 ?를 눌러 그 기능의 사용 순서와 주의사항을 확인한다. */
export const FeatureHelpButton = ({ topic }: { topic: FeatureHelpTopic }) => {
  const [open, setOpen] = useState(false);
  const guide = featureHelpGuides[topic];

  return <>
    <button
      type="button"
      className="learning-guide-icon-button"
      aria-label={`${guide.title} 사용 설명 열기`}
      title={`${guide.title} 사용 설명`}
      onClick={() => setOpen(true)}
    >?</button>
    <ModalDialog
      isOpen={open}
      title={`${guide.title} 사용 설명`}
      description={guide.description}
      onRequestClose={() => setOpen(false)}
      footer={<button type="button" onClick={() => setOpen(false)}>닫기</button>}
    >
      <div className="learning-guide-section">
        {guide.sections.map((section) => <section key={section.heading}>
          <h3>{section.heading}</h3>
          <ol>{section.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        </section>)}
        {guide.caution ? <p className="notice-box"><strong>주의</strong> {guide.caution}</p> : null}
      </div>
    </ModalDialog>
  </>;
};
