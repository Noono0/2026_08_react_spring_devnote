package com.example.devnote.board.service;

import com.example.devnote.board.dao.BoardAnswerRow;
import com.example.devnote.board.dao.BoardDao;
import com.example.devnote.board.dao.BoardPostRow;
import com.example.devnote.board.dto.BoardDtos.*;
import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.document.dto.PageResponse;
import com.example.devnote.file.dao.FileResourceDao;
import com.example.devnote.file.dao.row.FileResourceRow;
import com.example.devnote.member.dao.MemberDao;
import com.example.devnote.member.dao.row.MemberRow;
import com.example.devnote.member.dto.MemberRole;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.dao.DuplicateKeyException;

import java.util.List;
import java.util.Locale;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;

/** Controller → Service → DAO → Mapper. 게시판 종류별 차이는 여기에서 검증한다. */
@Service
@RequiredArgsConstructor
public class BoardService {
    private static final Pattern EDITOR_IMAGE_URL = Pattern.compile("^/api/v1/files/([1-9][0-9]*)/content$");
    private final BoardDao boardDao;
    private final MemberDao memberDao;
    private final FileResourceDao fileResourceDao;
    private final ObjectMapper objectMapper;

    public BoardType parseType(String value) {
        try {
            return BoardType.valueOf(value.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "게시판 종류를 확인해 주세요.");
        }
    }

