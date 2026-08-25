/**
 * ============================================================================
 * CommentPracticePage.tsx — 【중급】 댓글·대댓글 (계층 구조 다루기)
 * ============================================================================
 *
 * [핵심 개념 1: 계층 구조를 "평평한 배열"로 표현하기]
 *   댓글은 부모-자식 관계가 있는 트리 구조다. 저장 방법은 두 가지가 있다.
 *
 *   (A) 중첩 구조 — 자식을 객체 안에 넣기
 *       { id: 1, replies: [{ id: 2, replies: [...] }] }
 *       → 화면 그리기는 편하지만 수정/삭제가 지옥이다.
 *         3단계 아래 댓글 하나를 고치려면 겹겹이 파고들며 복사해야 한다.
 *
 *   (B) 평평한 배열 + 부모 id — 이 프로젝트가 쓰는 방식
 *       [{ id: 1, parentId: null }, { id: 2, parentId: 1 }]
 *       → 수정/삭제가 map/filter 한 줄로 끝난다.
 *         화면에 그릴 때만 부모-자식을 찾아 연결하면 된다.
 *
 *   ★ (B)가 실무의 표준이다. 데이터베이스 테이블도 정확히 이 모양으로 만든다.
 *
 * [핵심 개념 2: 재귀 렌더링]
 *   댓글 안에 대댓글, 그 안에 또 대댓글… 깊이가 정해져 있지 않다.
 *   그래서 "자기 자신을 다시 부르는" 함수로 그린다. (아래 renderComment)
 *
 * [핵심 개념 3: 삭제해도 자리를 남기는 이유]
 *   대댓글이 달린 부모 댓글을 진짜로 지우면 자식 댓글들이 고아가 된다.
 *   그래서 "삭제된 댓글입니다"라는 껍데기만 남긴다.
 *   실제 커뮤니티 사이트들이 다 이렇게 한다. (soft delete)
 */

import { useMemo, useState, type ReactNode } from "react";
import { LearningGuideTitle } from "@/features/curriculum/components/LearningGuideTitle";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

interface CommentItem {
  commentId: number;

  // ★ 이 한 칸이 트리 구조 전체를 만든다.
  //   null이면 최상위 댓글, 숫자면 그 번호 댓글의 대댓글이다.
  //   `| null`을 명시했으므로 "값이 없을 수 있다"는 걸 TypeScript가 알고
  //   쓰기 전에 확인하라고 강제해 준다.
  parentCommentId: number | null;

  authorName: string;
  content: string;
  likeCount: number;

  // 진짜 삭제가 아니라 "삭제 표시"만 한 상태인지.
  // 이런 방식을 soft delete(논리 삭제)라고 부른다.
  isDeleted: boolean;

  createdAt: string;
}

const initialCommentItems: CommentItem[] = [
  { commentId: 1, parentCommentId: null, authorName: "김리액트", content: "부모 댓글과 자식 댓글 구조를 확인해 보세요.", likeCount: 2, isDeleted: false, createdAt: "2026-08-06 20:10" },
  { commentId: 2, parentCommentId: 1, authorName: "박스프링", content: "이 댓글은 1번 댓글의 대댓글입니다.", likeCount: 1, isDeleted: false, createdAt: "2026-08-06 20:14" },
  { commentId: 3, parentCommentId: null, authorName: "최도커", content: "삭제된 부모 댓글의 자식은 어떻게 보여야 할까요?", likeCount: 0, isDeleted: false, createdAt: "2026-08-06 20:20" },
];

