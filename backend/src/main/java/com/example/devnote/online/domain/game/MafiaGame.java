package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * 마피아(4~8명). 서버가 직업을 몰래 나눠 주고, 밤·낮을 번갈아 진행한다.
 *
 * [직업] 마피아(6명 이상이면 2명), 경찰 1명, 의사 1명(5명 이상), 나머지 시민
 * [밤]  마피아는 죽일 사람, 의사는 살릴 사람, 경찰은 조사할 사람을 고른다(TARGET).
 *       살아 있는 직업 가진 사람이 모두 고르면 밤이 끝난다. 의사가 고른 사람과 같으면 아무도 죽지 않는다.
 *       마피아가 둘이고 고른 사람이 다르면 표가 많은 쪽, 같으면 앞자리 마피아의 선택을 따른다.
 *       경찰은 밤이 끝날 때 조사 결과(마피아인지 아닌지)를 혼자 받는다.
 * [낮]  살아 있는 사람이 모두 투표(VOTE, 건너뛰기 가능)하면, 가장 많이 받은 한 명이 건너뛰기 표보다 많을 때만 처형된다.
 * [승리] 마피아가 모두 죽으면 시민 팀, 마피아 수가 나머지 이상이면 마피아 팀
 * [숨기기] 남의 직업은 끝날 때까지 보내지 않는다(마피아끼리만 서로 안다). 탈락한 사람은 채팅도 막는다(canChat).
 *
 * ★ 시간제한이 없는 학습용 버전이다. 오래 고르지 않는 사람이 있으면 채팅으로 재촉하거나, 나가면 탈락 처리된다.
 */
public class MafiaGame implements OnlineGame {
    public enum Role {
        MAFIA("마피아"), POLICE("경찰"), DOCTOR("의사"), CITIZEN("시민");

        private final String label;

        Role(String label) {
            this.label = label;
        }

        public String label() {
            return label;
        }
    }

    public enum Phase { NIGHT, DAY, END }

    /** role은 나에게 보여도 되는 경우만(내 것·동료 마피아·게임 끝). done은 낮 투표를 했는지(밤에는 직업이 드러나므로 항상 false) */
    public record PlayerView(boolean alive, String role, boolean done) {}

    public record Investigation(int seat, boolean mafia) {}

    public record View(Integer mySeat, String myRole, Phase phase, int round, List<PlayerView> players, Integer myChoice,
                       Map<Integer, Integer> mafiaChoices, List<Investigation> investigations, List<String> log,
                       String winnerTeam, boolean finished) {}

    private static final int SKIP = -1;

    private final List<String> nicknames;
    private final Role[] roles;
    private final boolean[] alive;
    /** 밤 선택 또는 낮 투표(SKIP = 건너뛰기). null = 아직 안 함 */
    private final Integer[] choices;
    private final Map<Integer, List<Investigation>> investigations = new LinkedHashMap<>();
    private final List<String> log = new ArrayList<>();
    private final List<String> announcements = new ArrayList<>();
    private Phase phase = Phase.NIGHT;
    private int round = 1;
    private String winnerTeam;

    public MafiaGame(List<String> nicknames, Random random) {
        if (nicknames.size() < 4 || nicknames.size() > 8) throw new IllegalArgumentException("마피아는 4~8명이 합니다.");
        this.nicknames = List.copyOf(nicknames);
        int count = nicknames.size();
        List<Role> deck = new ArrayList<>();
        for (int index = 0; index < (count >= 6 ? 2 : 1); index++) deck.add(Role.MAFIA);
        deck.add(Role.POLICE);
        if (count >= 5) deck.add(Role.DOCTOR);
        while (deck.size() < count) deck.add(Role.CITIZEN);
        Collections.shuffle(deck, random);
        roles = deck.toArray(new Role[0]);
        alive = new boolean[count];
        Arrays.fill(alive, true);
        choices = new Integer[count];
        say("게임 시작! 직업을 확인하세요. 마피아 " + countRole(Role.MAFIA) + "명이 숨어 있습니다. 1번째 밤이 되었습니다.");
    }

    /** 테스트용: 직업을 정해서 시작한다 */
    MafiaGame(List<String> nicknames, List<Role> fixedRoles) {
        this.nicknames = List.copyOf(nicknames);
        roles = fixedRoles.toArray(new Role[0]);
        alive = new boolean[roles.length];
        Arrays.fill(alive, true);
        choices = new Integer[roles.length];
    }

