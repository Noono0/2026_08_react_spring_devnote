package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * 숫자 야구(2~4명).
 *
 * [규칙]
 *   1. 준비: 모두 서로 다른 숫자 3개(0~9)로 된 비밀 숫자를 정한다. 다른 사람은 볼 수 없다.
 *   2. 진행: 자리 순서대로 돌아가며 "다음 자리 사람"의 비밀 숫자를 맞힌다(마지막 자리는 처음 자리를 맞힘).
 *      숫자와 자리가 모두 맞으면 스트라이크(S), 숫자만 맞고 자리가 다르면 볼(B), 하나도 없으면 아웃(OUT).
 *   3. 3S(모두 맞힘)이 나오면 그 바퀴가 끝날 때까지 진행하고, 그 바퀴에 맞힌 사람이 모두 승리한다.
 *      (먼저 던지는 사람이 유리하지 않도록 같은 바퀴 안의 기회를 똑같이 준다)
 *   4. 30바퀴 안에 아무도 못 맞히면 무승부. 나간 사람은 빠지고, 혼자 남으면 그 사람이 이긴다.
 */
public class NumberBaseballGame implements OnlineGame {
    public static final int DIGITS = 3;
    public static final int MAX_ROUNDS = 30;
    private static final Pattern DISTINCT_DIGITS = Pattern.compile("^(?!.*(.).*\\1)[0-9]{3}$");

    public enum Phase { SETUP, PLAY, FINISHED }

    /** 한 번 던진 기록: seat이 targetSeat의 숫자를 guess로 맞혀 본 결과 */
    public record Pitch(int round, int seat, int targetSeat, String guess, int strikes, int balls) {}

    /** 화면 상태. mySecret은 본인에게만, secrets(모두의 숫자)는 게임이 끝난 뒤에만 채운다 */
    public record View(
        String phase, int digits, Integer mySeat, String mySecret, List<Boolean> secretReady, List<Boolean> active,
        Integer turnSeat, Integer targetSeat, int round, List<Pitch> history, List<Integer> winners, List<String> secrets
    ) {}

    private final List<String> nicknames;
    private final String[] secrets;
    private final boolean[] active;
    private final List<Pitch> history = new ArrayList<>();
    private final List<Integer> winners = new ArrayList<>();
    private final List<String> announcements = new ArrayList<>();
    private Phase phase = Phase.SETUP;
    private int turnSeat = -1;
    private int round = 1;
    /** 이번 바퀴에 맞힌 사람이 나왔는지(바퀴가 끝날 때 확인) */
    private boolean solvedThisRound;

    public NumberBaseballGame(List<String> nicknames) {
        this.nicknames = List.copyOf(nicknames);
        this.secrets = new String[nicknames.size()];
        this.active = new boolean[nicknames.size()];
        java.util.Arrays.fill(active, true);
    }

    /** 스트라이크·볼 세기(테스트에서도 쓴다) */
    public static int[] judge(String secret, String guess) {
        int strikes = 0;
        int balls = 0;
        for (int index = 0; index < DIGITS; index++) {
            char digit = guess.charAt(index);
            if (secret.charAt(index) == digit) strikes++;
            else if (secret.indexOf(digit) >= 0) balls++;
        }
        return new int[] {strikes, balls};
    }

    @Override
    public void act(int seat, GameAction action) {
        requireActive(seat);
        switch (action.actionName()) {
            case "SET_SECRET" -> setSecret(seat, action.text());
            case "GUESS" -> guess(seat, action.text());
            default -> throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        }
    }

