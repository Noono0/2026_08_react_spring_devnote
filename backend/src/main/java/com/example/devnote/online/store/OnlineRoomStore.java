package com.example.devnote.online.store;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.online.domain.OnlineRoom;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 온라인 대전 방 보관소. 다른 기능의 DAO 자리지만, DB 대신 서버 메모리(Map)에 둔다.
 *
 * [왜 DB가 아니라 메모리인가?]
 *   방·자리·채팅은 잠깐 쓰고 사라지는 값이고 아주 자주 바뀐다(돌 하나 둘 때마다).
 *   매번 DB에 쓰면 서버 부담만 커지고 남길 가치도 없다. 대신 서버를 다시 켜면 방이 모두 사라진다.
 *
 * ConcurrentHashMap: 여러 WebSocket 연결(여러 스레드)이 동시에 넣고 빼도 안전한 Map.
 *   단, 방 "안"의 상태를 바꾸는 일은 OnlineRoomService가 방 객체를 synchronized로 잠근 뒤에 한다.
 */
@Component
public class OnlineRoomStore {
    /** 서버를 지키는 상한: 방은 동시에 50개까지 */
    public static final int MAX_ROOMS = 50;
    /** 빈 방은 1분 동안 남겨 둔다(새로고침·잠깐 끊김 뒤 다시 들어올 수 있게) */
    public static final long EMPTY_ROOM_GRACE_MILLIS = 60_000;

    /** 연결(sessionId)이 어느 방의 어느 참가자인지 */
    public record Membership(String roomId, String participantId) {}

    private final Map<String, OnlineRoom> rooms = new ConcurrentHashMap<>();
    private final Map<String, Membership> memberships = new ConcurrentHashMap<>();

    /** 새 방 저장. 상한을 넘으면 거절한다. synchronized: 두 요청이 동시에 "49개니까 괜찮다"고 판단해 51개가 되는 일을 막는다 */
    public synchronized void save(OnlineRoom room) {
        if (rooms.size() >= MAX_ROOMS) throw new BusinessException(ErrorCode.ONLINE_ROOM_LIMIT_REACHED);
        rooms.put(room.getRoomId(), room);
    }

    public Optional<OnlineRoom> findById(String roomId) {
        return roomId == null ? Optional.empty() : Optional.ofNullable(rooms.get(roomId));
    }

    /** 최근에 만든 방부터 */
    public List<OnlineRoom> findAll() {
        return rooms.values().stream().sorted(Comparator.comparingLong(OnlineRoom::getCreatedAt).reversed()).toList();
    }

    /** 사람이 없는 채로 1분이 지난 방을 지운다. 지운 개수를 돌려준다 */
    public int removeExpiredEmptyRooms(long now) {
        int removed = 0;
        for (OnlineRoom room : rooms.values()) {
            synchronized (room) {
                Long emptySince = room.getEmptySince();
                if (emptySince != null && now - emptySince >= EMPTY_ROOM_GRACE_MILLIS && rooms.remove(room.getRoomId(), room)) removed++;
            }
        }
        return removed;
    }

    public void bindSession(String sessionId, Membership membership) {
        memberships.put(sessionId, membership);
    }

    public Optional<Membership> findMembership(String sessionId) {
        return Optional.ofNullable(memberships.get(sessionId));
    }

    public Optional<Membership> unbindSession(String sessionId) {
        return Optional.ofNullable(memberships.remove(sessionId));
    }
}
