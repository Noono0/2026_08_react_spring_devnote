package com.example.devnote.board.service;

import com.example.devnote.board.dao.BoardDao;
import com.example.devnote.board.dao.BoardPostRow;
import com.example.devnote.board.dto.BoardDtos.*;
import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.file.dao.FileResourceDao;
import com.example.devnote.member.dao.MemberDao;
import com.example.devnote.member.dao.row.MemberRow;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;
import java.time.YearMonth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BoardServiceTest {
    @Mock BoardDao boardDao;
    @Mock MemberDao memberDao;
    @Mock FileResourceDao fileResourceDao;
    BoardService service;
    final ObjectMapper json = new ObjectMapper();

    @BeforeEach void setUp() { service = new BoardService(boardDao, memberDao, fileResourceDao, json); }

    @Test void noticeRequiresAdministrator() {
        when(memberDao.selectMemberById(1L)).thenReturn(member(1L, "USER"));
        assertError(ErrorCode.ACCESS_DENIED, () -> service.create(BoardType.NOTICE, request(null), 1L));
        verify(boardDao, never()).insert(any());
    }

    @Test void galleryRequiresImage() {
        when(memberDao.selectMemberById(1L)).thenReturn(member(1L, "USER"));
        assertError(ErrorCode.COMMON_INVALID_REQUEST, () -> service.create(BoardType.GALLERY, request(null), 1L));
        verify(boardDao, never()).insert(any());
    }

    @Test void ownerCannotOverwriteNewerVersion() {
        when(boardDao.find(8L)).thenReturn(post(8L, 1L, "GENERAL", 3L));
        when(memberDao.selectMemberById(1L)).thenReturn(member(1L, "USER"));
        assertError(ErrorCode.BOARD_VERSION_CONFLICT,
            () -> service.update(BoardType.GENERAL, 8L, request(2L), 1L));
        verify(boardDao, never()).update(any());
    }

    @Test void anotherAuthorCannotEditOrDelete() {
        when(boardDao.find(8L)).thenReturn(post(8L, 2L, "GENERAL", 1L));
        when(memberDao.selectMemberById(1L)).thenReturn(member(1L, "USER"));
        assertError(ErrorCode.ACCESS_DENIED, () -> service.update(BoardType.GENERAL, 8L, request(1L), 1L));
        assertError(ErrorCode.ACCESS_DENIED, () -> service.delete(BoardType.GENERAL, 8L, 1L));
        verify(boardDao, never()).delete(anyLong(), anyLong());
    }

    @Test void onlyAdministratorCanAnswerQuestion() {
        when(boardDao.find(8L)).thenReturn(post(8L, 1L, "QNA", 1L));
        when(memberDao.selectMemberById(1L)).thenReturn(member(1L, "USER"));
        AnswerRequest answer = new AnswerRequest(json.createObjectNode().put("type", "doc"), "<p>답변</p>", "답변");
        assertError(ErrorCode.ACCESS_DENIED, () -> service.answer(BoardType.QNA, 8L, answer, 1L));
        verify(boardDao, never()).insertAnswer(any());
    }

    @Test void concurrentAnswerGetsConflictInsteadOfServerError() {
        when(boardDao.find(8L)).thenReturn(post(8L, 1L, "QNA", 1L));
        when(memberDao.selectMemberById(3L)).thenReturn(member(3L, "ADMIN"));
        doThrow(new DuplicateKeyException("duplicate answer")).when(boardDao).insertAnswer(any());
        AnswerRequest answer = new AnswerRequest(json.createObjectNode().put("type", "doc"), "<p>답변</p>", "답변");
        assertError(ErrorCode.BOARD_ANSWER_EXISTS, () -> service.answer(BoardType.QNA, 8L, answer, 3L));
    }

    @Test void listUsesTypeAndBoundedPagination() {
        when(boardDao.count("GENERAL", "검색")).thenReturn(0L);
        assertThat(service.list(BoardType.GENERAL, " 검색 ", 0, 12).content()).isEmpty();
        verify(boardDao).list("GENERAL", "검색", 12, 0);
        assertError(ErrorCode.COMMON_INVALID_REQUEST, () -> service.list(BoardType.GENERAL, "", 0, 51));
    }

    @Test void calendarRequiresDateAndValidMonth() {
        when(memberDao.selectMemberById(1L)).thenReturn(member(1L, "USER"));
        assertError(ErrorCode.COMMON_INVALID_REQUEST, () -> service.create(BoardType.CALENDAR, request(null), 1L));
        assertError(ErrorCode.COMMON_INVALID_REQUEST, () -> service.parseMonth("2026-13"));
        assertThat(service.parseMonth("2026-11")).isEqualTo(YearMonth.of(2026, 11));
    }

    private PostRequest request(Long version) {
        return new PostRequest("제목", json.createObjectNode().put("type", "doc"), "<p>본문</p>", "본문", null, false, version, null);
    }

    private MemberRow member(long id, String role) {
        MemberRow member = new MemberRow();
        member.setMemberId(id);
        member.setMemberRole(role);
        member.setUseYn("Y");
        member.setAccountStatus("ACTIVE");
        return member;
    }

    private BoardPostRow post(long id, long authorId, String type, long version) {
        BoardPostRow post = new BoardPostRow();
        post.setPostId(id);
        post.setBoardType(type);
        post.setAuthorId(authorId);
        post.setVersionNumber(version);
        return post;
    }

    private void assertError(ErrorCode expected, Runnable action) {
        assertThatThrownBy(action::run).isInstanceOf(BusinessException.class)
            .extracting("errorCode").isEqualTo(expected);
    }
}