    private void setSecret(int seat, String secret) {
        if (phase != Phase.SETUP) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "이미 숫자를 정하는 시간이 끝났습니다.");
        requireDistinctDigits(secret);
        secrets[seat] = secret;
        announcements.add(nicknames.get(seat) + "님이 숫자를 정했습니다.");
        if (allActiveReady()) startPlay();
    }

    private void guess(int seat, String guess) {
        if (phase != Phase.PLAY) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "아직 맞힐 차례가 아닙니다.");
        if (seat != turnSeat) throw new BusinessException(ErrorCode.ONLINE_NOT_YOUR_TURN);
        requireDistinctDigits(guess);
        int target = nextActiveSeat(seat);
        int[] result = judge(secrets[target], guess);
        history.add(new Pitch(round, seat, target, guess, result[0], result[1]));
        if (result[0] == DIGITS) {
            winners.add(seat);
            solvedThisRound = true;
            announcements.add(nicknames.get(seat) + "님이 " + nicknames.get(target) + "님의 숫자를 맞혔습니다! (" + round + "바퀴)");
        }
        advanceTurn(seat);
    }

    /** 다음 차례로. 처음 자리로 돌아오면 한 바퀴가 끝난 것 */
    private void advanceTurn(int seat) {
        int next = nextActiveSeat(seat);
        boolean roundEnded = next <= seat;
        if (roundEnded) {
            if (solvedThisRound) {
                finish();
                return;
            }
            if (round >= MAX_ROUNDS) {
                announcements.add(MAX_ROUNDS + "바퀴 동안 아무도 맞히지 못했습니다.");
                finish();
                return;
            }
            round++;
        }
        turnSeat = next;
    }

    @Override
    public void leave(int seat) {
        if (phase == Phase.FINISHED || !active[seat]) return;
        active[seat] = false;
        announcements.add(nicknames.get(seat) + "님이 빠졌습니다.");
        if (countActive() <= 1) {
            for (int candidate = 0; candidate < active.length; candidate++) if (active[candidate] && !winners.contains(candidate)) winners.add(candidate);
            finish();
            return;
        }
        if (phase == Phase.SETUP && allActiveReady()) startPlay();
        else if (phase == Phase.PLAY && turnSeat == seat) advanceTurn(seat);
    }

    @Override
    public boolean isFinished() {
        return phase == Phase.FINISHED;
    }

    @Override
    public String resultText() {
        if (winners.isEmpty()) return "숫자 야구 무승부";
        List<String> names = winners.stream().map(nicknames::get).toList();
        return "숫자 야구 " + String.join(" · ", names) + (names.size() > 1 ? " 공동 승리" : " 승리") + " (" + round + "바퀴)";
    }

    @Override
    public Object viewFor(Integer seat) {
        boolean finished = phase == Phase.FINISHED;
        List<Boolean> ready = new ArrayList<>();
        List<Boolean> activeList = new ArrayList<>();
        List<String> revealed = new ArrayList<>();
        for (int index = 0; index < secrets.length; index++) {
            ready.add(secrets[index] != null);
            activeList.add(active[index]);
            revealed.add(finished ? secrets[index] : null);
        }
        String mySecret = seat != null && seat >= 0 && seat < secrets.length ? secrets[seat] : null;
        Integer target = phase == Phase.PLAY ? nextActiveSeat(turnSeat) : null;
        return new View(phase.name(), DIGITS, seat, mySecret, ready, activeList, phase == Phase.PLAY ? turnSeat : null, target,
            round, List.copyOf(history), List.copyOf(winners), finished ? revealed : null);
    }

    @Override
    public List<String> drainAnnouncements() {
        List<String> drained = List.copyOf(announcements);
        announcements.clear();
        return drained;
    }

    private void startPlay() {
        phase = Phase.PLAY;
        turnSeat = firstActiveSeat();
        announcements.add("모두 숫자를 정했습니다. " + nicknames.get(turnSeat) + "님부터 맞혀 보세요!");
    }

    private void finish() {
        phase = Phase.FINISHED;
        turnSeat = -1;
    }

    private boolean allActiveReady() {
        for (int index = 0; index < secrets.length; index++) if (active[index] && secrets[index] == null) return false;
        return true;
    }

    private int countActive() {
        int count = 0;
        for (boolean isActive : active) if (isActive) count++;
        return count;
    }

    private int firstActiveSeat() {
        for (int index = 0; index < active.length; index++) if (active[index]) return index;
        return -1;
    }

    private int nextActiveSeat(int seat) {
        for (int step = 1; step <= active.length; step++) {
            int candidate = (seat + step) % active.length;
            if (active[candidate]) return candidate;
        }
        return seat;
    }

    private void requireActive(int seat) {
        if (phase == Phase.FINISHED || seat < 0 || seat >= active.length || !active[seat]) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
    }

    private static void requireDistinctDigits(String value) {
        if (value == null || !DISTINCT_DIGITS.matcher(value).matches()) {
            throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "서로 다른 숫자 3개(0~9)를 입력해 주세요.");
        }
    }
}
