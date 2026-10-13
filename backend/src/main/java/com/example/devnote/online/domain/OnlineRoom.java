package com.example.devnote.online.domain;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.online.domain.game.GameAction;
import com.example.devnote.online.domain.game.OnlineGame;
import com.example.devnote.online.domain.game.OnlineGames;
import lombok.AccessLevel;
import lombok.Getter;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Random;
import java.util.Set;

/**
 * 온라인 대전 방 하나의 상태와 규칙입니다. (서버 메모리에만 있고 DB에는 저장하지 않는다)
 *
 * [플레이어와 관전자]
 *   participants: 방에 들어온 모든 사람(들어온 순서대로 — LinkedHashMap은 넣은 순서를 기억한다)
 *   seats       : 플레이어 자리. 칸마다 그 자리에 앉은 participantId, 빈 자리는 null
 *   자리에 앉으면 플레이어, 아니면 관전자다.
 *
 * [함께 정한 규칙]
 *   1. 인원 수를 줄이면 앞 번호 자리에 앉은 사람이 남고, 뒷자리 사람은 빈 앞자리로 옮긴다. 자리가 모자라면 관전자가 된다.
 *   2. 게임 종류·인원 수·게임 옵션은 방장만, 게임 중이 아닐 때만 바꾼다. 게임 종류를 바꾸면 옵션은 새 게임의 처음 값이 된다. 제목·비밀번호·로그인 유저만은 게임 중에도 바꿀 수 있다.
 *   3. 방 최대 인원은 관전자 포함 10명.
 *   4. 게임 중에는 자리에 앉거나 일어날 수 없다(다음 판부터).
 *   5. 방장이 나가면 남은 사람 중 먼저 들어온 사람이 방장이 된다.
 *
 * ★ 이 클래스는 동시에 여러 요청이 들어와도 안전하지 않다(thread-safe 아님).
 *   OnlineRoomService가 방 객체를 synchronized로 잠근 뒤에만 부른다.
 */
@Getter
public class OnlineRoom {
    public static final int MAX_PARTICIPANTS = 10;
    public static final int CHAT_HISTORY_SIZE = 50;
    public static final int TITLE_MAX_LENGTH = 30;
    public static final int CHAT_MAX_LENGTH = 200;

    public enum Status { WAITING, PLAYING }

    private final String roomId;
    private final long createdAt;
    private String title;
    private OnlineGameType gameType;
    /** 방장이 고른 게임 옵션 code(OnlineGameType.getOptions() 중 하나). 옵션이 없는 게임은 null */
    private String gameOption;
    @Getter(AccessLevel.NONE) // 해시도 밖으로 내보내지 않는다. 확인은 passwordMatches로만
    private RoomPassword password;
    private boolean membersOnly;
    private Status status = Status.WAITING;
    private String hostId;
    /**
     * 방을 만든 사람만 아는 표. 들어올 때 내면 비밀번호 없이 들어오고 방장이 된다.
     * 방이 있는 동안 계속 쓸 수 있다: 만든 사람이 새로고침하거나 잠깐 끊겨 다시 들어와도 방장으로 돌아온다.
     */
    @Getter(AccessLevel.NONE)
    private String hostToken;
    /** 마지막 사람이 나간 시각. 잠깐 새로고침하는 동안 방이 사라지지 않도록 바로 지우지 않는다(OnlineRoomStore). */
    private Long emptySince;
    private OmokGame omokGame;
    /** 테트리스 대전 판(시작 전이면 null) */
    private TetrisBattle tetrisBattle;
    /** 뿌요뿌요 대전 판(시작 전이면 null) */
    private PuyoBattle puyoBattle;
    /** 공통 틀(OnlineGame)로 진행하는 게임(숫자 야구 등). 시작 전이면 null */
    private OnlineGame game;
    /** 지난 판 결과 문구(예: "흑 철수 승리") */
    private String lastResult;
    /** 이번 판을 시작할 때 자리에 앉아 있던 사람(자리 순서). 중간에 나가도 남겨 두어 패배로 기록한다 */
    @Getter(AccessLevel.NONE)
    private List<OnlineParticipant> matchPlayers = List.of();
    /** 이번 판에서 기권하거나 나간 자리. 이긴 팀(마피아 등)이어도 승리로 기록하지 않는다 */
    @Getter(AccessLevel.NONE)
    private final Set<Integer> forfeitedSeats = new HashSet<>();
    /** 끝났지만 아직 저장하지 않은 판. Service가 꺼내(drain) 랭킹에 저장한다 */
    @Getter(AccessLevel.NONE)
    private OnlineMatchResult finishedMatch;

