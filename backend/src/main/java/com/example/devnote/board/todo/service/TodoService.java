package com.example.devnote.board.todo.service;

import com.example.devnote.board.todo.dao.TodoDao;
import com.example.devnote.board.todo.dao.TodoRow;
import com.example.devnote.board.todo.dao.TodoGuestRow;
import com.example.devnote.board.todo.dao.TodoReminderDao;
import com.example.devnote.board.todo.dao.TodoPushDao;
import com.example.devnote.board.todo.dto.TodoDtos.*;
import com.example.devnote.board.todo.domain.TodoOwner;
import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.document.dto.PageResponse;
import com.example.devnote.member.dao.MemberDao;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;

@Service @RequiredArgsConstructor
public class TodoService {
    private final TodoDao todoDao;
    private final MemberDao memberDao;
    private final TodoReminderDao reminders;
    private final TodoPushDao push;

    @Transactional(readOnly = true)
    public GuestMergePreview previewMerge(long memberId, TodoGuestRow guest) {
        requireActiveMember(TodoOwner.member(memberId));
        if (guest == null) return new GuestMergePreview(0, null, 0);
        return new GuestMergePreview(todoDao.count(TodoOwner.guest(guest.getGuestId()), "ALL", ""),
            "guest:" + guest.getPublicId(), todoDao.lastGuestTodoId(guest.getGuestId()));
    }

    @Transactional
    public GuestMergeResult mergeGuest(long memberId, TodoGuestRow guest, GuestMergeRequest input) {
        requireActiveMember(TodoOwner.member(memberId));
        // expectedMemberId는 대상을 고르는 값이 아니라 확인창 이후 계정 전환을 막는 비교값이다.
        if (!Long.valueOf(memberId).equals(input.expectedMemberId()) || guest == null
            || !("guest:" + guest.getPublicId()).equals(input.guestKey())) {
            throw new BusinessException(ErrorCode.TODO_MERGE_CONTEXT_CHANGED);
        }
        push.clearGuestDeliveries(guest.getGuestId(), input.throughTodoId());
        return new GuestMergeResult(todoDao.mergeGuest(guest.getGuestId(), memberId, input.throughTodoId()));
    }

    @Transactional(readOnly = true)
    public PageResponse<Todo> list(TodoOwner owner, String status, String keyword, int page, int size) {
        requireActiveMember(owner);
        Status parsed;
        try { parsed = Status.valueOf(status); }
        catch (IllegalArgumentException exception) { throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "할 일 상태는 ALL·ACTIVE·DONE 중에서 선택해 주세요."); }
        String search = keyword.trim();
        if (search.length() > 100 || page < 0 || size < 1 || size > 50 || (long) page * size > Integer.MAX_VALUE) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "검색어와 페이지 범위를 확인해 주세요.");
        }
        return PageResponse.of(todoDao.list(owner, parsed.name(), search, size, page * size).stream().map(this::response).toList(),
            page, size, todoDao.count(owner, parsed.name(), search));
    }

    @Transactional(readOnly = true)
    public Todo detail(TodoOwner owner, long todoId) {
        requireActiveMember(owner);
        return response(requireOwned(todoId, owner));
    }

    @Transactional
    public Todo create(TodoOwner owner, TodoRequest input) {
        requireActiveMember(owner);
        TodoRow row = new TodoRow();
        row.setAuthorId(owner.memberId());
        row.setGuestId(owner.guestId());
        fill(row, input);
        todoDao.insert(row);
        saveReminders(row, input);
        return response(requireOwned(row.getTodoId(), owner));
    }

    @Transactional
    public Todo update(TodoOwner owner, long todoId, TodoRequest input) {
        requireActiveMember(owner);
        TodoRow row = requireOwned(todoId, owner);
        if (input.versionNumber() == null || input.versionNumber() < 1) throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "할 일 버전이 필요합니다.");
        if (!input.versionNumber().equals(row.getVersionNumber())) throw new BusinessException(ErrorCode.TODO_VERSION_CONFLICT);
        fill(row, input);
        if (todoDao.update(row, owner) == 0) throw new BusinessException(ErrorCode.TODO_VERSION_CONFLICT);
        saveReminders(row, input);
        return response(requireOwned(todoId, owner));
    }

    @Transactional
    public void delete(TodoOwner owner, long todoId, long versionNumber) {
        requireActiveMember(owner);
        requireOwned(todoId, owner);
        if (versionNumber < 1) throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "할 일 버전이 필요합니다.");
        if (todoDao.delete(todoId, owner, versionNumber) == 0) throw new BusinessException(ErrorCode.TODO_VERSION_CONFLICT);
    }

    private void requireActiveMember(TodoOwner owner) {
        if (owner.memberId() == null) return;
        var member = memberDao.selectMemberById(owner.memberId());
        if (member == null || !"ACTIVE".equals(member.getAccountStatus()) || !"Y".equals(member.getUseYn())) {
            throw new BusinessException(ErrorCode.AUTHENTICATION_REQUIRED);
        }
    }

    private TodoRow requireOwned(long todoId, TodoOwner owner) {
        var row = todoDao.find(todoId, owner);
        // 타인의 번호와 없는 번호를 같은 404로 처리한다. 관리자 예외도 두지 않는다.
        if (row == null) throw new BusinessException(ErrorCode.TODO_NOT_FOUND);
        return row;
    }

    private void fill(TodoRow row, TodoRequest input) {
        row.setTitle(input.title().trim());
        row.setContent(input.content().trim());
        row.setCompleted(input.completed());
    }

    private Todo response(TodoRow row) {
        return new Todo(row.getTodoId(), row.getTitle(), row.getContent(), row.getCompleted(), row.getVersionNumber(), row.getCreatedAt(), row.getUpdatedAt(),
            reminders.list(row.getTodoId()).stream().map(reminder -> new Reminder(reminder.getReminderId(),
                reminder.getScheduledAt().toInstant(ZoneOffset.UTC), reminder.getStatus())).toList());
    }

    private void saveReminders(TodoRow row, TodoRequest input) {
        // 생략한 필드는 완료 체크 등 기존 요청과 호환한다. 빈 배열은 모든 알림 삭제다.
        // An omitted field preserves reminders; an empty array explicitly removes them.
        if (input.reminderTimes() != null) {
            var requested = input.reminderTimes().stream().map(time -> time.truncatedTo(ChronoUnit.SECONDS)).toList();
            if (requested.size() > 20 || new HashSet<>(requested).size() != requested.size()) {
                throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "알림 시간은 중복 없이 최대 20개까지 등록해 주세요.");
            }
            var existing = reminders.list(row.getTodoId());
            var retained = existing.stream().map(reminder -> reminder.getScheduledAt().toInstant(ZoneOffset.UTC)).toList();
            for (var time : requested) {
                if (!retained.contains(time)) {
                    if (!time.isAfter(Instant.now()) || time.isAfter(Instant.now().plus(366 * 5L, ChronoUnit.DAYS))) {
                        throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "새 알림은 현재 이후부터 5년 이내의 시간으로 설정해 주세요.");
                    }
                    reminders.insert(row.getTodoId(), LocalDateTime.ofInstant(time, ZoneOffset.UTC), row.getCompleted() ? "CANCELLED" : "PENDING");
                }
            }
            existing.stream().filter(reminder -> !requested.contains(reminder.getScheduledAt().toInstant(ZoneOffset.UTC)))
                .forEach(reminder -> reminders.delete(reminder.getReminderId()));
        }
        if (row.getCompleted()) reminders.cancel(row.getTodoId());
    }
}
