package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Random;

/**
 * 캐치마인드(그림 맞히기, 2~8명). 출제자가 제시어를 그림으로 그리고, 나머지가 맞힌다.
 *
 * [차례] 자리 순서대로 돌아가며 출제자가 된다. 한 사람당 rounds번(방 옵션) 그린다.
 * [그리기] 출제자만 DRAW(선 하나)·UNDO(마지막 선 지우기)·CLEAR(모두 지우기)를 보낼 수 있다.
 *   선은 1000×750 좌표로 받는다. 화면 크기가 사람마다 달라도 같은 그림이 되도록 "비율 좌표"를 쓰는 것이다.
 * [맞히기] 출제자가 아닌 사람이 GUESS로 답을 보낸다. 띄어쓰기는 무시한다.
 *   가장 먼저 맞힌 사람 +10점, 출제자 +5점, 바로 다음 차례로 넘어간다. 출제자는 PASS로 넘길 수 있다(점수 없음).
 * [숨기기] 제시어는 출제자에게만 보낸다(다른 사람은 글자 수만 안다). 출제자는 차례 동안 채팅도 막는다(canChat).
 *   채팅으로 정답을 알려 주는 반칙을 서버가 막는 것이다.
 *
 * ★ 마피아처럼 시간제한이 없는 학습용 버전이다. 아무도 못 맞히면 출제자가 넘기기(PASS)를 누른다.
 */
public class CatchMindGame implements OnlineGame {
    public static final int CANVAS_WIDTH = 1000;
    public static final int CANVAS_HEIGHT = 750;
    /** 화면의 색 버튼 수와 같아야 한다(catchMindRules.ts의 penColors) */
    public static final int COLOR_COUNT = 8;
    public static final int MIN_PEN_WIDTH = 2;
    public static final int MAX_PEN_WIDTH = 40;
    /** 선 하나의 최대 숫자 개수(색·굵기 2개 + 점 199개 × 2). WebSocket 메시지 8KB 안에 넉넉히 들어간다 */
    static final int MAX_NUMBERS_PER_STROKE = 400;
    /** 한 그림의 점 좌표 숫자 합계 상한. 그림 전체를 매번 모두에게 보내므로 너무 커지지 않게 막는다 */
    static final int MAX_POINT_NUMBERS_PER_DRAWING = 12_000;
    static final int GUESS_MAX_LENGTH = 20;
    private static final int GUESSER_POINTS = 10;
    private static final int DRAWER_POINTS = 5;

    /** 그리기 쉬운 명사 위주. 게임마다 섞어서 앞에서부터 꺼낸다 */
    static final List<String> WORDS = List.of(
        "사과", "바나나", "수박", "포도", "딸기", "당근", "고양이", "강아지", "토끼", "기린",
        "코끼리", "펭귄", "물고기", "나비", "거북이", "자동차", "자전거", "비행기", "기차", "배",
        "우산", "안경", "모자", "시계", "가방", "연필", "책", "의자", "침대", "냉장고",
        "컴퓨터", "휴대폰", "텔레비전", "카메라", "기타", "피아노", "축구공", "농구", "눈사람", "무지개",
        "해바라기", "나무", "산", "바다", "구름", "번개", "달", "별", "해", "집",
        "학교", "병원", "다리", "등대", "로켓", "로봇", "왕관", "케이크", "피자", "햄버거",
        "아이스크림", "라면", "김밥", "도넛", "커피", "달팽이", "문어", "상어", "고래", "공룡",
        "드래곤", "유령", "천사", "선물", "풍선", "촛불", "열쇠", "자물쇠", "망원경", "텐트"
    );

    public enum Phase { DRAWING, END }

    /** 선 하나: 색 번호, 굵기, 점 좌표 [x1, y1, x2, y2, ...] */
    public record Stroke(int color, int width, List<Integer> points) {}

    public record View(Integer mySeat, Phase phase, int drawerSeat, int turnNumber, int totalTurns, String word,
                       int wordLength, List<Stroke> strokes, List<Integer> scores, List<Boolean> active,
                       List<String> guesses, List<String> log, List<Integer> winnerSeats, boolean finished) {}

    private final List<String> nicknames;
    private final List<String> words;
    private final int[] scores;
    private final boolean[] active;
    private final int totalTurns;
    private final List<Stroke> strokes = new ArrayList<>();
    /** 이번 그림의 틀린 답(누가 무엇을 적었는지). 맞히는 데 힌트가 되므로 모두에게 보여 준다 */
    private final List<String> guesses = new ArrayList<>();
    private final List<String> log = new ArrayList<>();
    private final List<String> announcements = new ArrayList<>();
    private Phase phase = Phase.DRAWING;
    private int drawerSeat;
    private int turnNumber = 1;
    private int wordIndex;
    private int pointNumbersInDrawing;

