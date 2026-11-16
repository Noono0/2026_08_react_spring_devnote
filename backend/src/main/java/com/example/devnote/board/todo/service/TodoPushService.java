package com.example.devnote.board.todo.service;

import com.example.devnote.board.todo.controller.TodoPushDeviceCookie;
import com.example.devnote.board.todo.dao.TodoPushDao;
import com.example.devnote.board.todo.dao.TodoPushSubscriptionRow;
import com.example.devnote.board.todo.domain.TodoOwner;
import com.example.devnote.board.todo.dto.TodoPushDtos.*;
import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.member.dao.MemberDao;
import java.net.URI;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class TodoPushService {
    private final TodoPushDao dao;
    private final WebPushTransport transport;
    private final MemberDao members;

    @Transactional(readOnly = true)
    public Settings settings(TodoOwner owner, String deviceHash) {
        requireActive(owner);
        var device = deviceHash == null ? null : dao.device(deviceHash);
        return new Settings(transport.configured(), transport.publicKey(), belongs(device, owner) && Boolean.TRUE.equals(device.getEnabled()));
    }
    @Transactional
    public void subscribe(TodoOwner owner, String deviceHash, SubscriptionRequest input) {
        requireActive(owner);
        if (!transport.configured()) throw new BusinessException(ErrorCode.TODO_PUSH_NOT_CONFIGURED);
        if (deviceHash == null) throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "이 사이트의 쿠키를 허용하고 알림 연결을 다시 확인해 주세요.");
        validateEndpoint(input.endpoint());
        var previous = dao.device(deviceHash);
        if (belongs(previous, owner) && previous.getEndpoint().equals(input.endpoint()) && Boolean.TRUE.equals(previous.getEnabled())) return;
        if ((!belongs(previous, owner) || !Boolean.TRUE.equals(previous.getEnabled())) && dao.countDevices(owner) >= 10) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "알림 기기는 소유자당 최대 10개까지 연결할 수 있습니다.");
        }
        var row = new TodoPushSubscriptionRow();
        row.setDeviceHash(deviceHash); row.setEndpointHash(TodoPushDeviceCookie.hash(input.endpoint())); row.setEndpoint(input.endpoint());
        row.setAuthorId(owner.memberId()); row.setGuestId(owner.guestId());
        if (previous != null) dao.removeDevice(deviceHash);
        try { dao.saveDevice(row); }
        catch (DuplicateKeyException exception) { throw new BusinessException(ErrorCode.TODO_PUSH_CONTEXT_CHANGED); }
    }
    @Transactional
    public void disableDevice(String deviceHash) { if (deviceHash != null) dao.removeDevice(deviceHash); }

    private boolean belongs(TodoPushSubscriptionRow device, TodoOwner owner) {
        return device != null && Objects.equals(device.getAuthorId(), owner.memberId()) && Objects.equals(device.getGuestId(), owner.guestId());
    }
    private void requireActive(TodoOwner owner) {
        if (owner.memberId() == null) return;
        var member = members.selectMemberById(owner.memberId());
        if (member == null || !"ACTIVE".equals(member.getAccountStatus()) || !"Y".equals(member.getUseYn())) throw new BusinessException(ErrorCode.AUTHENTICATION_REQUIRED);
    }
    public static void validateEndpoint(String endpoint) {
        try {
            var uri = URI.create(endpoint);
            String host = uri.getHost();
            boolean allowed = host != null && (host.equals("fcm.googleapis.com") || host.equals("updates.push.services.mozilla.com")
                || host.endsWith(".push.services.mozilla.com") || host.equals("web.push.apple.com") || host.endsWith(".push.apple.com")
                || host.endsWith(".notify.windows.com"));
            if (!allowed || !"https".equals(uri.getScheme()) || (uri.getPort() != -1 && uri.getPort() != 443)
                || uri.getUserInfo() != null || uri.getFragment() != null || uri.getPath() == null || uri.getPath().length() < 2) throw invalidSubscription();
        } catch (IllegalArgumentException exception) { throw invalidSubscription(); }
    }
    private static BusinessException invalidSubscription() {
        return new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "지원하는 브라우저에서 알림을 다시 연결해 주세요.");
    }
}
