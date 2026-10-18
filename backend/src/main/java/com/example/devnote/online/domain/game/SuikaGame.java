package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;

/**
 * 수박게임 대전(2~4명). 각자 자기 상자에서 과일을 떨어뜨려 합치고, 3분 뒤 점수가 높은 사람이 이긴다.
 *
 * [누가 계산하나] 과일 물리·합치기는 각자 브라우저가 계산한다(frontend suikaLogic.ts). 서버는
 *   - 모두에게 같은 시드(seed)를 줘서 떨어뜨릴 과일 순서를 같게 하고(공정성)
 *   - 브라우저가 알려 주는 점수(SCORE)와 끝남(OVER)을 모아 순위를 정한다.
 *   ★ 테트리스·뿌요뿌요 대전처럼 서버가 판을 다시 계산하지는 않는다(학습용 한계). 대신 점수가 줄거나
 *     한 번에 너무 크게 오르는 값은 거절한다.
 * [시간] 3분. 1초 tick으로 마감 시각을 정하고 지나면 끝난다. 모두 상자가 넘쳐도(OVER) 바로 끝난다.
 * [승패] 남아 있는 사람 중 최고 점수(공동 가능). 모두 0점이면 무승부.
 */
public class SuikaGame implements OnlineGame {
    public static final long TIME_LIMIT_MILLIS = 180_000;
    /** 한 번에 오를 수 있는 점수 상한(수박 둘이 사라질 때 132점 — 연쇄로 여러 번 합쳐져도 넉넉하게) */
    static final int MAX_SCORE_STEP = 2_000;

    public record View(Integer mySeat, int seed, List<Integer> scores, List<Boolean> over, List<Boolean> active,
                       Long deadline, List<String> log, List<Integer> winnerSeats, boolean finished) {}

    private final List<String> nicknames;
    private final int seed;
    private final int[] scores;
    private final boolean[] over;
    private final boolean[] active;
    private final List<String> log = new ArrayList<>();
    private final List<String> announcements = new ArrayList<>();
    private Long deadline;
    private boolean finished;

    public SuikaGame(List<String> nicknames, Random random) {
        if (nicknames.size() < 2 || nicknames.size() > 4) throw new IllegalArgumentException("수박게임 대전은 2~4명이 합니다.");
        this.nicknames = List.copyOf(nicknames);
        this.seed = random.nextInt(Integer.MAX_VALUE);
        this.scores = new int[nicknames.size()];
        this.over = new boolean[nicknames.size()];
        this.active = new boolean[nicknames.size()];
        Arrays.fill(active, true);
        say("수박게임 시작! 모두 같은 순서로 과일이 나옵니다. 3분 동안 점수를 겨루세요.");
    }

    private void say(String text) {
        announcements.add(text);
        log.add(text);
        if (log.size() > 20) log.remove(0);
    }

    // ── 진행 ─────────────────────────────────────────────────────────

    @Override
    public void act(int seat, GameAction action) {
        if (finished || seat < 0 || seat >= scores.length) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
        if (!active[seat] || over[seat]) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "이미 끝난 상자입니다.");
        Integer score = action.number();
        if (score == null) throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        // 점수는 줄어들 수 없고, 한 번에 너무 크게 오를 수도 없다(브라우저가 계산한 값이라 범위만 확인)
        if (score < scores[seat] || score - scores[seat] > MAX_SCORE_STEP) {
            throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "점수가 올바르지 않습니다.");
        }
        switch (action.actionName()) {
            case "SCORE" -> scores[seat] = score;
            case "OVER" -> {
                scores[seat] = score;
                over[seat] = true;
                say(nicknames.get(seat) + " 님 상자가 넘쳤습니다. (" + score + "점)");
                if (allDone()) finish();
            }
            default -> throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        }
    }

    private boolean allDone() {
        for (int seat = 0; seat < scores.length; seat++) if (active[seat] && !over[seat]) return false;
        return true;
    }

    @Override
    public boolean tick(long nowMillis) {
        if (finished) return false;
        if (deadline == null) {
            deadline = nowMillis + TIME_LIMIT_MILLIS;
            return true;
        }
        if (nowMillis < deadline) return false;
        say("시간 끝!");
        finish();
        return true;
    }

    private void finish() {
        finished = true;
        List<String> parts = new ArrayList<>();
        for (int seat = 0; seat < scores.length; seat++) parts.add(nicknames.get(seat) + " " + scores[seat] + "점");
        say("결과: " + String.join(", ", parts));
    }

    @Override
    public void leave(int seat) {
        if (finished || seat < 0 || seat >= scores.length || !active[seat]) return;
        active[seat] = false;
        say(nicknames.get(seat) + " 님이 나갔습니다.");
        long left = 0;
        for (boolean value : active) if (value) left++;
        if (left <= 1 || allDone()) finish();
    }

    @Override
    public boolean isFinished() {
        return finished;
    }

    /** 2048·지뢰 찾기 대전처럼, 상자가 넘친 사람은 결과(점수)가 정해졌으므로 나가도 그대로 기록한다 */
    @Override
    public boolean hasSettledResult(int seat) {
        return seat >= 0 && seat < over.length && over[seat];
    }

    @Override
    public List<Integer> winnerSeats() {
        if (!finished) return List.of();
        int top = 0;
        for (int seat = 0; seat < scores.length; seat++) if (active[seat]) top = Math.max(top, scores[seat]);
        if (top == 0) return List.of();
        List<Integer> winners = new ArrayList<>();
        for (int seat = 0; seat < scores.length; seat++) if (active[seat] && scores[seat] == top) winners.add(seat);
        return List.copyOf(winners);
    }

    @Override
    public String resultText() {
        List<Integer> winners = winnerSeats();
        if (winners.isEmpty()) return "수박게임 무승부";
        List<String> names = winners.stream().map(nicknames::get).toList();
        return "수박게임 " + String.join(" · ", names) + (names.size() > 1 ? " 공동 승리" : " 승리") + " (" + scores[winners.get(0)] + "점)";
    }

    @Override
    public Object viewFor(Integer seat) {
        boolean player = seat != null && seat >= 0 && seat < scores.length;
        List<Boolean> overList = new ArrayList<>();
        List<Boolean> activeList = new ArrayList<>();
        for (int index = 0; index < scores.length; index++) {
            overList.add(over[index]);
            activeList.add(active[index]);
        }
        return new View(player ? seat : null, seed, Arrays.stream(scores).boxed().toList(), overList, activeList,
            finished ? null : deadline, List.copyOf(log), winnerSeats(), finished);
    }

    @Override
    public List<String> drainAnnouncements() {
        List<String> drained = List.copyOf(announcements);
        announcements.clear();
        return drained;
    }
}