    public CatchMindGame(List<String> nicknames, Random random, int rounds) {
        this(nicknames, shuffled(random), rounds);
    }

    /** 테스트용: 제시어 순서를 정해서 시작한다 */
    CatchMindGame(List<String> nicknames, List<String> words, int rounds) {
        if (nicknames.size() < 2 || nicknames.size() > 8) throw new IllegalArgumentException("캐치마인드는 2~8명이 합니다.");
        if (rounds < 1) throw new IllegalArgumentException("한 사람이 1번 이상 그려야 합니다.");
        this.nicknames = List.copyOf(nicknames);
        this.words = List.copyOf(words);
        this.scores = new int[nicknames.size()];
        this.active = new boolean[nicknames.size()];
        Arrays.fill(active, true);
        this.totalTurns = nicknames.size() * rounds;
        if (this.words.size() < totalTurns) throw new IllegalArgumentException("제시어가 모자랍니다.");
        say("캐치마인드 시작! 한 사람당 " + rounds + "번씩 그립니다. 첫 출제자는 " + nicknames.get(0) + " 님입니다.");
    }

    private static List<String> shuffled(Random random) {
        List<String> copy = new ArrayList<>(WORDS);
        Collections.shuffle(copy, random);
        return copy;
    }

    /** 한 사람당 그리는 횟수 옵션("1"·"2"·"3") → 숫자 */
    public static int roundsFor(String option) {
        return option == null ? 2 : Integer.parseInt(option);
    }

    private void say(String text) {
        announcements.add(text);
        log.add(text);
        if (log.size() > 20) log.remove(0);
    }

    private String currentWord() {
        return words.get(wordIndex);
    }

    // ── 진행 ─────────────────────────────────────────────────────────

    @Override
    public void act(int seat, GameAction action) {
        if (phase == Phase.END || seat < 0 || seat >= scores.length) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
        switch (action.actionName()) {
            case "DRAW" -> {
                requireDrawer(seat);
                draw(action.numbers());
            }
            case "UNDO" -> {
                requireDrawer(seat);
                if (!strokes.isEmpty()) {
                    Stroke removed = strokes.remove(strokes.size() - 1);
                    pointNumbersInDrawing -= removed.points().size();
                }
            }
            case "CLEAR" -> {
                requireDrawer(seat);
                clearDrawing();
            }
            case "PASS" -> {
                requireDrawer(seat);
                say(nicknames.get(seat) + " 님이 넘겼습니다. 정답은 '" + currentWord() + "'였습니다.");
                nextTurn();
            }
            case "GUESS" -> guess(seat, action.text());
            default -> throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        }
    }

    private void requireDrawer(int seat) {
        if (seat != drawerSeat) throw new BusinessException(ErrorCode.ONLINE_NOT_YOUR_TURN, "출제자만 그릴 수 있습니다.");
    }

