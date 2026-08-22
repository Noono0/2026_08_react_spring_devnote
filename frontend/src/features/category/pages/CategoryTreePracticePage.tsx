/**
 * ============================================================================
 * CategoryTreePracticePage.tsx — 【고급】 무한 깊이 트리 CRUD
 * ============================================================================
 *
 * 댓글 페이지(2단계 고정)의 확장판이다. 여기서는 깊이 제한이 없다.
 * 메뉴 관리, 조직도, 파일 탐색기, 카테고리 관리가 전부 이 구조다.
 *
 * [댓글 페이지와 무엇이 다른가]
 *   1. 깊이 무제한 — depth를 재귀로 넘겨 가며 들여쓰기를 계산한다
 *   2. 접기/펼치기 — 각 노드가 isExpanded 상태를 스스로 가진다
 *   3. 순서 바꾸기 — sortOrder 값을 서로 맞바꿔 위아래로 옮긴다
 *   4. 삭제 제한 — 하위 항목이 있으면 아예 삭제를 거부한다
 *
 * ★ 삭제 정책이 댓글과 다른 점을 비교해 보자.
 *     댓글: 자식이 있으면 → "삭제된 댓글입니다"로 자리만 남긴다
 *     카테고리: 자식이 있으면 → 삭제 자체를 거부한다
 *   왜 다를까? 댓글은 대화 흐름을 보존하는 게 중요하고,
 *   카테고리는 "빈 껍데기 분류"가 남아 있으면 오히려 방해되기 때문이다.
 *   정답이 하나가 아니라, 그 데이터의 성격에 맞게 정하는 것이다.
 */

import { useMemo, useState, type ReactNode } from "react";
import { LearningGuideTitle } from "@/features/learning/components/LearningGuideTitle";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { ModalDialog } from "@/shared/ui/ModalDialog";

interface CategoryItem {
  categoryId: number;
  // 댓글의 parentCommentId와 똑같은 역할. 이 한 칸이 트리를 만든다.
  parentCategoryId: number | null;
  categoryName: string;

  // 같은 부모를 가진 형제들 사이의 순서.
  // 이 값이 있어야 위/아래 버튼으로 순서를 바꿀 수 있다.
  sortOrder: number;

  // 하위 항목을 펼쳐 놨는지.
  //
  // ★ 이런 "화면 표시용 값"을 데이터에 같이 넣어도 되나?
  //   실무에서는 보통 분리한다. (서버에서 온 데이터 + 별도의 펼침 State)
  //   서버가 준 데이터에 화면 상태를 섞으면 저장할 때 같이 딸려 가기 때문이다.
  //   여기서는 학습용이라 한 곳에 담아 단순하게 만들었다.
  //   ApplicationSidebar.tsx에서는 Set으로 분리해서 관리했으니 비교해 보자.
  isExpanded: boolean;
}

const initialCategoryItems: CategoryItem[] = [
  { categoryId: 1, parentCategoryId: null, categoryName: "프론트엔드", sortOrder: 1, isExpanded: true },
  { categoryId: 2, parentCategoryId: 1, categoryName: "React", sortOrder: 1, isExpanded: true },
  { categoryId: 3, parentCategoryId: 1, categoryName: "TypeScript", sortOrder: 2, isExpanded: true },
  { categoryId: 4, parentCategoryId: null, categoryName: "백엔드", sortOrder: 2, isExpanded: true },
  { categoryId: 5, parentCategoryId: 4, categoryName: "Spring Boot", sortOrder: 1, isExpanded: true },
  { categoryId: 6, parentCategoryId: 4, categoryName: "MyBatis", sortOrder: 2, isExpanded: true },
];