    private void say(String text) {
        announcements.add(text);
        log.add(text);
        if (log.size() > 30) log.remove(0);
    }

    private long countRole(Role role) {
        long count = 0;
        for (int seat = 0; seat < roles.length; seat++) if (alive[seat] && roles[seat] == role) count++;
        return count;
    }

    private boolean hasNightAction(int seat) {
        return alive[seat] && roles[seat] != Role.CITIZEN;
    }

    // ── 진행 ────────────────────────────────────────────────────

    @Override
    public void act(int seat, GameAction action) {
        if (phase == Phase.END || seat < 0 || seat >= roles.length) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
        if (!alive[seat]) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "탈락한 플레이어는 할 수 없습니다.");
        switch (action.actionName()) {
            case "TARGET" -> chooseAtNight(seat, action.number());
            case "VOTE" -> vote(seat, action.number());
            default -> throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        }
    }

    private void chooseAtNight(int seat, Integer target) {
        if (phase != Phase.NIGHT) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "밤에만 고를 수 있습니다.");
        if (!hasNightAction(seat)) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "시민은 밤에 할 일이 없습니다. 아침을 기다리세요.");
        if (target == null || target < 0 || target >= roles.length || !alive[target]) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "살아 있는 사람을 골라 주세요.");
        if (roles[seat] == Role.MAFIA && roles[target] == Role.MAFIA) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "마피아끼리는 고를 수 없습니다.");
        if (roles[seat] == Role.POLICE && target == seat) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "자기 자신은 조사할 수 없습니다.");
        choices[seat] = target;
        resolveIfReady();
    }

    private void vote(int seat, Integer target) {
        if (phase != Phase.DAY) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "낮에만 투표할 수 있습니다.");
        int chosen = target == null || target == SKIP ? SKIP : target;
        if (chosen != SKIP && (chosen < 0 || chosen >= roles.length || !alive[chosen] || chosen == seat)) {
            throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "나를 뺀 살아 있는 사람에게 투표해 주세요.");
        }
        choices[seat] = chosen;
        resolveIfReady();
    }

    /** 해야 할 사람이 모두 골랐으면 밤·낮을 마무리한다 */
    private void resolveIfReady() {
        if (phase == Phase.END) return;
        for (int seat = 0; seat < roles.length; seat++) {
            boolean needed = phase == Phase.NIGHT ? hasNightAction(seat) : alive[seat];
            if (needed && choices[seat] == null) return;
        }
        if (phase == Phase.NIGHT) resolveNight();
        else resolveDay();
    }

    private void resolveNight() {
        Integer killTarget = mafiaTarget();
        Integer saved = null;
        for (int seat = 0; seat < roles.length; seat++) {
            if (!alive[seat] || choices[seat] == null) continue;
            if (roles[seat] == Role.DOCTOR) saved = choices[seat];
            if (roles[seat] == Role.POLICE) {
                int target = choices[seat];
                investigations.computeIfAbsent(seat, key -> new ArrayList<>()).add(new Investigation(target, roles[target] == Role.MAFIA));
            }
        }
        Arrays.fill(choices, null);
        if (killTarget != null && !killTarget.equals(saved)) {
            alive[killTarget] = false;
            say("아침이 밝았습니다. 지난밤 " + nicknames.get(killTarget) + " 님이 마피아에게 당했습니다.");
        } else {
            say("아침이 밝았습니다. 지난밤에는 아무도 죽지 않았습니다.");
        }
        if (checkWinner()) return;
        phase = Phase.DAY;
        say(round + "번째 낮: 이야기를 나눈 뒤 마피아로 의심되는 사람에게 투표하세요.");
    }

    /** 살아 있는 마피아들의 선택 중 표가 가장 많은 사람. 같으면 앞자리 마피아의 선택 */
    private Integer mafiaTarget() {
        Map<Integer, Integer> tally = new LinkedHashMap<>();
        for (int seat = 0; seat < roles.length; seat++) {
            if (alive[seat] && roles[seat] == Role.MAFIA && choices[seat] != null) tally.merge(choices[seat], 1, Integer::sum);
        }
        Integer best = null;
        for (Map.Entry<Integer, Integer> entry : tally.entrySet()) if (best == null || entry.getValue() > tally.get(best)) best = entry.getKey();
        return best;
    }

    private void resolveDay() {
        Map<Integer, Integer> tally = new LinkedHashMap<>();
        int skips = 0;
        for (int seat = 0; seat < roles.length; seat++) {
            if (!alive[seat] || choices[seat] == null) continue;
            if (choices[seat] == SKIP) skips++;
            else tally.merge(choices[seat], 1, Integer::sum);
        }
        Arrays.fill(choices, null);
        int top = tally.values().stream().max(Integer::compare).orElse(0);
        List<Integer> leaders = tally.entrySet().stream().filter(entry -> entry.getValue() == top).map(Map.Entry::getKey).toList();
        List<String> parts = new ArrayList<>();
        tally.forEach((seat, votes) -> parts.add(nicknames.get(seat) + " " + votes + "표"));
        if (skips > 0) parts.add("건너뛰기 " + skips + "표");
        String summary = "투표 결과: " + String.join(", ", parts);
        if (leaders.size() == 1 && top > skips) {
            int executed = leaders.get(0);
            alive[executed] = false;
            say(summary + " → " + nicknames.get(executed) + " 님이 처형되었습니다.");
        } else {
            say(summary + " → 아무도 처형되지 않았습니다.");
        }
        if (checkWinner()) return;
        phase = Phase.NIGHT;
        round++;
        say(round + "번째 밤이 되었습니다. 직업이 있는 사람은 대상을 고르세요.");
    }

    private boolean checkWinner() {
        long mafia = countRole(Role.MAFIA);
        long others = 0;
        for (int seat = 0; seat < roles.length; seat++) if (alive[seat] && roles[seat] != Role.MAFIA) others++;
        if (mafia == 0) winnerTeam = "시민";
        else if (mafia >= others) winnerTeam = "마피아";
        else return false;
        phase = Phase.END;
        List<String> reveal = new ArrayList<>();
        for (int seat = 0; seat < roles.length; seat++) reveal.add(nicknames.get(seat) + "=" + roles[seat].label());
        say(winnerTeam + " 팀 승리! 직업 공개: " + String.join(", ", reveal));
        return true;
    }

    @Override
    public void leave(int seat) {
        if (phase == Phase.END || seat < 0 || seat >= roles.length || !alive[seat]) return;
        alive[seat] = false;
        choices[seat] = null;
        // 나간 사람에게 투표했던 표는 무효로 돌려 다시 고르게 한다
        for (int other = 0; other < roles.length; other++) if (choices[other] != null && choices[other] == seat) choices[other] = null;
        say(nicknames.get(seat) + " 님이 나가서 탈락했습니다.");
        if (!checkWinner()) resolveIfReady();
    }

    @Override
    public boolean isFinished() {
        return phase == Phase.END;
    }

    @Override
    public String resultText() {
        return "마피아 " + (winnerTeam == null ? "끝" : winnerTeam + " 팀 승리");
    }

    @Override
    public boolean canChat(int seat) {
        return phase == Phase.END || seat < 0 || seat >= alive.length || alive[seat];
    }

    @Override
    public Object viewFor(Integer seat) {
        boolean player = seat != null && seat >= 0 && seat < roles.length;
        boolean iAmMafia = player && roles[seat] == Role.MAFIA;
        List<PlayerView> players = new ArrayList<>();
        for (int index = 0; index < roles.length; index++) {
            boolean visible = phase == Phase.END || (player && index == seat) || (iAmMafia && roles[index] == Role.MAFIA);
            players.add(new PlayerView(alive[index], visible ? roles[index].name() : null, phase == Phase.DAY && alive[index] && choices[index] != null));
        }
        Map<Integer, Integer> mafiaChoices = new LinkedHashMap<>();
        if (iAmMafia && phase == Phase.NIGHT) {
            for (int index = 0; index < roles.length; index++) {
                if (roles[index] == Role.MAFIA && alive[index] && choices[index] != null) mafiaChoices.put(index, choices[index]);
            }
        }
        return new View(player ? seat : null, player ? roles[seat].name() : null, phase, round, players,
            player ? choices[seat] : null, mafiaChoices,
            player ? List.copyOf(investigations.getOrDefault(seat, List.of())) : List.of(),
            List.copyOf(log), winnerTeam, phase == Phase.END);
    }

    @Override
    public List<String> drainAnnouncements() {
        List<String> drained = List.copyOf(announcements);
        announcements.clear();
        return drained;
    }
}