    /** numbers = [색 번호, 굵기, x1, y1, x2, y2, ...]. 점은 1개(콕 찍기) 이상 */
    private void draw(List<Integer> numbers) {
        if (numbers == null || numbers.size() < 4 || numbers.size() > MAX_NUMBERS_PER_STROKE || numbers.size() % 2 != 0
            || numbers.stream().anyMatch(value -> value == null)) {
            throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        }
        int color = numbers.get(0);
        int width = numbers.get(1);
        if (color < 0 || color >= COLOR_COUNT || width < MIN_PEN_WIDTH || width > MAX_PEN_WIDTH) {
            throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "고를 수 없는 색이나 굵기입니다.");
        }
        List<Integer> points = numbers.subList(2, numbers.size());
        for (int index = 0; index < points.size(); index++) {
            int value = points.get(index);
            int limit = index % 2 == 0 ? CANVAS_WIDTH : CANVAS_HEIGHT;
            if (value < 0 || value > limit) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "그림판 밖의 점입니다.");
        }
        if (pointNumbersInDrawing + points.size() > MAX_POINT_NUMBERS_PER_DRAWING) {
            throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "그림이 너무 복잡합니다. 지우고 다시 그려 주세요.");
        }
        strokes.add(new Stroke(color, width, List.copyOf(points)));
        pointNumbersInDrawing += points.size();
    }

    private void guess(int seat, String text) {
        if (seat == drawerSeat) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "출제자는 답을 낼 수 없습니다.");
        if (!active[seat]) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "나간 플레이어는 답을 낼 수 없습니다.");
        String answer = text == null ? "" : text.strip();
        if (answer.isEmpty() || answer.length() > GUESS_MAX_LENGTH) {
            throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "답은 1~" + GUESS_MAX_LENGTH + "자로 입력해 주세요.");
        }
        // ★ "아이스 크림"과 "아이스크림"을 같은 답으로 본다. 비교 전에 공백을 모두 지운다.
        if (normalize(answer).equals(normalize(currentWord()))) {
            scores[seat] += GUESSER_POINTS;
            scores[drawerSeat] += DRAWER_POINTS;
            say(nicknames.get(seat) + " 님 정답! 정답은 '" + currentWord() + "' (+" + GUESSER_POINTS + "점, 출제자 +" + DRAWER_POINTS + "점)");
            nextTurn();
            return;
        }
        guesses.add(nicknames.get(seat) + ": " + answer);
        if (guesses.size() > 30) guesses.remove(0);
    }

    private static String normalize(String text) {
        return text.replaceAll("\\s+", "");
    }

    private void clearDrawing() {
        strokes.clear();
        pointNumbersInDrawing = 0;
    }

    /** 다음 그림으로. 남은 차례가 없거나 사람이 1명뿐이면 끝낸다 */
    private void nextTurn() {
        clearDrawing();
        guesses.clear();
        if (turnNumber >= totalTurns || activeCount() < 2) {
            finish();
            return;
        }
        turnNumber++;
        wordIndex++;
        do {
            drawerSeat = (drawerSeat + 1) % scores.length;
        } while (!active[drawerSeat]);
        say(turnNumber + "번째 그림: " + nicknames.get(drawerSeat) + " 님이 그립니다.");
    }

    private int activeCount() {
        int count = 0;
        for (boolean value : active) if (value) count++;
        return count;
    }

    private void finish() {
        phase = Phase.END;
        List<String> parts = new ArrayList<>();
        for (int seat = 0; seat < scores.length; seat++) parts.add(nicknames.get(seat) + " " + scores[seat] + "점");
        say("게임 끝! " + String.join(", ", parts));
    }

    @Override
    public void leave(int seat) {
        if (phase == Phase.END || seat < 0 || seat >= scores.length || !active[seat]) return;
        active[seat] = false;
        if (activeCount() < 2) {
            say(nicknames.get(seat) + " 님이 나갔습니다.");
            finish();
            return;
        }
        if (seat == drawerSeat) {
            say("출제자 " + nicknames.get(seat) + " 님이 나갔습니다. 정답은 '" + currentWord() + "'였습니다.");
            nextTurn();
        } else {
            say(nicknames.get(seat) + " 님이 나갔습니다.");
        }
    }

    @Override
    public boolean isFinished() {
        return phase == Phase.END;
    }

    /** 남아 있는 사람 중 최고 점수(공동 1위 가능). 아무도 점수를 못 얻었으면 무승부 */
    @Override
    public List<Integer> winnerSeats() {
        if (phase != Phase.END) return List.of();
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
        if (winners.isEmpty()) return "캐치마인드 무승부";
        List<String> names = winners.stream().map(nicknames::get).toList();
        return "캐치마인드 " + String.join(" · ", names) + (names.size() > 1 ? " 공동 승리" : " 승리");
    }

    /** 출제자는 차례 동안 채팅을 쓸 수 없다(정답을 채팅으로 알려 주지 못하게) */
    @Override
    public boolean canChat(int seat) {
        return phase == Phase.END || seat != drawerSeat;
    }

    @Override
    public Object viewFor(Integer seat) {
        boolean player = seat != null && seat >= 0 && seat < scores.length;
        boolean showWord = phase == Phase.DRAWING && player && seat == drawerSeat;
        List<Integer> scoreView = Arrays.stream(scores).boxed().toList();
        List<Boolean> activeView = new ArrayList<>();
        for (boolean value : active) activeView.add(value);
        return new View(player ? seat : null, phase, drawerSeat, turnNumber, totalTurns, showWord ? currentWord() : null,
            currentWord().length(), List.copyOf(strokes), scoreView, activeView, List.copyOf(guesses), List.copyOf(log),
            winnerSeats(), phase == Phase.END);
    }

    @Override
    public List<String> drainAnnouncements() {
        List<String> drained = List.copyOf(announcements);
        announcements.clear();
        return drained;
    }
}
