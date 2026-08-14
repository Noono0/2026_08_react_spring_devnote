import { useMemo, useState, type ReactNode } from "react";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { ModalDialog } from "@/shared/ui/ModalDialog";

interface CategoryItem {
  categoryId: number;
  parentCategoryId: number | null;
  categoryName: string;
  sortOrder: number;
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

  const addCategory = (): void => {
    if (!newCategoryName.trim()) {
      applicationNotification.warning("카테고리 이름을 입력해 주세요.");
      return;
    }
    const siblingCount = categoryItems.filter((categoryItem) => categoryItem.parentCategoryId === newParentCategoryId).length;
    setCategoryItems((previousCategoryItems) => [...previousCategoryItems, { categoryId: Date.now(), parentCategoryId: newParentCategoryId, categoryName: newCategoryName.trim(), sortOrder: siblingCount + 1, isExpanded: true }]);
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

  const deleteCategory = (): void => {
    if (!deleteTargetCategory) return;
    const hasChildren = categoryItems.some((categoryItem) => categoryItem.parentCategoryId === deleteTargetCategory.categoryId);
    if (hasChildren) {
      applicationNotification.error("하위 카테고리가 있어 삭제할 수 없습니다.", "먼저 하위 항목을 이동하거나 삭제해 주세요.");
      setDeleteTargetCategory(null);
      return;
    }
    setCategoryItems((previousCategoryItems) => previousCategoryItems.filter((categoryItem) => categoryItem.categoryId !== deleteTargetCategory.categoryId));
    setDeleteTargetCategory(null);
    applicationNotification.success("카테고리를 삭제했습니다.");
  };

  const moveCategory = (categoryItem: CategoryItem, direction: -1 | 1): void => {
    const siblings = categoryItems.filter((candidateCategory) => candidateCategory.parentCategoryId === categoryItem.parentCategoryId).sort((firstCategory, secondCategory) => firstCategory.sortOrder - secondCategory.sortOrder);
    const currentIndex = siblings.findIndex((siblingCategory) => siblingCategory.categoryId === categoryItem.categoryId);
    const targetCategory = siblings[currentIndex + direction];
    if (!targetCategory) return;
    setCategoryItems((previousCategoryItems) => previousCategoryItems.map((previousCategoryItem) => {
      if (previousCategoryItem.categoryId === categoryItem.categoryId) return { ...previousCategoryItem, sortOrder: targetCategory.sortOrder };
      if (previousCategoryItem.categoryId === targetCategory.categoryId) return { ...previousCategoryItem, sortOrder: categoryItem.sortOrder };
      return previousCategoryItem;
    }));
  };

  const renderCategoryNode = (categoryItem: CategoryItem, depth: number): ReactNode => {
    const childCategoryItems = categoryItems.filter((childCategoryItem) => childCategoryItem.parentCategoryId === categoryItem.categoryId).sort((firstCategory, secondCategory) => firstCategory.sortOrder - secondCategory.sortOrder);
    return (
      <div key={categoryItem.categoryId} className="category-tree-node">
        <div className="category-tree-row" style={{ paddingLeft: `${depth * 26 + 12}px` }}>
          <button type="button" className="tree-toggle-button" onClick={() => setCategoryItems((previousCategoryItems) => previousCategoryItems.map((previousCategoryItem) => previousCategoryItem.categoryId === categoryItem.categoryId ? { ...previousCategoryItem, isExpanded: !previousCategoryItem.isExpanded } : previousCategoryItem))} aria-label={categoryItem.isExpanded ? "하위 카테고리 접기" : "하위 카테고리 펼치기"}>{childCategoryItems.length > 0 ? (categoryItem.isExpanded ? "−" : "+") : "·"}</button>
          {editingCategoryId === categoryItem.categoryId ? <div className="tree-inline-edit"><input autoFocus value={editingCategoryName} onChange={(event) => setEditingCategoryName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveCategoryName(); }} /><button type="button" onClick={saveCategoryName}>저장</button><button type="button" className="ghost-button" onClick={() => setEditingCategoryId(null)}>취소</button></div> : <><strong>{categoryItem.categoryName}</strong><small>depth {depth} · 순서 {categoryItem.sortOrder}</small><div className="category-row-actions"><button type="button" className="ghost-button" onClick={() => moveCategory(categoryItem, -1)}>↑</button><button type="button" className="ghost-button" onClick={() => moveCategory(categoryItem, 1)}>↓</button><button type="button" className="secondary-button" onClick={() => openAddModal(categoryItem.categoryId)}>하위 추가</button><button type="button" className="secondary-button" onClick={() => { setEditingCategoryId(categoryItem.categoryId); setEditingCategoryName(categoryItem.categoryName); }}>이름 수정</button><button type="button" className="danger-button" onClick={() => setDeleteTargetCategory(categoryItem)}>삭제</button></div></>}
        </div>
        {categoryItem.isExpanded ? childCategoryItems.map((childCategoryItem) => renderCategoryNode(childCategoryItem, depth + 1)) : null}
      </div>
    );
  };

  return (
    <section>
      <div className="page-heading-row"><div><span className="level-badge level-고급">고급 · 난이도 8.5/10</span><h1>카테고리 트리 CRUD</h1><p>parentCategoryId와 재귀 렌더링으로 메뉴·조직도·카테고리 구조를 연습합니다.</p></div><button type="button" onClick={() => openAddModal(null)}>최상위 추가</button></div>
      <article className="category-tree-panel">{rootCategoryItems.map((rootCategoryItem) => renderCategoryNode(rootCategoryItem, 0))}</article>
      <ModalDialog isOpen={isAddModalOpen} title={newParentCategoryId === null ? "최상위 카테고리 추가" : "하위 카테고리 추가"} description="부모 식별자를 저장해 계층 구조를 만듭니다." onRequestClose={() => setAddModalOpen(false)} footer={<><button type="button" className="ghost-button" onClick={() => setAddModalOpen(false)}>취소</button><button type="button" onClick={addCategory}>추가</button></>}><label>카테고리 이름<input autoFocus value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addCategory(); }} /></label></ModalDialog>
      <ConfirmDialog isOpen={deleteTargetCategory !== null} title="카테고리 삭제" description={`“${deleteTargetCategory?.categoryName ?? ""}”을 삭제할까요? 하위 항목이 있으면 삭제가 거부됩니다.`} confirmButtonLabel="삭제" onConfirm={deleteCategory} onCancel={() => setDeleteTargetCategory(null)} />
    </section>
  );
};