export const CommentPracticePage = () => {
  const [commentItems, setCommentItems] = useState<CommentItem[]>(initialCommentItems);
  const [newCommentContent, setNewCommentContent] = useState("");
  const [replyTargetCommentId, setReplyTargetCommentId] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [deleteTargetComment, setDeleteTargetComment] = useState<CommentItem | null>(null);

  // 최상위 댓글(부모가 없는 것)만 골라낸다.
  //
  // ★ 왜 최상위만 따로 뽑나?
  //   전체 목록을 그대로 .map()으로 그리면 대댓글이 최상위처럼 한 번,
  //   부모 밑에서 또 한 번, 총 두 번 나타난다.
  //   "최상위만 그리고, 자식은 부모가 알아서 그리게 한다"가 맞다.
  const rootCommentItems = useMemo(() => commentItems.filter((commentItem) => commentItem.parentCommentId === null), [commentItems]);

  const createComment = (): void => {
    if (!newCommentContent.trim()) {
      applicationNotification.warning("댓글 내용을 입력해 주세요.");
      return;
    }
    setCommentItems((previousCommentItems) => [...previousCommentItems, { commentId: Date.now(), parentCommentId: null, authorName: "학습자", content: newCommentContent.trim(), likeCount: 0, isDeleted: false, createdAt: new Date().toLocaleString("ko-KR") }]);
    setNewCommentContent("");
    applicationNotification.success("댓글을 등록했습니다.");
  };

  /**
   * 【Create】 대댓글 등록.
   *
   * 최상위 댓글 등록과 딱 한 가지만 다르다.
   *   최상위: parentCommentId: null
   *   대댓글: parentCommentId: 부모의 id
   * 이 값 하나가 계층 관계를 만든다.
   */
  const createReply = (): void => {
    if (replyTargetCommentId === null || !replyContent.trim()) {
      applicationNotification.warning("대댓글 내용을 입력해 주세요.");
      return;
    }
    setCommentItems((previousCommentItems) => [...previousCommentItems, { commentId: Date.now(), parentCommentId: replyTargetCommentId, authorName: "학습자", content: replyContent.trim(), likeCount: 0, isDeleted: false, createdAt: new Date().toLocaleString("ko-KR") }]);
    setReplyTargetCommentId(null);
    setReplyContent("");
    applicationNotification.success("대댓글을 등록했습니다.");
  };

  const saveUpdate = (): void => {
    if (editingCommentId === null || !editingContent.trim()) return;
    setCommentItems((previousCommentItems) => previousCommentItems.map((commentItem) => commentItem.commentId === editingCommentId ? { ...commentItem, content: editingContent.trim() } : commentItem));
    setEditingCommentId(null);
    setEditingContent("");
    applicationNotification.success("댓글을 수정했습니다.");
  };

  /**
   * ★★ 【Delete】 이 페이지에서 가장 중요한 함수.
   *
   * 자식 댓글이 있느냐에 따라 삭제 방식이 완전히 달라진다.
   *
   *   자식이 있으면 → soft delete: 내용만 "삭제된 댓글입니다"로 바꾸고 자리는 남긴다
   *   자식이 없으면 → hard delete: 배열에서 진짜로 없앤다
   *
   * ★ 자식이 있는데 진짜 지우면 무슨 일이 벌어지나?
   *   자식 댓글의 parentCommentId가 이제 없는 번호를 가리키게 된다.
   *   최상위도 아니고(parentId가 null이 아니니까) 부모도 없어서
   *   화면 어디에도 안 나타나는 유령 댓글이 된다.
   *   데이터베이스에서는 이런 걸 "고아 레코드(orphan record)"라고 부른다.
   */
  const deleteComment = (): void => {
    if (!deleteTargetComment) return;

    // some(): 조건에 맞는 게 "하나라도 있으면" true.
    // filter().length > 0 보다 낫다. 하나를 찾는 순간 멈추기 때문이다.
    //
    // `&& !commentItem.isDeleted` 조건이 붙은 이유:
    //   이미 삭제 표시된 자식은 살아 있는 자식으로 안 친다.
    //   모든 자식이 삭제된 상태라면 부모도 완전히 지워도 된다.
    const hasChildComment = commentItems.some((commentItem) => commentItem.parentCommentId === deleteTargetComment.commentId && !commentItem.isDeleted);

    setCommentItems((previousCommentItems) => hasChildComment
      // [자식 있음] map으로 내용만 바꾼다. 배열에서 빠지지 않는다.
      ? previousCommentItems.map((commentItem) => commentItem.commentId === deleteTargetComment.commentId ? { ...commentItem, content: "삭제된 댓글입니다.", isDeleted: true } : commentItem)
      // [자식 없음] filter로 진짜 제거한다.
      : previousCommentItems.filter((commentItem) => commentItem.commentId !== deleteTargetComment.commentId));

    // ★ 알림 문구도 상황에 따라 다르게 한다.
    //   자식이 있어서 자리가 남았는데 "삭제했습니다"라고만 하면
    //   사용자는 "왜 아직 보이지? 안 지워졌나?" 하고 혼란스러워한다.
    //   왜 그렇게 됐는지 설명해 주는 것이 좋은 알림이다.
    applicationNotification.success(hasChildComment ? "대댓글이 있어 삭제 자리를 유지했습니다." : "댓글을 삭제했습니다.");
    setDeleteTargetComment(null);
  };

  /**
   * ★★ 재귀 렌더링 — 댓글 하나(와 그 아래 모든 대댓글)를 그린다.
   *
   * [재귀가 뭔가요?]
   *   함수가 자기 자신을 다시 부르는 것이다.
   *   이 함수의 맨 아래에서 renderComment를 또 부르는 걸 볼 수 있다.
   *
   *   왜 필요한가?
   *     댓글 깊이가 몇 단계일지 미리 알 수 없다.
   *     2단계면 for문 두 개, 3단계면 세 개… 이런 식으로는 만들 수 없다.
   *     재귀는 "자식이 있으면 같은 방식으로 또 그려라"라고 한 번만 적으면
   *     깊이가 몇이든 알아서 처리된다.
   *
   * [재귀의 필수 조건 — 멈추는 지점이 있어야 한다]
   *   여기서는 "자식이 없으면 더 이상 안 부른다"가 멈추는 지점이다.
   *   (childCommentItems.length > 0 확인)
   *   이게 없으면 무한 반복으로 브라우저가 멈춘다.
   *
   * `isReply = false`는 기본값이다.
   *   최상위에서 부를 때는 안 넘겨도 되고(false),
   *   자기 자신을 부를 때는 true를 넘겨 "이건 대댓글"이라고 표시한다.
   */
  const renderComment = (commentItem: CommentItem, isReply = false): ReactNode => {
    // 전체 목록에서 "내가 부모인" 댓글들을 찾는다.
    // 평평한 배열을 트리처럼 보이게 만드는 연결 고리가 바로 이 한 줄이다.
    const childCommentItems = commentItems.filter((childCommentItem) => childCommentItem.parentCommentId === commentItem.commentId);
    return (
      <article className={`comment-card${isReply ? " comment-reply-card" : ""}`} key={commentItem.commentId}>
        {/* 삭제된 댓글은 작성자 이름도 감춘다.
            내용을 지웠는데 이름이 남아 있으면 개인정보가 노출된 것이나 마찬가지다. */}
        <div className="comment-heading"><div><strong>{commentItem.isDeleted ? "알 수 없음" : commentItem.authorName}</strong><small>{commentItem.createdAt}</small></div><span>좋아요 {commentItem.likeCount}</span></div>
        {editingCommentId === commentItem.commentId ? (
          <div className="inline-edit-area"><textarea value={editingContent} onChange={(event) => setEditingContent(event.target.value)} rows={3} /><div className="button-row"><button type="button" onClick={saveUpdate}>수정 저장</button><button type="button" className="ghost-button" onClick={() => setEditingCommentId(null)}>취소</button></div></div>
        ) : <p className={commentItem.isDeleted ? "deleted-comment-text" : ""}>{commentItem.content}</p>}
        {/* ★ 삭제된 댓글에는 버튼을 아예 안 보여준다.
              "삭제된 댓글입니다"에 좋아요를 누르거나 수정할 수 있으면 이상하다.
              할 수 없는 동작은 버튼을 비활성화하는 것보다 아예 없애는 게 깔끔하다.

            ★ 답글 버튼은 최상위 댓글에만 보인다 (`!isReply` 조건).
              깊이를 2단계로 제한한 것이다. 무한히 들어가면
              화면이 오른쪽으로 계속 밀려서 모바일에서 읽을 수 없게 된다.
              실제 커뮤니티들도 보통 2~3단계로 제한한다. */}
        {!commentItem.isDeleted ? <div className="button-row compact-button-row"><button type="button" className="ghost-button" onClick={() => setCommentItems((previousCommentItems) => previousCommentItems.map((previousCommentItem) => previousCommentItem.commentId === commentItem.commentId ? { ...previousCommentItem, likeCount: previousCommentItem.likeCount + 1 } : previousCommentItem))}>좋아요</button>{!isReply ? <button type="button" className="secondary-button" onClick={() => { setReplyTargetCommentId(commentItem.commentId); setReplyContent(""); }}>답글</button> : null}<button type="button" className="secondary-button" onClick={() => { setEditingCommentId(commentItem.commentId); setEditingContent(commentItem.content); }}>수정</button><button type="button" className="danger-button" onClick={() => setDeleteTargetComment(commentItem)}>삭제</button></div> : null}
        {replyTargetCommentId === commentItem.commentId ? <div className="reply-form"><textarea value={replyContent} onChange={(event) => setReplyContent(event.target.value)} rows={3} placeholder="대댓글 내용" /><div className="button-row"><button type="button" onClick={createReply}>대댓글 등록</button><button type="button" className="ghost-button" onClick={() => setReplyTargetCommentId(null)}>취소</button></div></div> : null}
        {/* ★★ 여기가 재귀가 일어나는 지점이다.
              자식 댓글마다 renderComment를 "다시" 부른다.
              두 번째 인자로 true를 넘겨 "이건 대댓글"이라고 알려 주면
              들여쓰기 CSS가 적용되고 답글 버튼이 사라진다.

              자식이 없으면 아무것도 안 그리므로 재귀가 멈춘다.
              이것이 무한 반복을 막는 "종료 조건"이다. */}
        {childCommentItems.length > 0 ? <div className="comment-reply-list">{childCommentItems.map((childCommentItem) => renderComment(childCommentItem, true))}</div> : null}
      </article>
    );
  };

  return (
    <section>
      <div className="page-heading-row"><div><span className="level-badge level-중급">중급 · 난이도 6.5/10</span><LearningGuideTitle guideId="comment">댓글·대댓글 계층형 CRUD</LearningGuideTitle><p>parentCommentId로 부모와 자식을 연결하고 삭제된 부모의 위치를 유지합니다.</p></div></div>
      <article className="practice-card comment-create-card"><label>새 댓글<textarea value={newCommentContent} onChange={(event) => setNewCommentContent(event.target.value)} rows={4} placeholder="댓글을 입력하세요." /></label><button type="button" onClick={createComment}>댓글 등록</button></article>
      {/* 최상위 댓글만 map으로 돌린다.
          대댓글은 각 부모가 재귀로 알아서 그리므로 여기서 신경 쓸 필요가 없다.
          두 번째 인자를 안 넘겼으므로 isReply는 기본값 false가 된다. */}
      <div className="comment-list">{rootCommentItems.map((commentItem) => renderComment(commentItem))}</div>
      <ConfirmDialog isOpen={deleteTargetComment !== null} title="댓글 삭제" description="대댓글이 있는 부모 댓글은 ‘삭제된 댓글입니다’ 자리로 남습니다." confirmButtonLabel="삭제" onConfirm={deleteComment} onCancel={() => setDeleteTargetComment(null)} />
    </section>
  );
};
