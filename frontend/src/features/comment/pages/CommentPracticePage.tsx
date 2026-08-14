import { useMemo, useState, type ReactNode } from "react";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

interface CommentItem {
  commentId: number;
  parentCommentId: number | null;
  authorName: string;
  content: string;
  likeCount: number;
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

  const deleteComment = (): void => {
    if (!deleteTargetComment) return;
    const hasChildComment = commentItems.some((commentItem) => commentItem.parentCommentId === deleteTargetComment.commentId && !commentItem.isDeleted);
    setCommentItems((previousCommentItems) => hasChildComment
      ? previousCommentItems.map((commentItem) => commentItem.commentId === deleteTargetComment.commentId ? { ...commentItem, content: "삭제된 댓글입니다.", isDeleted: true } : commentItem)
      : previousCommentItems.filter((commentItem) => commentItem.commentId !== deleteTargetComment.commentId));
    applicationNotification.success(hasChildComment ? "대댓글이 있어 삭제 자리를 유지했습니다." : "댓글을 삭제했습니다.");
    setDeleteTargetComment(null);
  };

  const renderComment = (commentItem: CommentItem, isReply = false): ReactNode => {
    const childCommentItems = commentItems.filter((childCommentItem) => childCommentItem.parentCommentId === commentItem.commentId);
    return (
      <article className={`comment-card${isReply ? " comment-reply-card" : ""}`} key={commentItem.commentId}>
        <div className="comment-heading"><div><strong>{commentItem.isDeleted ? "알 수 없음" : commentItem.authorName}</strong><small>{commentItem.createdAt}</small></div><span>좋아요 {commentItem.likeCount}</span></div>
        {editingCommentId === commentItem.commentId ? (
          <div className="inline-edit-area"><textarea value={editingContent} onChange={(event) => setEditingContent(event.target.value)} rows={3} /><div className="button-row"><button type="button" onClick={saveUpdate}>수정 저장</button><button type="button" className="ghost-button" onClick={() => setEditingCommentId(null)}>취소</button></div></div>
        ) : <p className={commentItem.isDeleted ? "deleted-comment-text" : ""}>{commentItem.content}</p>}
        {!commentItem.isDeleted ? <div className="button-row compact-button-row"><button type="button" className="ghost-button" onClick={() => setCommentItems((previousCommentItems) => previousCommentItems.map((previousCommentItem) => previousCommentItem.commentId === commentItem.commentId ? { ...previousCommentItem, likeCount: previousCommentItem.likeCount + 1 } : previousCommentItem))}>좋아요</button>{!isReply ? <button type="button" className="secondary-button" onClick={() => { setReplyTargetCommentId(commentItem.commentId); setReplyContent(""); }}>답글</button> : null}<button type="button" className="secondary-button" onClick={() => { setEditingCommentId(commentItem.commentId); setEditingContent(commentItem.content); }}>수정</button><button type="button" className="danger-button" onClick={() => setDeleteTargetComment(commentItem)}>삭제</button></div> : null}
        {replyTargetCommentId === commentItem.commentId ? <div className="reply-form"><textarea value={replyContent} onChange={(event) => setReplyContent(event.target.value)} rows={3} placeholder="대댓글 내용" /><div className="button-row"><button type="button" onClick={createReply}>대댓글 등록</button><button type="button" className="ghost-button" onClick={() => setReplyTargetCommentId(null)}>취소</button></div></div> : null}
        {childCommentItems.length > 0 ? <div className="comment-reply-list">{childCommentItems.map((childCommentItem) => renderComment(childCommentItem, true))}</div> : null}
      </article>
    );
  };

  return (
    <section>
      <div className="page-heading-row"><div><span className="level-badge level-중급">중급 · 난이도 6.5/10</span><h1>댓글·대댓글 계층형 CRUD</h1><p>parentCommentId로 부모와 자식을 연결하고 삭제된 부모의 위치를 유지합니다.</p></div></div>
      <article className="practice-card comment-create-card"><label>새 댓글<textarea value={newCommentContent} onChange={(event) => setNewCommentContent(event.target.value)} rows={4} placeholder="댓글을 입력하세요." /></label><button type="button" onClick={createComment}>댓글 등록</button></article>
      <div className="comment-list">{rootCommentItems.map((commentItem) => renderComment(commentItem))}</div>
      <ConfirmDialog isOpen={deleteTargetComment !== null} title="댓글 삭제" description="대댓글이 있는 부모 댓글은 ‘삭제된 댓글입니다’ 자리로 남습니다." confirmButtonLabel="삭제" onConfirm={deleteComment} onCancel={() => setDeleteTargetComment(null)} />
    </section>
  );
};
