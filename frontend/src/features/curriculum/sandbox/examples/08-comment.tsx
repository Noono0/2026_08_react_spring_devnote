/**
 * 8단계 연습 — 댓글·대댓글: 부모·자식 관계, 재귀 없이 두 단계 그리기, 삭제 자리 유지
 *
 * 해 볼 것
 *  1. 대댓글 접기·펼치기 버튼을 추가해 보세요.
 *  2. 좋아요 버튼과 숫자를 추가해 보세요.
 */
import { useState } from "react";

interface Comment { id: number; parentId: number | null; content: string; deleted: boolean; }

export default function App() {
  const [comments, setComments] = useState<Comment[]>([
    { id: 1, parentId: null, content: "부모 댓글입니다.", deleted: false },
    { id: 2, parentId: 1, content: "1번 댓글의 대댓글입니다.", deleted: false },
  ]);
  const [newContent, setNewContent] = useState("");
  const [replyTargetId, setReplyTargetId] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState("");

  const roots = comments.filter((comment) => comment.parentId === null);
  const childrenOf = (parentId: number) => comments.filter((comment) => comment.parentId === parentId);

  const addComment = (parentId: number | null, content: string) => {
    if (!content.trim()) return;
    setComments((previous) => [...previous, { id: Date.now(), parentId, content: content.trim(), deleted: false }]);
  };

  // 자식이 있는 부모는 지우지 않고 "삭제된 댓글"로 자리만 남긴다. 대댓글의 맥락이 사라지지 않게.
  const deleteComment = (id: number) => {
    const hasChildren = comments.some((comment) => comment.parentId === id && !comment.deleted);
    setComments((previous) => hasChildren
      ? previous.map((comment) => (comment.id === id ? { ...comment, deleted: true } : comment))
      : previous.filter((comment) => comment.id !== id));
  };

  const renderComment = (comment: Comment, isReply: boolean) => (
    <div key={comment.id} className="card" style={{ marginLeft: isReply ? 24 : 0 }}>
      <p style={{ color: comment.deleted ? "#8a94a6" : undefined }}>{comment.deleted ? "삭제된 댓글입니다." : comment.content}</p>
      {!comment.deleted ? (
        <div className="row">
          {!isReply ? <button className="secondary" onClick={() => setReplyTargetId(comment.id)}>답글</button> : null}
          <button className="danger" onClick={() => deleteComment(comment.id)}>삭제</button>
        </div>
      ) : null}
      {replyTargetId === comment.id ? (
        <div className="row">
          <input value={replyContent} onChange={(event) => setReplyContent(event.target.value)} placeholder="답글 입력" />
          <button onClick={() => { addComment(comment.id, replyContent); setReplyContent(""); setReplyTargetId(null); }}>등록</button>
        </div>
      ) : null}
      {!isReply ? childrenOf(comment.id).map((child) => renderComment(child, true)) : null}
    </div>
  );

  return (
    <main>
      <h1>댓글·대댓글</h1>
      <div className="row">
        <input value={newContent} onChange={(event) => setNewContent(event.target.value)} placeholder="댓글을 입력하세요" />
        <button onClick={() => { addComment(null, newContent); setNewContent(""); }}>등록</button>
      </div>
      {roots.map((comment) => renderComment(comment, false))}
    </main>
  );
}