export const CategoryTreePracticePage = () => {
  const [categoryItems, setCategoryItems] = useState<CategoryItem[]>(initialCategoryItems);
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [newParentCategoryId, setNewParentCategoryId] = useState<number | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [deleteTargetCategory, setDeleteTargetCategory] = useState<CategoryItem | null>(null);

  const rootCategoryItems = useMemo(() => categoryItems.filter((categoryItem) => categoryItem.parentCategoryId === null).sort((firstCategory, secondCategory) => firstCategory.sortOrder - secondCategory.sortOrder), [categoryItems]);

  const openAddModal = (parentCategoryId: number | null): void => {
    setNewParentCategoryId(parentCategoryId);
    setNewCategoryName("");
    setAddModalOpen(true);
  };

  /** 【Create】 카테고리를 추가한다. */
  const addCategory = (): void => {
    if (!newCategoryName.trim()) {
      applicationNotification.warning("카테고리 이름을 입력해 주세요.");
      return;
    }

    // 같은 부모 밑에 이미 몇 개가 있는지 센다.
    // 그 다음 번호(+1)를 새 항목의 순서로 준다 → 항상 맨 끝에 추가된다.
    const siblingCount = categoryItems.filter((categoryItem) => categoryItem.parentCategoryId === newParentCategoryId).length;

    setCategoryItems((previousCategoryItems) => [...previousCategoryItems, { categoryId: Date.now(), parentCategoryId: newParentCategoryId, categoryName: newCategoryName.trim(), sortOrder: siblingCount + 1, isExpanded: true }]);

    // ★ 부모가 접혀 있으면 강제로 펼친다. 세심한 배려다.
    //   하위 항목을 추가했는데 부모가 접혀 있으면 방금 만든 게 안 보인다.
    //   사용자는 "추가가 안 됐나?" 하고 같은 걸 여러 번 만들게 된다.
    //
    // ★ setCategoryItems를 연달아 두 번 부르는데 괜찮을까?
    //   괜찮다. React는 이 둘을 한 번에 묶어 처리하고(batching),
    //   두 번째 호출은 첫 번째 결과가 반영된 최신 배열을 받는다.
    //   함수형 업데이트((prev) => ...)를 썼기 때문에 가능한 일이다.
    if (newParentCategoryId !== null) setCategoryItems((previousCategoryItems) => previousCategoryItems.map((categoryItem) => categoryItem.categoryId === newParentCategoryId ? { ...categoryItem, isExpanded: true } : categoryItem));
    setAddModalOpen(false);
    applicationNotification.success("카테고리를 추가했습니다.");
  };

  const saveCategoryName = (): void => {
    if (editingCategoryId === null || !editingCategoryName.trim()) return;
    setCategoryItems((previousCategoryItems) => previousCategoryItems.map((categoryItem) => categoryItem.categoryId === editingCategoryId ? { ...categoryItem, categoryName: editingCategoryName.trim() } : categoryItem));
    setEditingCategoryId(null);
    applicationNotification.success("카테고리 이름을 수정했습니다.");
  };

  /**
   * 【Delete】 카테고리를 삭제한다. 단, 하위 항목이 있으면 거부한다.
   *
   * ★ 이런 정책을 데이터베이스 용어로 RESTRICT라고 부른다.
   *   외래 키 제약에서 흔히 보는 세 가지 선택지가 있다:
   *     RESTRICT  : 자식이 있으면 부모 삭제를 막는다 (여기서 쓴 방식, 가장 안전)
   *     CASCADE   : 부모를 지우면 자식도 전부 같이 지운다 (편하지만 위험)
   *     SET NULL  : 자식의 부모 연결만 끊는다 (자식이 최상위로 올라온다)
   *
   *   카테고리에 CASCADE를 쓰면 "프론트엔드"를 지웠을 때
   *   그 아래 React, TypeScript가 전부 소리 없이 사라진다.
   *   되돌릴 수도 없다. 그래서 막는 쪽을 택했다.
   */
  const deleteCategory = (): void => {
    if (!deleteTargetCategory) return;

    const hasChildren = categoryItems.some((categoryItem) => categoryItem.parentCategoryId === deleteTargetCategory.categoryId);
    if (hasChildren) {
      // ★ 오류 알림에 "그럼 어떻게 해야 하는지"까지 적어 준다.
      //   "삭제할 수 없습니다"로 끝나면 사용자는 막막해진다.
      //   좋은 오류 메시지는 다음 행동을 알려 준다.
      applicationNotification.error("하위 카테고리가 있어 삭제할 수 없습니다.", "먼저 하위 항목을 이동하거나 삭제해 주세요.");
      setDeleteTargetCategory(null);
      return;
    }
    setCategoryItems((previousCategoryItems) => previousCategoryItems.filter((categoryItem) => categoryItem.categoryId !== deleteTargetCategory.categoryId));
    setDeleteTargetCategory(null);
    applicationNotification.success("카테고리를 삭제했습니다.");
  };

  /**
   * ★★ 형제끼리 순서를 맞바꾼다. (위 ↑ / 아래 ↓ 버튼)
   *
   * [아이디어]
   *   배열에서 항목의 위치를 옮기는 게 아니라, sortOrder 값 두 개를 서로 교환한다.
   *   화면은 항상 sortOrder로 정렬해 그리므로, 값만 바꿔도 순서가 바뀐 것처럼 보인다.
   *   배열 순서를 직접 조작하는 것보다 훨씬 간단하고 안전하다.
   *
   * `direction: -1 | 1` 도 눈여겨보자.
   *   -1 = 위로, 1 = 아래로. 함수 하나로 양방향을 처리한다.
   *   number로 두면 3 같은 엉뚱한 값이 들어올 수 있는데,
   *   유니온 타입으로 못 박으면 그런 실수를 컴파일 단계에서 막는다.
   */
  const moveCategory = (categoryItem: CategoryItem, direction: -1 | 1): void => {
    // 1) 나와 같은 부모를 둔 형제들을 순서대로 모은다.
    //    ★ 전체 목록이 아니라 "형제"만 봐야 한다.
    //      다른 부모 밑에 있는 항목과 순서를 바꾸면 트리 구조가 망가진다.
    const siblings = categoryItems.filter((candidateCategory) => candidateCategory.parentCategoryId === categoryItem.parentCategoryId).sort((firstCategory, secondCategory) => firstCategory.sortOrder - secondCategory.sortOrder);

    // 2) 형제들 사이에서 내가 몇 번째인지 찾는다.
    //    findIndex는 조건에 맞는 첫 번째의 위치를 돌려준다. (없으면 -1)
    const currentIndex = siblings.findIndex((siblingCategory) => siblingCategory.categoryId === categoryItem.categoryId);

    // 3) 자리를 바꿀 상대를 찾는다. 위로면 앞의 것, 아래로면 뒤의 것.
    const targetCategory = siblings[currentIndex + direction];

    // ★ 이 한 줄이 경계 처리를 전부 해결한다.
    //   맨 위에서 ↑를 누르면 인덱스가 -1이 되고,
    //   맨 아래에서 ↓를 누르면 배열 길이를 넘어간다.
    //   두 경우 모두 JavaScript가 undefined를 돌려주므로 여기서 그냥 나간다.
    //   "if (index > 0 && index < length - 1)" 같은 복잡한 조건이 필요 없다.
    if (!targetCategory) return;

    // 4) 두 항목의 sortOrder를 서로 맞바꾼다.
    //    map 안에서 if 두 개로 각각을 처리하고, 나머지는 그대로 통과시킨다.
    setCategoryItems((previousCategoryItems) => previousCategoryItems.map((previousCategoryItem) => {
      if (previousCategoryItem.categoryId === categoryItem.categoryId) return { ...previousCategoryItem, sortOrder: targetCategory.sortOrder };
      if (previousCategoryItem.categoryId === targetCategory.categoryId) return { ...previousCategoryItem, sortOrder: categoryItem.sortOrder };
      return previousCategoryItem;
    }));
  };

  /**
   * ★★ 재귀 렌더링 — 노드 하나와 그 아래 모든 자손을 그린다.
   *
   * 댓글 페이지의 renderComment와 같은 구조지만, 여기서는 `depth`(깊이)를 넘긴다.
   *   최상위에서 0으로 시작 → 자식을 부를 때 depth + 1
   * 이 숫자로 들여쓰기 폭을 계산하기 때문에 깊이가 몇이든 자동으로 처리된다.
   */
  const renderCategoryNode = (categoryItem: CategoryItem, depth: number): ReactNode => {
    // 내 자식들을 순서대로 찾는다. (필터 + 정렬)
    const childCategoryItems = categoryItems.filter((childCategoryItem) => childCategoryItem.parentCategoryId === categoryItem.categoryId).sort((firstCategory, secondCategory) => firstCategory.sortOrder - secondCategory.sortOrder);
    return (
      <div key={categoryItem.categoryId} className="category-tree-node">
        {/* ★ 깊이에 비례해 왼쪽 여백을 준다. 이게 트리처럼 보이게 하는 핵심이다.
              depth 0 → 12px,  depth 1 → 38px,  depth 2 → 64px ...

            style={{ ... }} 는 JSX의 인라인 스타일 문법이다.
            중괄호가 두 겹인 이유: 바깥은 "JS 표현식 시작", 안쪽은 "객체"다.
            속성 이름은 CSS의 padding-left가 아니라 카멜케이스 paddingLeft를 쓴다.

            ★ 왜 CSS 클래스로 안 하고 인라인 스타일을 썼나?
              깊이가 몇 단계일지 모르는데 클래스를 미리 다 만들 수 없다.
              이렇게 값이 계산되는 경우가 인라인 스타일이 적합한 대표적인 상황이다. */}
        <div className="category-tree-row" style={{ paddingLeft: `${depth * 26 + 12}px` }}>
          {/* 접기/펼치기 토글 버튼.
              기호가 세 가지로 갈린다:
                자식 있고 펼침 → "−"
                자식 있고 접힘 → "+"
                자식 없음     → "·"  (누를 게 없다는 표시)
              삼항 연산자를 겹쳐 쓴 형태다. */}
          <button type="button" className="tree-toggle-button" onClick={() => setCategoryItems((previousCategoryItems) => previousCategoryItems.map((previousCategoryItem) => previousCategoryItem.categoryId === categoryItem.categoryId ? { ...previousCategoryItem, isExpanded: !previousCategoryItem.isExpanded } : previousCategoryItem))} aria-label={categoryItem.isExpanded ? "하위 카테고리 접기" : "하위 카테고리 펼치기"}>{childCategoryItems.length > 0 ? (categoryItem.isExpanded ? "−" : "+") : "·"}</button>
          {editingCategoryId === categoryItem.categoryId ? <div className="tree-inline-edit"><input autoFocus value={editingCategoryName} onChange={(event) => setEditingCategoryName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveCategoryName(); }} /><button type="button" onClick={saveCategoryName}>저장</button><button type="button" className="ghost-button" onClick={() => setEditingCategoryId(null)}>취소</button></div> : <><strong>{categoryItem.categoryName}</strong><small>depth {depth} · 순서 {categoryItem.sortOrder}</small><div className="category-row-actions"><button type="button" className="ghost-button" onClick={() => moveCategory(categoryItem, -1)}>↑</button><button type="button" className="ghost-button" onClick={() => moveCategory(categoryItem, 1)}>↓</button><button type="button" className="secondary-button" onClick={() => openAddModal(categoryItem.categoryId)}>하위 추가</button><button type="button" className="secondary-button" onClick={() => { setEditingCategoryId(categoryItem.categoryId); setEditingCategoryName(categoryItem.categoryName); }}>이름 수정</button><button type="button" className="danger-button" onClick={() => setDeleteTargetCategory(categoryItem)}>삭제</button></div></>}
        </div>
        {/* ★★ 재귀 호출 지점. depth + 1을 넘겨 한 단계 더 들여쓴다.
              접혀 있으면(isExpanded가 false) 아예 안 그리므로 재귀가 멈춘다.
              자식이 없어도 map이 빈 배열을 돌아 아무것도 안 그린다.
              두 가지 종료 조건이 자연스럽게 갖춰져 있다. */}
        {categoryItem.isExpanded ? childCategoryItems.map((childCategoryItem) => renderCategoryNode(childCategoryItem, depth + 1)) : null}
      </div>
    );
  };

  return (
    <section>
      <div className="page-heading-row"><div><span className="level-badge level-고급">고급 · 난이도 8.5/10</span><LearningGuideTitle guideId="category">카테고리 트리 CRUD</LearningGuideTitle><p>parentCategoryId와 재귀 렌더링으로 메뉴·조직도·카테고리 구조를 연습합니다.</p></div><button type="button" onClick={() => openAddModal(null)}>최상위 추가</button></div>
      {/* 최상위 노드만 그린다. depth는 0에서 시작.
          그 아래 모든 자손은 재귀가 알아서 처리한다. */}
      <article className="category-tree-panel">{rootCategoryItems.map((rootCategoryItem) => renderCategoryNode(rootCategoryItem, 0))}</article>
      <ModalDialog isOpen={isAddModalOpen} title={newParentCategoryId === null ? "최상위 카테고리 추가" : "하위 카테고리 추가"} description="부모 식별자를 저장해 계층 구조를 만듭니다." onRequestClose={() => setAddModalOpen(false)} footer={<><button type="button" className="ghost-button" onClick={() => setAddModalOpen(false)}>취소</button><button type="button" onClick={addCategory}>추가</button></>}><label>카테고리 이름<input autoFocus value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addCategory(); }} /></label></ModalDialog>
      <ConfirmDialog isOpen={deleteTargetCategory !== null} title="카테고리 삭제" description={`“${deleteTargetCategory?.categoryName ?? ""}”을 삭제할까요? 하위 항목이 있으면 삭제가 거부됩니다.`} confirmButtonLabel="삭제" onConfirm={deleteCategory} onCancel={() => setDeleteTargetCategory(null)} />
    </section>
  );
};
