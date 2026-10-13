package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * 올림픽(육상 6종목, 1~4명). 한 판 안에서 1번 선수(0번 자리)가 할 종목을 고르고, 고른 순서대로 겨룬다.
 *
 * [누가 계산하나?] 달리기·점프·던지기 움직임은 각자 브라우저(olympicLogic.ts)가 계산하고, 서버는
 *   기록(RESULT)을 받아 순위·메달을 정한다. 테트리스 대전처럼 "결과만 중계"하는 구조라 서버 부담이 작다.
 *   대신 말이 안 되는 기록(100m 8초 미만 등)은 Event의 범위로 거절한다.
 * [진행] SELECT(종목 고르기) → EVENT(모두 기록을 낼 때까지) → RESULT(순위 확인, 모두 '다음'을 누르면) → … → END
 * [메달] 2명 이상: 그 종목 순위 1·2·3위(같은 기록은 같은 메달). 1명(혼자 연습): 기준 기록(Event.gold 등)을 넘으면 메달.
 * [우승] 금 → 은 → 동 개수 순. 모두 같으면 공동 우승.
 * [행동] SELECT numbers = 종목 번호(Event 순서, 0~5), RESULT number = 기록(-1 = 기록 없음),
 *        PROGRESS number = 달린 거리(cm, 달리기 종목에서 다른 선수 화면에 보여 줌), NEXT = 결과 확인
 */
public class OlympicGame implements OnlineGame {
    /** 기록 단위: timed면 밀리초(작을수록 좋음), 아니면 센티미터. min·max = 받아들이는 기록 범위 */
    public enum Event {
        SPRINT_100("100m 달리기", true, 8_000, 60_000, 11_000, 12_000, 13_500),
        HURDLES_110("110m 허들", true, 10_000, 90_000, 14_500, 16_000, 18_000),
        LONG_JUMP("멀리뛰기", false, 1, 1_000, 720, 650, 580),
        JAVELIN("창던지기", false, 1, 12_000, 8_000, 7_000, 6_000),
        HAMMER("해머던지기", false, 1, 10_000, 7_000, 6_000, 5_000),
        HIGH_JUMP("높이뛰기", false, 170, 270, 205, 195, 185);

        private final String label;
        private final boolean timed;
        private final int min;
        private final int max;
        private final int gold;
        private final int silver;
        private final int bronze;

        Event(String label, boolean timed, int min, int max, int gold, int silver, int bronze) {
            this.label = label;
            this.timed = timed;
            this.min = min;
            this.max = max;
            this.gold = gold;
            this.silver = silver;
            this.bronze = bronze;
        }

        public String label() {
            return label;
        }

        boolean better(int a, int b) {
            return timed ? a < b : a > b;
        }

        String format(Integer mark) {
            if (mark == null) return "기록 없음";
            return timed ? String.format("%.2f초", mark / 1000.0) : String.format("%.2fm", mark / 100.0);
        }

        /** 혼자 할 때의 메달(기준 기록) */
        String medalByStandard(Integer mark) {
            if (mark == null) return null;
            if (timed ? mark <= gold : mark >= gold) return "GOLD";
            if (timed ? mark <= silver : mark >= silver) return "SILVER";
            if (timed ? mark <= bronze : mark >= bronze) return "BRONZE";
            return null;
        }
    }

    public enum Phase { SELECT, EVENT, RESULT, END }

    public record PlayerView(boolean active, boolean submitted, boolean ready, Integer progress, int gold, int silver, int bronze) {}

    /** marks: 자리별 기록(null = 기록 없음 또는 아직), medals: GOLD·SILVER·BRONZE·null */
    public record EventResultView(String event, List<Integer> marks, List<String> medals) {}

    public record View(Integer mySeat, Phase phase, List<String> events, int eventIndex, String currentEvent,
                       List<PlayerView> players, List<EventResultView> results, List<Integer> winners, boolean finished) {}

    private final List<String> nicknames;
    private final boolean[] active;
    private final boolean[] submitted;
    private final boolean[] ready;
    private final Integer[] marks;
    private final Integer[] progress;
    private final int[] gold;
    private final int[] silver;
    private final int[] bronze;
    private final List<Event> events = new ArrayList<>();
    private final List<EventResultView> results = new ArrayList<>();
    private final List<String> announcements = new ArrayList<>();
    private final List<Integer> winners = new ArrayList<>();
    private Phase phase = Phase.SELECT;
    private int eventIndex;