    @Getter(AccessLevel.NONE)
    private final Map<String, OnlineParticipant> participants = new LinkedHashMap<>();
    private List<String> seats;
    private final Deque<OnlineChatMessage> chatHistory = new ArrayDeque<>();
    /** 아직 방 사람들에게 보내지 않은 새 채팅·안내 문구. Service가 꺼내(drain) 보낸다. */
    @Getter(AccessLevel.NONE)
    private final List<OnlineChatMessage> pendingChats = new ArrayList<>();
    private long chatSequence;

    public OnlineRoom(String roomId, OnlineRoomSettings settings, String hostToken, long now) {
        this.roomId = roomId;
        this.createdAt = now;
        this.hostToken = hostToken;
        this.emptySince = now; // 만든 직후에는 아직 아무도 없다
        this.title = normalizeTitle(settings.title());
        requireAvailable(settings.gameType(), settings.seatCount());
        this.gameType = settings.gameType();
        this.gameOption = resolveGameOption(settings.gameType(), settings.gameOption(), settings.gameType().getDefaultOption());
        this.seats = new ArrayList<>(Collections.nCopies(settings.seatCount(), null));
        this.password = settings.newPassword() == null || settings.newPassword().isBlank() ? null : createPassword(settings.newPassword());
        this.membersOnly = settings.membersOnly();
    }

    // ── 입장·퇴장 ────────────────────────────────────────────────────

    public boolean hasPassword() {
        return password != null;
    }

    public boolean passwordMatches(String candidate) {
        return password == null || password.matches(candidate);
    }

    /** 방을 만든 사람의 표가 맞는지 */
    public boolean hostTokenMatches(String candidate) {
        if (hostToken == null || candidate == null) return false;
        return MessageDigest.isEqual(hostToken.getBytes(StandardCharsets.UTF_8), candidate.getBytes(StandardCharsets.UTF_8));
    }

    public boolean isNicknameTaken(String nickname) {
        return participants.values().stream().anyMatch(participant -> participant.getNickname().equalsIgnoreCase(nickname));
    }

    public void addParticipant(OnlineParticipant participant, boolean becomeHost, long now) {
        if (participants.size() >= MAX_PARTICIPANTS) throw new BusinessException(ErrorCode.ONLINE_ROOM_FULL);
        participants.put(participant.getParticipantId(), participant);
        emptySince = null;
        if (hostId == null || becomeHost) hostId = participant.getParticipantId();
        addSystemMessage(participant.getNickname() + "님이 들어왔습니다.", now);
    }

    public void removeParticipant(String participantId, long now) {
        OnlineParticipant participant = participants.remove(participantId);
        if (participant == null) return;
        int seat = seatOf(participantId);
        if (seat >= 0) {
            seats.set(seat, null);
            if (status == Status.PLAYING) finishByLeaving(seat, participant.getNickname(), now);
        }
        if (participantId.equals(hostId)) {
            // 규칙 5: 남은 사람 중 먼저 들어온 사람(LinkedHashMap의 첫 번째)이 방장
            hostId = participants.isEmpty() ? null : participants.keySet().iterator().next();
            if (hostId != null) addSystemMessage(participants.get(hostId).getNickname() + "님이 방장이 되었습니다.", now);
        }
        addSystemMessage(participant.getNickname() + "님이 나갔습니다.", now);
        if (participants.isEmpty()) emptySince = now;
    }

    /** 들어온 순서대로 모든 참가자(읽기 전용 복사본) */
    public List<OnlineParticipant> getParticipants() {
        return List.copyOf(participants.values());
    }

    public OnlineParticipant requireParticipant(String participantId) {
        OnlineParticipant participant = participants.get(participantId);
        if (participant == null) throw new BusinessException(ErrorCode.ONLINE_ROOM_NOT_JOINED);
        return participant;
    }

    // ── 자리 ────────────────────────────────────────────────────────

