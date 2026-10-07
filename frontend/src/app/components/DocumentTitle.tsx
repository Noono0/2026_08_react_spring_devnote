import { useLocation } from "react-router-dom";
import { createDocumentTitle } from "@/app/navigation/pageTitle";

/**
 * 화면에는 아무것도 그리지 않고 <head>의 <title>만 바꾼다. 제목 규칙은 pageTitle.ts에 있다.
 *
 * [React 19의 <title>]
 *   React 19부터는 컴포넌트 안에서 <title>을 그리면 React가 알아서 <head>로 옮겨 준다.
 *   예전처럼 useEffect에서 document.title을 직접 바꿀 필요가 없다.
 */
export const DocumentTitle = () => {
  const location = useLocation();
  return <title>{createDocumentTitle(location.pathname)}</title>;
};
