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
import java.time.LocalDate;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.YearMonth;
import java.util.Collections;

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

    @Test void calendarRejectsReversedAndOutOfBoundsPeriods() {
        when(memberDao.selectMemberById(1L)).thenReturn(member(1L, "USER"));
        LocalDate start = LocalDate.of(2026, 11, 12);
        for (PostRequest input : new PostRequest[] {
            calendarRequest(start, start.minusDays(1)),
            calendarRequest(LocalDate.of(1899, 12, 31), start),
            calendarRequest(start, LocalDate.of(2101, 1, 1)),
            calendarRequest(null, start)
        }) {
            assertError(ErrorCode.COMMON_INVALID_REQUEST, () -> service.create(BoardType.CALENDAR, input, 1L));
        }
        verify(boardDao, never()).insert(any());
    }

    @Test void otherBoardsRejectEitherPeriodField() {
        when(memberDao.selectMemberById(1L)).thenReturn(member(1L, "USER"));
        LocalDate date = LocalDate.of(2026, 11, 12);
        assertError(ErrorCode.COMMON_INVALID_REQUEST,
            () -> service.create(BoardType.GENERAL, calendarRequest(date, null), 1L));
        assertError(ErrorCode.COMMON_INVALID_REQUEST,
            () -> service.create(BoardType.GENERAL, calendarRequest(null, date), 1L));
        verify(boardDao, never()).insert(any());
    }

    @Test void invalidPeriodCannotOverwriteAnExistingCalendarPost() {
        when(memberDao.selectMemberById(1L)).thenReturn(member(1L, "USER"));
        when(boardDao.find(8L)).thenReturn(post(8L, 1L, "CALENDAR", 1L));
        PostRequest input = new PostRequest("일정", json.createObjectNode().put("type", "doc"), "<p>본문</p>", "본문",
            null, false, 1L, LocalDate.of(2026, 11, 12), LocalDate.of(2026, 11, 11), null);
        assertError(ErrorCode.COMMON_INVALID_REQUEST, () -> service.update(BoardType.CALENDAR, 8L, input, 1L));
        verify(boardDao, never()).update(any());
        verify(boardDao, never()).upsertCalendarDate(anyLong(), any(), any());
    }

    @Test void calendarCapsUniquePostsAndReportsTruncation() {
        LocalDate start = LocalDate.of(2026, 11, 1);
        LocalDate end = LocalDate.of(2026, 12, 1);
        when(boardDao.calendar(start, end, "행사", 501))
            .thenReturn(Collections.nCopies(501, post(8L, 1L, "CALENDAR", 1L)));
        CalendarMonthResponse result = service.calendarMonth(BoardType.CALENDAR, YearMonth.of(2026, 11), " 행사 ");
        assertThat(result.content()).hasSize(500);
        assertThat(result.truncated()).isTrue();
        verify(boardDao).calendar(start, end, "행사", 501);
    }

    private PostRequest calendarRequest(LocalDate start, LocalDate end) {
        return new PostRequest("일정", json.createObjectNode().put("type", "doc"), "<p>본문</p>", "본문", null, false, null, start, end, null);
    }

    @Test void communityFiltersAreRestrictedToThreeCategories() {
        service.listCommunity("", "검색", 0, 12);
        verify(boardDao).list("COMMUNITY", "검색", 12, 0);
        service.listCommunity("qna", "", 1, 12);
        verify(boardDao).list("QNA", "", 12, 12);
        assertError(ErrorCode.COMMON_INVALID_REQUEST, () -> service.listCommunity("CALENDAR", "", 0, 12));
    }

    @Test void popupManagementRequiresAnActiveAdministrator() {
        assertError(ErrorCode.AUTHENTICATION_REQUIRED, () -> service.list(BoardType.POPUP, "", 0, 12));
        assertError(ErrorCode.AUTHENTICATION_REQUIRED, () -> service.detail(BoardType.POPUP, 8L, null));
        when(memberDao.selectMemberById(1L)).thenReturn(member(1L, "USER"));
        assertError(ErrorCode.ACCESS_DENIED, () -> service.list(BoardType.POPUP, "", 0, 12, 1L));
        assertError(ErrorCode.ACCESS_DENIED, () -> service.detail(BoardType.POPUP, 8L, 1L));
        assertError(ErrorCode.ACCESS_DENIED, () -> service.create(BoardType.POPUP, request(null), 1L));
        verify(boardDao, never()).find(anyLong());
    }

    @Test void popupRejectsExternalAndAmbiguousMenuUrls() {
        when(memberDao.selectMemberById(3L)).thenReturn(member(3L, "ADMIN"));
        LocalDate date = LocalDate.of(2026, 11, 13);
        for (String path : new String[] { "https://example.com/react", "//example.com", "/react?x=1", "/react#x", "/react/../admin", "/react/%2e%2e", "/react\\admin", "" }) {
            PostRequest input = new PostRequest("팝업", json.createObjectNode().put("type", "doc"), "<p>안내</p>", "안내",
                null, false, null, date, date, new PopupSettings(path, false, true));
            assertError(ErrorCode.COMMON_INVALID_REQUEST, () -> service.create(BoardType.POPUP, input, 3L));
        }
        verify(boardDao, never()).insert(any());
    }

    @Test void popupScheduleUsesKoreanDateEvenWhenUtcIsThePreviousDay() {
        service = new BoardService(boardDao, memberDao, fileResourceDao, json,
            Clock.fixed(Instant.parse("2026-11-12T15:00:00Z"), ZoneOffset.UTC));
        service.activePopups(BoardType.POPUP, "/react/");
        verify(boardDao).activePopups("/react", LocalDate.of(2026, 11, 13));
        assertError(ErrorCode.COMMON_INVALID_REQUEST, () -> service.activePopups(BoardType.GENERAL, "/react"));
    }

    @Test void popupConfigurationIsRequiredAndCannotBeUsedOnGeneralPosts() {
        when(memberDao.selectMemberById(3L)).thenReturn(member(3L, "ADMIN"));
        LocalDate date = LocalDate.of(2026, 11, 13);
        assertError(ErrorCode.COMMON_INVALID_REQUEST, () -> service.create(BoardType.POPUP, calendarRequest(date, date), 3L));
        PostRequest generalWithPopup = new PostRequest("제목", json.createObjectNode().put("type", "doc"), "<p>본문</p>", "본문",
            null, false, null, null, null, new PopupSettings("/react", false, true));
        assertError(ErrorCode.COMMON_INVALID_REQUEST, () -> service.create(BoardType.GENERAL, generalWithPopup, 3L));
        when(boardDao.find(8L)).thenReturn(post(8L, 1L, "POPUP", 1L));
        when(memberDao.selectMemberById(1L)).thenReturn(member(1L, "USER"));
        assertError(ErrorCode.ACCESS_DENIED, () -> service.update(BoardType.POPUP, 8L, request(1L), 1L));
        assertError(ErrorCode.ACCESS_DENIED, () -> service.delete(BoardType.POPUP, 8L, 1L));
    }

    private PostRequest request(Long version) {
        return new PostRequest("제목", json.createObjectNode().put("type", "doc"), "<p>본문</p>", "본문", null, false, version, null, null, null);
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
        post.setContentText("본문");
        post.setPinned(false);
        post.setAnswered(false);
        post.setViewCount(0L);
        return post;
    }

    private void assertError(ErrorCode expected, Runnable action) {
        assertThatThrownBy(action::run).isInstanceOf(BusinessException.class)
            .extracting("errorCode").isEqualTo(expected);
    }
}