    public int seatOf(String participantId) {
        return seats.indexOf(participantId);
    }

    public int getSeatCount() {
        return seats.size();
    }

    public List<String> getSeats() {
        return Collections.unmodifiableList(seats);
    }

    public long countPlayers() {
        return seats.stream().filter(seat -> seat != null).count();
    }

    /** 빈 자리에 앉는다. 이미 다른 자리에 앉아 있으면 옮긴다. 규칙 4: 게임 중에는 안 됨 */
    public void sit(String participantId, int seatIndex) {
        requireParticipant(participantId);
        requireNotPlaying();
        if (seatIndex < 0 || seatIndex >= seats.size() || seats.get(seatIndex) != null) {
            throw new BusinessException(ErrorCode.ONLINE_SEAT_UNAVAILABLE);
        }
        int currentSeat = seatOf(participantId);
        if (currentSeat >= 0) seats.set(currentSeat, null);
        seats.set(seatIndex, participantId);
    }

    /** 자리에서 일어나 관전자가 된다 */
    public void stand(String participantId) {
        requireParticipant(participantId);
        requireNotPlaying();
        int currentSeat = seatOf(participantId);
        if (currentSeat >= 0) seats.set(currentSeat, null);
    }

    /**
     * 규칙 1: 인원 수를 바꾼다.
     *   - 새 인원 안쪽 자리(0 ~ newCount-1)에 앉은 사람은 그 자리 그대로
     *   - 바깥 자리에 앉은 사람은 앞의 빈자리로 옮기고, 빈자리가 없으면 관전자
     * 예) 4인(A,B,C,D) → 2인: A,B 남고 C,D 관전자 / 4인(_,B,_,D) → 2인: B는 1번 그대로, D는 빈 0번으로
     */
    void resizeSeats(int newCount) {
        List<String> nextSeats = new ArrayList<>(Collections.nCopies(newCount, null));
        List<String> overflow = new ArrayList<>();
        for (int index = 0; index < seats.size(); index++) {
            String seated = seats.get(index);
            if (seated == null) continue;
            if (index < newCount) nextSeats.set(index, seated);
            else overflow.add(seated);
        }
        for (String seated : overflow) {
            int emptySeat = nextSeats.indexOf(null);
            if (emptySeat >= 0) nextSeats.set(emptySeat, seated);
        }
        seats = nextSeats;
    }

    // ── 방 정보 수정(방장) ───────────────────────────────────────────

    public void updateSettings(String requesterId, OnlineRoomSettings settings, long now) {
        requireHost(requesterId);
        String nextTitle = normalizeTitle(settings.title());
        boolean gameChanged = settings.gameType() != gameType || settings.seatCount() != seats.size();
        if (gameChanged) {
            requireNotPlaying(); // 규칙 2
            requireAvailable(settings.gameType(), settings.seatCount());
        }
        // 옵션을 비워 보내면: 같은 게임이면 지금 옵션 그대로, 다른 게임이면 그 게임의 처음 옵션
        String keptOption = settings.gameType() == gameType ? gameOption : settings.gameType().getDefaultOption();
        String nextOption = resolveGameOption(settings.gameType(), settings.gameOption(), keptOption);
        boolean optionChanged = !Objects.equals(nextOption, gameOption);
        if (optionChanged) requireNotPlaying();
        if (settings.membersOnly() && !participants.get(requesterId).isMember()) {
            throw new BusinessException(ErrorCode.ONLINE_ROOM_SETTINGS_INVALID, "로그인한 방장만 '로그인 유저만 참가'를 켤 수 있습니다.");
        }
        RoomPassword nextPassword = password;
        if (settings.removePassword()) nextPassword = null;
        else if (settings.newPassword() != null && !settings.newPassword().isBlank()) nextPassword = createPassword(settings.newPassword());

        // 검사를 모두 통과한 뒤에 한꺼번에 바꾼다(중간에 실패해 반만 바뀌는 일이 없게)
        title = nextTitle;
        password = nextPassword;
        membersOnly = settings.membersOnly();
        if (gameChanged) {
            if (settings.gameType() != gameType) {
                omokGame = null;
                tetrisBattle = null;
                puyoBattle = null;
                game = null;
                lastResult = null;
            }
            gameType = settings.gameType();
            resizeSeats(settings.seatCount());
        }
        gameOption = nextOption;
        String optionText = gameOption == null ? "" : " · " + gameType.optionLabel(gameOption);
        addSystemMessage("방 정보가 바뀌었습니다: " + gameType.getLabel() + " · " + seats.size() + "인" + optionText, now);
    }