    public YearMonth parseMonth(String value) {
        try {
            YearMonth month = YearMonth.parse(value);
            if (month.getYear() < 1900 || month.getYear() > 2100) throw new IllegalArgumentException();
            return month;
        } catch (DateTimeParseException | IllegalArgumentException exception) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "조회할 달은 YYYY-MM 형식으로 입력해 주세요.");
        }
    }

    @Transactional(readOnly = true)
    public PageResponse<PostSummary> list(BoardType type, String keyword, int pageNumber, int pageSize) {
        if (pageNumber < 0 || pageSize < 1 || pageSize > 50 || (long) pageNumber * pageSize > Integer.MAX_VALUE) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "페이지 번호와 크기를 확인해 주세요.");
        }
        String normalizedKeyword = normalizeKeyword(keyword);
        List<PostSummary> posts = boardDao.list(type.name(), normalizedKeyword, pageSize, pageNumber * pageSize)
            .stream().map(this::toSummary).toList();
        return PageResponse.of(posts, pageNumber, pageSize, boardDao.count(type.name(), normalizedKeyword));
    }

    @Transactional(readOnly = true)
    public CalendarMonthResponse calendarMonth(BoardType type, YearMonth month, String keyword) {
        if (type != BoardType.CALENDAR) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "월별 조회는 달력 게시판에서만 사용할 수 있습니다.");
        }
        LocalDate start = month.atDay(1);
        List<BoardPostRow> rows = boardDao.calendar(start, month.plusMonths(1).atDay(1), normalizeKeyword(keyword), 501);
        return new CalendarMonthResponse(rows.stream().limit(500).map(this::toSummary).toList(), rows.size() > 500);
    }

    private String normalizeKeyword(String keyword) {
        String normalized = keyword == null ? "" : keyword.trim();
        if (normalized.length() > 100) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "검색어는 100자 이하여야 합니다.");
        }
        return normalized;
    }

    @Transactional
    public PostDetail detail(BoardType type, long postId, Long viewerId) {
        BoardPostRow post = requirePost(type, postId);
        boardDao.incrementViews(postId);
        post.setViewCount(post.getViewCount() + 1);
        return toDetail(post, viewerId);
    }

    @Transactional
    public PostDetail create(BoardType type, PostRequest request, long memberId) {
        MemberRow member = requireMember(memberId);
        validatePost(type, request, member, null);
        BoardPostRow post = new BoardPostRow();
        post.setBoardType(type.name());
        post.setAuthorId(memberId);
        fillPost(post, request, type);
        boardDao.insert(post);
        if (type == BoardType.CALENDAR) boardDao.upsertCalendarDate(post.getPostId(), request.eventDate());
        activateImage(request.imageFileId(), memberId);
        activateEmbeddedImages(request.contentJson(), memberId);
        return toDetail(requirePost(type, post.getPostId()), memberId);
    }

    @Transactional
    public PostDetail update(BoardType type, long postId, PostRequest request, long memberId) {
        BoardPostRow post = requirePost(type, postId);
        MemberRow member = requireMember(memberId);
        requireEdit(post, member);
        if (request.versionNumber() == null || request.versionNumber() < 1) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "게시글 버전이 필요합니다.");
        }
        if (!request.versionNumber().equals(post.getVersionNumber())) {
            throw new BusinessException(ErrorCode.BOARD_VERSION_CONFLICT);
        }
        validatePost(type, request, member, post);
        fillPost(post, request, type);
        if (boardDao.update(post) == 0) throw new BusinessException(ErrorCode.BOARD_VERSION_CONFLICT);
        if (type == BoardType.CALENDAR) boardDao.upsertCalendarDate(postId, request.eventDate());
        activateImage(request.imageFileId(), memberId);
        activateEmbeddedImages(request.contentJson(), memberId);
        return toDetail(requirePost(type, postId), memberId);
    }

    @Transactional
    public void delete(BoardType type, long postId, long memberId) {
        BoardPostRow post = requirePost(type, postId);
        requireEdit(post, requireMember(memberId));
        if (boardDao.delete(postId, post.getVersionNumber()) == 0) {
            throw new BusinessException(ErrorCode.BOARD_VERSION_CONFLICT);
        }
    }

    @Transactional
    public PostDetail answer(BoardType type, long postId, AnswerRequest request, long memberId) {
        requireQuestionType(type);
        BoardPostRow post = requirePost(BoardType.QNA, postId);
        requireAdministrator(requireMember(memberId));
        validateContent(request.contentJson(), request.contentHtml(), request.contentText());
        if (boardDao.findAnswer(postId) != null) throw new BusinessException(ErrorCode.BOARD_ANSWER_EXISTS);
        BoardAnswerRow answer = new BoardAnswerRow();
        answer.setPostId(postId);
        answer.setAuthorId(memberId);
        answer.setContentJson(writeJson(request.contentJson()));
        answer.setContentHtml(request.contentHtml());
        answer.setContentText(request.contentText());
        try {
            boardDao.insertAnswer(answer);
        } catch (DuplicateKeyException exception) {
            throw new BusinessException(ErrorCode.BOARD_ANSWER_EXISTS);
        }
        activateEmbeddedImages(request.contentJson(), memberId);
        boardDao.setAnswered(postId, true);
        return toDetail(requirePost(BoardType.QNA, postId), memberId);
    }

    @Transactional
    public void deleteAnswer(BoardType type, long postId, long memberId) {
        requireQuestionType(type);
        requirePost(BoardType.QNA, postId);
        requireAdministrator(requireMember(memberId));
        if (boardDao.deleteAnswer(postId) == 0) throw new BusinessException(ErrorCode.BOARD_POST_NOT_FOUND, "삭제할 답변이 없습니다.");
        boardDao.setAnswered(postId, false);
    }

    private void requireQuestionType(BoardType type) {
        if (type != BoardType.QNA) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "답변은 Q&A 게시판에서만 사용할 수 있습니다.");
        }
    }

    private BoardPostRow requirePost(BoardType type, long postId) {
        BoardPostRow post = boardDao.find(postId);
        if (post == null || !type.name().equals(post.getBoardType())) throw new BusinessException(ErrorCode.BOARD_POST_NOT_FOUND);
        return post;
    }

    private MemberRow requireMember(long memberId) {
        MemberRow member = memberDao.selectMemberById(memberId);
        if (member == null || !"Y".equals(member.getUseYn()) || !"ACTIVE".equals(member.getAccountStatus())) {
            throw new BusinessException(ErrorCode.AUTHENTICATION_REQUIRED);
        }
        return member;
    }

    private boolean administrator(MemberRow member) {
        return member != null && MemberRole.valueOf(member.getMemberRole()).isAdministrator();
    }

    private void requireAdministrator(MemberRow member) {
        if (!administrator(member)) throw new BusinessException(ErrorCode.ACCESS_DENIED);
    }

    private void requireEdit(BoardPostRow post, MemberRow member) {
        if (BoardType.NOTICE.name().equals(post.getBoardType())) requireAdministrator(member);
        else if (!member.getMemberId().equals(post.getAuthorId()) && !administrator(member)) {
            throw new BusinessException(ErrorCode.ACCESS_DENIED);
        }
    }

    private void validatePost(BoardType type, PostRequest request, MemberRow member, BoardPostRow existing) {
        validateContent(request.contentJson(), request.contentHtml(), request.contentText());
        if (type == BoardType.NOTICE) requireAdministrator(member);
        else if (request.pinned()) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "상단 고정은 공지 게시판에서만 사용할 수 있습니다.");
        }
        if (type == BoardType.GALLERY && request.imageFileId() == null) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "갤러리에는 대표 이미지가 필요합니다.");
        }
        if (type == BoardType.CALENDAR) {
            LocalDate date = request.eventDate();
            if (date == null || date.getYear() < 1900 || date.getYear() > 2100) {
                throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "달력 글의 날짜를 선택해 주세요.");
            }
        } else if (request.eventDate() != null) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "날짜는 달력 게시판에서만 사용할 수 있습니다.");
        }
        Long fileId = request.imageFileId();
        if (fileId != null && (existing == null || !fileId.equals(existing.getImageFileId()))) {
            FileResourceRow file = fileResourceDao.selectFileById(fileId);
            if (file == null || "DELETED".equals(file.getFileStatus())) throw new BusinessException(ErrorCode.FILE_NOT_FOUND);
            if (!member.getMemberId().equals(file.getUploaderId())) throw new BusinessException(ErrorCode.FILE_ACCESS_FORBIDDEN);
            if (file.getMimeType() == null || !file.getMimeType().startsWith("image/")) throw new BusinessException(ErrorCode.FILE_NOT_IMAGE);
        }
    }

    private void validateContent(JsonNode json, String html, String text) {
        if (json == null || !json.isObject() || !"doc".equals(json.path("type").asText())
            || html == null || html.isBlank() || text == null || text.isBlank()) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "에디터 본문을 입력해 주세요.");
        }
    }

    private void fillPost(BoardPostRow post, PostRequest request, BoardType type) {
        post.setTitle(request.title().trim());
        post.setContentJson(writeJson(request.contentJson()));
        post.setContentHtml(request.contentHtml());
        post.setContentText(request.contentText());
        post.setImageFileId(request.imageFileId());
        post.setPinned(type == BoardType.NOTICE && request.pinned());
    }

    private void activateImage(Long fileId, long memberId) {
        if (fileId == null) return;
        FileResourceRow file = fileResourceDao.selectFileById(fileId);
        if (file != null && "TEMP".equals(file.getFileStatus()) && fileResourceDao.updateFileStatus(fileId, memberId, "ACTIVE") == 0) {
            throw new BusinessException(ErrorCode.FILE_NOT_FOUND);
        }
    }

    /** 에디터에 붙인 이미지도 TEMP 정리 작업에서 지워지지 않도록 현재 회원의 파일만 활성화한다. */
    private void activateEmbeddedImages(JsonNode content, long memberId) {
        Set<Long> imageIds = new HashSet<>();
        collectEmbeddedImageIds(content, imageIds);
        for (Long imageId : imageIds) {
            FileResourceRow file = fileResourceDao.selectFileById(imageId);
            if (file == null || "DELETED".equals(file.getFileStatus())) throw new BusinessException(ErrorCode.FILE_NOT_FOUND);
            if (!Long.valueOf(memberId).equals(file.getUploaderId())) throw new BusinessException(ErrorCode.FILE_ACCESS_FORBIDDEN);
            if (file.getMimeType() == null || !file.getMimeType().startsWith("image/")) throw new BusinessException(ErrorCode.FILE_NOT_IMAGE);
            activateImage(imageId, memberId);
        }
    }

    private void collectEmbeddedImageIds(JsonNode node, Set<Long> imageIds) {
        if (node == null) return;
        if ("image".equals(node.path("type").asText())) {
            Matcher matcher = EDITOR_IMAGE_URL.matcher(node.path("attrs").path("src").asText());
            if (matcher.matches()) {
                try { imageIds.add(Long.parseLong(matcher.group(1))); }
                catch (NumberFormatException exception) { throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "이미지 주소를 확인해 주세요."); }
            }
        }
        if (node.isContainerNode()) node.elements().forEachRemaining(child -> collectEmbeddedImageIds(child, imageIds));
    }

    private String writeJson(JsonNode json) {
        try { return objectMapper.writeValueAsString(json); }
        catch (JsonProcessingException exception) { throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "에디터 본문 형식이 올바르지 않습니다."); }
    }

    private JsonNode readJson(String json) {
        try { return objectMapper.readTree(json); }
        catch (JsonProcessingException exception) { throw new IllegalStateException("저장된 게시글 JSON을 읽을 수 없습니다.", exception); }
    }

    private PostSummary toSummary(BoardPostRow post) {
        String text = post.getContentText();
        return new PostSummary(post.getPostId(), BoardType.valueOf(post.getBoardType()), post.getTitle(), post.getAuthorName(),
            text.length() > 140 ? text.substring(0, 140) : text, post.getPinned(), post.getAnswered(),
            post.getImageFileId(), post.getViewCount(), post.getCreatedAt(), post.getEventDate());
    }

    private PostDetail toDetail(BoardPostRow post, Long viewerId) {
        MemberRow viewer = viewerId == null ? null : memberDao.selectMemberById(viewerId);
        boolean admin = administrator(viewer);
        boolean canEdit = viewer != null && (admin || (viewerId.equals(post.getAuthorId()) && !BoardType.NOTICE.name().equals(post.getBoardType())));
        BoardAnswerRow answer = boardDao.findAnswer(post.getPostId());
        AnswerResponse answerResponse = answer == null ? null : new AnswerResponse(answer.getAnswerId(), readJson(answer.getContentJson()),
            answer.getContentHtml(), answer.getAuthorName(), answer.getCreatedAt());
        return new PostDetail(post.getPostId(), BoardType.valueOf(post.getBoardType()), post.getTitle(), readJson(post.getContentJson()),
            post.getContentHtml(), post.getContentText(), post.getAuthorName(), post.getPinned(), post.getAnswered(),
            post.getImageFileId(), post.getViewCount(), post.getVersionNumber(), canEdit, canEdit,
            admin && BoardType.QNA.name().equals(post.getBoardType()) && answer == null,
            post.getCreatedAt(), post.getUpdatedAt(), post.getEventDate(), answerResponse);
    }
}