    public OlympicGame(List<String> nicknames) {
        if (nicknames.isEmpty() || nicknames.size() > 4) throw new IllegalArgumentException("올림픽은 1~4명이 합니다.");
        this.nicknames = List.copyOf(nicknames);
        int count = nicknames.size();
        active = new boolean[count];
        Arrays.fill(active, true);
        submitted = new boolean[count];
        ready = new boolean[count];
        marks = new Integer[count];
        progress = new Integer[count];
        gold = new int[count];
        silver = new int[count];
        bronze = new int[count];
        announcements.add("올림픽 개막! " + nicknames.get(0) + " 님이 이번 대회 종목을 고릅니다.");
    }

    @Override
    public void act(int seat, GameAction action) {
        if (phase == Phase.END || seat < 0 || seat >= nicknames.size() || !active[seat]) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
        switch (action.actionName()) {
            case "SELECT" -> select(seat, action.numbers());
            case "RESULT" -> submit(seat, action.number());
            case "PROGRESS" -> progress(seat, action.number());
            case "NEXT" -> next(seat);
            default -> throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        }
    }

    private void select(int seat, List<Integer> numbers) {
        if (phase != Phase.SELECT) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "종목은 대회 처음에만 고를 수 있습니다.");
        if (seat != 0) throw new BusinessException(ErrorCode.ONLINE_NOT_YOUR_TURN, "종목은 1번 선수가 고릅니다.");
        Event[] all = Event.values();
        if (numbers == null || numbers.isEmpty() || numbers.size() > all.length) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "종목을 1개 이상 골라 주세요.");
        boolean[] chosen = new boolean[all.length];
        for (Integer number : numbers) {
            if (number == null || number < 0 || number >= all.length || chosen[number]) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "알 수 없는 종목입니다.");
            chosen[number] = true;
        }
        for (int index = 0; index < all.length; index++) if (chosen[index]) events.add(all[index]);
        announcements.add("종목: " + String.join(" → ", events.stream().map(Event::label).toList()));
        startEvent(0);
    }

    private void startEvent(int index) {
        eventIndex = index;
        phase = Phase.EVENT;
        Arrays.fill(submitted, false);
        Arrays.fill(ready, false);
        Arrays.fill(marks, null);
        Arrays.fill(progress, null);
        announcements.add((index + 1) + "번째 종목: " + events.get(index).label() + " — 준비되면 시작!");
    }

    private void submit(int seat, Integer mark) {
        if (phase != Phase.EVENT) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "지금은 기록을 낼 때가 아닙니다.");
        if (submitted[seat]) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "이미 기록을 냈습니다.");
        Event event = events.get(eventIndex);
        if (mark == null || (mark != -1 && (mark < event.min || mark > event.max))) {
            throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "받을 수 없는 기록입니다.");
        }
        submitted[seat] = true;
        marks[seat] = mark == -1 ? null : mark;
        announcements.add(nicknames.get(seat) + " — " + event.label() + " " + event.format(marks[seat]));
        finishEventIfReady();
    }

    private void progress(int seat, Integer centimeters) {
        Event event = phase == Phase.EVENT ? events.get(eventIndex) : null;
        if (event == null || !event.timed || submitted[seat]) return; // 늦게 온 진행 알림은 조용히 버린다
        if (centimeters == null || centimeters < 0 || centimeters > 11_000) throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        progress[seat] = centimeters;
    }

    private void finishEventIfReady() {
        for (int seat = 0; seat < nicknames.size(); seat++) if (active[seat] && !submitted[seat]) return;
        Event event = events.get(eventIndex);
        List<String> medals = new ArrayList<>();
        for (int seat = 0; seat < nicknames.size(); seat++) medals.add(null);
        if (nicknames.size() == 1) {
            medals.set(0, event.medalByStandard(marks[0]));
        } else {
            // 순위: 나보다 좋은 기록을 낸 사람 수 + 1 (같은 기록은 같은 순위)
            for (int seat = 0; seat < nicknames.size(); seat++) {
                if (marks[seat] == null || !active[seat]) continue;
                int rank = 1;
                for (int other = 0; other < nicknames.size(); other++) {
                    if (marks[other] != null && active[other] && event.better(marks[other], marks[seat])) rank++;
                }
                medals.set(seat, rank == 1 ? "GOLD" : rank == 2 ? "SILVER" : rank == 3 ? "BRONZE" : null);
            }
        }
        List<String> lines = new ArrayList<>();
        for (int seat = 0; seat < nicknames.size(); seat++) {
            String medal = medals.get(seat);
            if ("GOLD".equals(medal)) gold[seat]++;
            if ("SILVER".equals(medal)) silver[seat]++;
            if ("BRONZE".equals(medal)) bronze[seat]++;
            if (medal != null) lines.add(("GOLD".equals(medal) ? "금 " : "SILVER".equals(medal) ? "은 " : "동 ") + nicknames.get(seat));
        }
        // List.copyOf는 null을 받지 않으므로(기록 없음·메달 없음 = null) 바꿀 수 없는 목록으로 감싼다
        results.add(new EventResultView(event.name(), Collections.unmodifiableList(Arrays.asList(marks.clone())), Collections.unmodifiableList(medals)));
        announcements.add(event.label() + " 결과: " + (lines.isEmpty() ? "메달 없음" : String.join(" · ", lines)));
        phase = Phase.RESULT;
    }

    private void next(int seat) {
        if (phase != Phase.RESULT) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "결과를 볼 때만 다음으로 넘어갈 수 있습니다.");
        ready[seat] = true;
        for (int index = 0; index < nicknames.size(); index++) if (active[index] && !ready[index]) return;
        if (eventIndex + 1 < events.size()) startEvent(eventIndex + 1);
        else finishGame();
    }

    private void finishGame() {
        phase = Phase.END;
        winners.clear();
        int[] best = null;
        for (int seat = 0; seat < nicknames.size(); seat++) {
            if (!active[seat]) continue;
            int[] score = {gold[seat], silver[seat], bronze[seat]};
            int compare = best == null ? 1 : Arrays.compare(score, best);
            if (compare > 0) {
                best = score;
                winners.clear();
            }
            if (compare >= 0) winners.add(seat);
        }
        // 혼자 했거나 메달이 하나도 없으면 "우승"이라 하지 않는다
        if (nicknames.size() == 1 || best == null || best[0] + best[1] + best[2] == 0) winners.clear();
    }

    @Override
    public void leave(int seat) {
        if (phase == Phase.END || seat < 0 || seat >= nicknames.size() || !active[seat]) return;
        active[seat] = false;
        announcements.add(nicknames.get(seat) + " 님이 대회에서 빠졌습니다.");
        boolean anyone = false;
        for (boolean stillActive : active) anyone |= stillActive;
        if (!anyone) {
            phase = Phase.END;
            winners.clear();
            return;
        }
        if (phase == Phase.SELECT && seat == 0) {
            // 고를 사람이 나가면 전 종목으로 바로 시작
            for (Event event : Event.values()) events.add(event);
            startEvent(0);
            return;
        }
        if (phase == Phase.EVENT) finishEventIfReady();
        else if (phase == Phase.RESULT) {
            ready[seat] = true;
            boolean allReady = true;
            for (int index = 0; index < nicknames.size(); index++) if (active[index] && !ready[index]) allReady = false;
            if (allReady) {
                if (eventIndex + 1 < events.size()) startEvent(eventIndex + 1);
                else finishGame();
            }
        }
    }

    @Override
    public boolean isFinished() {
        return phase == Phase.END;
    }

    @Override
    public List<Integer> winnerSeats() {
        return List.copyOf(winners);
    }

    @Override
    public String resultText() {
        List<String> lines = new ArrayList<>();
        for (int seat = 0; seat < nicknames.size(); seat++) {
            lines.add(nicknames.get(seat) + " 금" + gold[seat] + " 은" + silver[seat] + " 동" + bronze[seat]);
        }
        String champion = winners.isEmpty() ? "" : " — 우승 " + String.join(", ", winners.stream().map(nicknames::get).toList());
        return "올림픽 폐막: " + String.join(" · ", lines) + champion;
    }

    @Override
    public Object viewFor(Integer seat) {
        List<PlayerView> players = new ArrayList<>();
        for (int index = 0; index < nicknames.size(); index++) {
            players.add(new PlayerView(active[index], submitted[index], ready[index], progress[index], gold[index], silver[index], bronze[index]));
        }
        Integer mySeat = seat != null && seat >= 0 && seat < nicknames.size() ? seat : null;
        String current = phase == Phase.EVENT || phase == Phase.RESULT ? events.get(eventIndex).name() : null;
        return new View(mySeat, phase, events.stream().map(Event::name).toList(), eventIndex, current, players, List.copyOf(results),
            List.copyOf(winners), phase == Phase.END);
    }

    @Override
    public List<String> drainAnnouncements() {
        List<String> drained = List.copyOf(announcements);
        announcements.clear();
        return drained;
    }
}