    /** 방장이 보낸 옵션을 검사한다. 비어 있으면 keptOption, 이 게임에서 고를 수 없는 값이면 오류 */
    private static String resolveGameOption(OnlineGameType type, String requested, String keptOption) {
        if (requested == null || requested.isBlank()) return keptOption;
        if (!type.allowsOption(requested)) throw new BusinessException(ErrorCode.ONLINE_GAME_OPTION_INVALID);
        return requested;
    }

    // ── 게임 진행 ────────────────────────────────────────────────────

    /**
     * 게임 시작(방장). 자리가 모두 차야 한다.
     * seed: 테트리스 대전에서 모두가 같은 순서의 블록을 받도록 나눠 주는 난수 시드(Service가 만든다)
     */
    public void start(String requesterId, long now, int seed) {
        requireHost(requesterId);
        requireNotPlaying();
        if (seats.contains(null)) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_READY);
        requireAvailable(gameType, seats.size());
        lastResult = null;
        status = Status.PLAYING;
        tetrisBattle = null;
        puyoBattle = null;
        omokGame = null;
        game = null;
        matchPlayers = seats.stream().map(participants::get).toList();
        forfeitedSeats.clear();
        List<String> nicknames = new ArrayList<>();
        for (int seat = 0; seat < seats.size(); seat++) nicknames.add(nicknameAt(seat));
        if (OnlineGames.usesCommonGame(gameType)) {
            game = OnlineGames.create(gameType, nicknames, new Random(seed), gameOption);
            String optionText = gameOption == null ? "" : "(" + gameType.optionLabel(gameOption) + ")";
            addSystemMessage(gameType.getLabel() + optionText + " 시작! " + String.join(" · ", nicknames), now);
            afterGameChange(now);
            return;
        }
        if (gameType == OnlineGameType.TETRIS) {
            tetrisBattle = new TetrisBattle(seed, nicknames);
            addSystemMessage("게임 시작! " + String.join(" · ", nicknames) + " — 마지막까지 살아남으면 1위", now);
            return;
        }
        if (gameType == OnlineGameType.PUYO) {
            puyoBattle = new PuyoBattle(seed, nicknames);
            addSystemMessage("게임 시작! " + String.join(" · ", nicknames) + " — 마지막까지 살아남으면 1위", now);
            return;
        }
        omokGame = new OmokGame();
        addSystemMessage("게임 시작! 흑 " + nicknameAt(0) + " · 백 " + nicknameAt(1), now);
    }

    public void placeOmok(String participantId, int row, int col, long now) {
        requireParticipant(participantId);
        if (status != Status.PLAYING || omokGame == null) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
        int seat = seatOf(participantId);
        if (seat < 0) throw new BusinessException(ErrorCode.ONLINE_NOT_YOUR_TURN, "관전자는 돌을 둘 수 없습니다.");
        omokGame.place(seat, row, col);
        if (omokGame.isFinished()) {
            finishGame(omokGame.isDraw() ? "무승부(판이 가득 찼습니다)" : stoneName(seat) + " " + nicknameAt(seat) + " 승리", now);
        }
    }

    /** 공통 틀 게임의 행동(GAME_ACTION). 관전자는 할 수 없다 */
    public void gameAction(String participantId, GameAction action, long now) {
        requireParticipant(participantId);
        if (status != Status.PLAYING || game == null) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
        int seat = seatOf(participantId);
        if (seat < 0) throw new BusinessException(ErrorCode.ONLINE_NOT_YOUR_TURN, "관전자는 게임에 참여할 수 없습니다.");
        game.act(seat, action);
        afterGameChange(now);
    }

    /** 게임이 남긴 안내를 채팅으로 옮기고, 끝났으면 방을 대기 상태로 돌린다 */
    private void afterGameChange(long now) {
        for (String announcement : game.drainAnnouncements()) addSystemMessage(announcement, now);
        if (status == Status.PLAYING && game.isFinished()) finishGame(game.resultText(), now);
    }

    /** 기권: 오목은 상대가 이기고, 테트리스·공통 틀 게임은 나만 빠진다 */
    public void resign(String participantId, long now) {
        requireParticipant(participantId);
        int seat = seatOf(participantId);
        if (status == Status.PLAYING && seat >= 0) forfeit(seat);
        if (status == Status.PLAYING && game != null && seat >= 0) {
            addSystemMessage(nicknameAt(seat) + " 기권", now);
            game.leave(seat);
            afterGameChange(now);
            return;
        }
        if (status == Status.PLAYING && tetrisBattle != null && seat >= 0) {
            eliminateFromTetris(seat, nicknameAt(seat) + " 기권", now);
            return;
        }
        if (status == Status.PLAYING && puyoBattle != null && seat >= 0) {
            eliminateFromPuyo(seat, nicknameAt(seat) + " 기권", now);
            return;
        }
        if (status != Status.PLAYING || omokGame == null || seat < 0) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
        int winnerSeat = 1 - seat;
        omokGame.finishWithWinner(winnerSeat);
        finishGame(nicknameAt(seat) + " 기권 · " + stoneName(winnerSeat) + " " + nicknameAt(winnerSeat) + " 승리", now);
    }

    /**
     * 기권·나감을 기록한다(이긴 쪽이어도 승리로 저장하지 않는다).
     * 단, 2048·지뢰 찾기 대전처럼 이미 자기 결과(성공·실패)가 정해진 자리는 그 결과를 지킨다 — 먼저 끝내고 나가도 손해가 없게.
     */
    private void forfeit(int seat) {
        if (game != null && game.hasSettledResult(seat)) return;
        forfeitedSeats.add(seat);
    }

    private void finishByLeaving(int leftSeat, String leftNickname, long now) {
        forfeit(leftSeat);
        if (game != null) {
            game.leave(leftSeat);
            afterGameChange(now);
            return;
        }
        if (tetrisBattle != null) {
            eliminateFromTetris(leftSeat, leftNickname + "님이 나가 탈락", now);
            return;
        }
        if (puyoBattle != null) {
            eliminateFromPuyo(leftSeat, leftNickname + "님이 나가 탈락", now);
            return;
        }
        if (omokGame == null) return;
        int winnerSeat = 1 - leftSeat;
        omokGame.finishWithWinner(winnerSeat);
        finishGame(leftNickname + "님이 나가 " + stoneName(winnerSeat) + " " + nicknameAt(winnerSeat) + " 승리", now);
    }

    // ── 테트리스 대전 ────────────────────────────────────────────────

    /** 공격 결과: 방해 줄을 받을 참가자와 줄 수 */
    public record TetrisAttack(String targetParticipantId, int lines) {}

    /** 블록이 굳을 때마다 받는 내 판 요약·점수 */
    public void updateTetrisBoard(String participantId, String board, int score, int clearedLines) {
        tetrisBattle().updateBoard(requireTetrisSeat(participantId), board, score, clearedLines);
    }

    /**
     * 줄을 지웠다는 알림 → 방해 줄을 받을 상대를 정한다. 보낼 줄이 없거나(1줄) 상대가 없으면 null.
     * 서버가 "누구에게 몇 줄"만 정하고, 실제로 판에 줄을 넣는 일은 받는 사람의 브라우저가 한다.
     */
    public TetrisAttack tetrisAttack(String participantId, int clearedLines) {
        TetrisBattle battle = tetrisBattle();
        int seat = requireTetrisSeat(participantId);
        int garbage = TetrisBattle.garbageFor(clearedLines);
        if (garbage == 0) return null;
        var target = battle.attackTarget(seat);
        if (target.isEmpty()) return null;
        String targetParticipantId = seats.get(target.getAsInt());
        return targetParticipantId == null ? null : new TetrisAttack(targetParticipantId, garbage);
    }

    /** 더 쌓을 곳이 없어 끝났다는 알림 */
    public void tetrisToppedOut(String participantId, long now) {
        int seat = requireTetrisSeat(participantId);
        eliminateFromTetris(seat, nicknameAt(seat) + " 탈락", now);
    }

    private void eliminateFromTetris(int seat, String message, long now) {
        if (!tetrisBattle.isAlive(seat)) return;
        tetrisBattle.eliminate(seat);
        addSystemMessage(message + " (남은 사람 " + tetrisBattle.countAlive() + "명)", now);
        if (tetrisBattle.isFinished()) finishGame(tetrisBattle.describeResult(), now);
    }

    private TetrisBattle tetrisBattle() {
        if (status != Status.PLAYING || tetrisBattle == null) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
        return tetrisBattle;
    }

    private int requireTetrisSeat(String participantId) {
        requireParticipant(participantId);
        int seat = seatOf(participantId);
        if (seat < 0) throw new BusinessException(ErrorCode.ONLINE_NOT_YOUR_TURN, "관전자는 게임에 참여할 수 없습니다.");
        if (!tetrisBattle().isAlive(seat)) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING, "이미 탈락했습니다.");
        return seat;
    }

    // ── 뿌요뿌요 대전 ────────────────────────────────────────────────

    public record PuyoAttack(String targetParticipantId, int nuisance) {}

    public void updatePuyoBoard(String participantId, String board, int score, int chains) {
        puyoBattle().updateBoard(requirePuyoSeat(participantId), board, score, chains);
    }

    public PuyoAttack puyoAttack(String participantId, int nuisance) {
        PuyoBattle battle = puyoBattle();
        int seat = requirePuyoSeat(participantId);
        int garbage = PuyoBattle.garbageFor(nuisance);
        if (garbage == 0) return null;
        var target = battle.attackTarget(seat);
        if (target.isEmpty()) return null;
        String targetParticipantId = seats.get(target.getAsInt());
        return targetParticipantId == null ? null : new PuyoAttack(targetParticipantId, garbage);
    }

    public void puyoToppedOut(String participantId, long now) {
        int seat = requirePuyoSeat(participantId);
        eliminateFromPuyo(seat, nicknameAt(seat) + " 탈락", now);
    }

    private void eliminateFromPuyo(int seat, String message, long now) {
        if (!puyoBattle.isAlive(seat)) return;
        puyoBattle.eliminate(seat);
        addSystemMessage(message + " (남은 사람 " + puyoBattle.countAlive() + "명)", now);
        if (puyoBattle.isFinished()) finishGame(puyoBattle.describeResult(), now);
    }

    private PuyoBattle puyoBattle() {
        if (status != Status.PLAYING || puyoBattle == null) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
        return puyoBattle;
    }

    private int requirePuyoSeat(String participantId) {
        requireParticipant(participantId);
        int seat = seatOf(participantId);
        if (seat < 0) throw new BusinessException(ErrorCode.ONLINE_NOT_YOUR_TURN, "관전자는 게임에 참여할 수 없습니다.");
        if (!puyoBattle().isAlive(seat)) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING, "이미 탈락했습니다.");
        return seat;
    }

    private void finishGame(String result, long now) {
        status = Status.WAITING;
        lastResult = result;
        finishedMatch = buildMatchResult(now);
        addSystemMessage("게임 끝: " + result, now);
    }

    /** 끝났지만 아직 저장하지 않은 판을 꺼내고 비운다(없으면 null) */
    public OnlineMatchResult drainFinishedMatch() {
        OnlineMatchResult drained = finishedMatch;
        finishedMatch = null;
        return drained;
    }

    private OnlineMatchResult buildMatchResult(long now) {
        List<Integer> winners = winnerSeats();
        List<OnlineMatchResult.Player> players = new ArrayList<>();
        for (int seat = 0; seat < matchPlayers.size(); seat++) {
            OnlineParticipant player = matchPlayers.get(seat);
            boolean won = winners.contains(seat) && !forfeitedSeats.contains(seat);
            players.add(new OnlineMatchResult.Player(player.getMemberId(), player.getNickname(), won));
        }
        return new OnlineMatchResult(gameType, List.copyOf(players), now);
    }

    /** 게임마다 다른 승자 표현(공통 틀·테트리스·오목)을 이긴 자리 번호 목록 하나로 모은다. 무승부면 빈 목록 */
    private List<Integer> winnerSeats() {
        if (OnlineGames.usesCommonGame(gameType)) return game == null ? List.of() : game.winnerSeats();
        Integer winnerSeat = switch (gameType) {
            case TETRIS -> tetrisBattle == null ? null : tetrisBattle.getWinnerSeat();
            case PUYO -> puyoBattle == null ? null : puyoBattle.getWinnerSeat();
            default -> omokGame == null ? null : omokGame.getWinnerSeat();
        };
        return winnerSeat == null ? List.of() : List.of(winnerSeat);
    }

    private static String stoneName(int seat) {
        return seat == 0 ? "흑" : "백";
    }

    private String nicknameAt(int seat) {
        String participantId = seat >= 0 && seat < seats.size() ? seats.get(seat) : null;
        OnlineParticipant participant = participantId == null ? null : participants.get(participantId);
        return participant == null ? "(빈자리)" : participant.getNickname();
    }

    // ── 채팅 ────────────────────────────────────────────────────────

    /** 채팅 한 줄을 남긴다. 줄바꿈은 공백으로 바꾸고 1~200자만 받는다. 1초에 2개까지(도배 막기) */
    public void addChat(String participantId, String text, long now) {
        OnlineParticipant participant = requireParticipant(participantId);
        String normalized = text == null ? "" : text.replaceAll("[\\r\\n\\t]+", " ").strip();
        if (normalized.isEmpty() || normalized.length() > CHAT_MAX_LENGTH) throw new BusinessException(ErrorCode.ONLINE_CHAT_INVALID);
        int seat = seatOf(participantId);
        if (status == Status.PLAYING && game != null && seat >= 0 && !game.canChat(seat)) {
            throw new BusinessException(ErrorCode.ONLINE_CHAT_INVALID, "탈락한 플레이어는 게임이 끝날 때까지 채팅할 수 없습니다.");
        }
        if (!participant.tryRecordChat(now)) throw new BusinessException(ErrorCode.ONLINE_TOO_MANY_MESSAGES);
        appendChat(new OnlineChatMessage(++chatSequence, participant.getNickname(), normalized, now, false, seatOf(participantId) < 0));
    }

    public void addSystemMessage(String text, long now) {
        appendChat(new OnlineChatMessage(++chatSequence, null, text, now, true, false));
    }

    private void appendChat(OnlineChatMessage message) {
        chatHistory.addLast(message);
        while (chatHistory.size() > CHAT_HISTORY_SIZE) chatHistory.removeFirst(); // 최근 50개만 기억
        pendingChats.add(message);
    }

    public List<OnlineChatMessage> getChatHistory() {
        return List.copyOf(chatHistory);
    }

    /** 아직 안 보낸 새 채팅을 꺼내고 비운다 */
    public List<OnlineChatMessage> drainPendingChats() {
        List<OnlineChatMessage> drained = List.copyOf(pendingChats);
        pendingChats.clear();
        return drained;
    }

    // ── 검사 도우미 ──────────────────────────────────────────────────

    public boolean isHost(String participantId) {
        return participantId != null && participantId.equals(hostId);
    }

    private void requireHost(String participantId) {
        requireParticipant(participantId);
        if (!isHost(participantId)) throw new BusinessException(ErrorCode.ONLINE_ROOM_HOST_ONLY);
    }

    private void requireNotPlaying() {
        if (status == Status.PLAYING) throw new BusinessException(ErrorCode.ONLINE_GAME_IN_PROGRESS);
    }

    private static void requireAvailable(OnlineGameType gameType, int seatCount) {
        if (gameType == null || !gameType.isAvailable()) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_AVAILABLE);
        if (!gameType.allowsSeatCount(seatCount)) throw new BusinessException(ErrorCode.ONLINE_SEAT_COUNT_INVALID);
    }

    static String normalizeTitle(String title) {
        String normalized = title == null ? "" : title.strip();
        if (normalized.isEmpty() || normalized.length() > TITLE_MAX_LENGTH) {
            throw new BusinessException(ErrorCode.ONLINE_ROOM_SETTINGS_INVALID, "방 제목은 1~30자로 입력해 주세요.");
        }
        return normalized;
    }

    private static RoomPassword createPassword(String rawPassword) {
        if (!RoomPassword.isValidLength(rawPassword)) {
            throw new BusinessException(ErrorCode.ONLINE_ROOM_SETTINGS_INVALID, "방 비밀번호는 4~20자로 입력해 주세요.");
        }
        return RoomPassword.create(rawPassword);
    }
}
