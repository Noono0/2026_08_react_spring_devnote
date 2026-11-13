package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/** 부루마블 학습용 규칙. 주사위·자산·매입·개발·승패는 서버에서만 계산한다. */
public class MarbleGame implements OnlineGame {
    public static final int ROUNDS = 20;
    public static final long TURN_MILLIS = 60_000;
    public record Tile(String name, String kind, int price, int rent) {}
    public static final List<Tile> TILES = List.of(
        special("출발", "START"), city("제주",16,5), city("부산",20,6), special("행운 카드","CHANCE"), city("도쿄",24,8),
        special("무인도","ISLAND"), city("방콕",22,7), city("시드니",28,9), special("행운 카드","CHANCE"), city("싱가포르",30,10),
        special("휴양지","BONUS"), city("로마",32,11), city("파리",34,12), special("행운 카드","CHANCE"), city("런던",36,13),
        special("세금","TAX"), city("뉴욕",38,14), city("서울",40,16), special("행운 카드","CHANCE"), city("두바이",36,13));
    public record PlayerView(String name, boolean computer, int cash, int position, boolean skip, boolean bankrupt) {}
    public record PropertyView(Integer owner, int level) {}
    public record View(Integer mySeat, List<PlayerView> players, List<PropertyView> properties, int turn, int turnsPlayed,
        String phase, List<Integer> dice, List<Integer> winners, List<String> log, Long deadline) {}
    private static final class Player {
        final String name;
        int cash = 150;
        int position;
        boolean skip;
        boolean bankrupt;
        Player(String name) { this.name = name; }
    }
    private final List<Player> players;
    private final int[] owners = new int[TILES.size()];
    private final int[] levels = new int[TILES.size()];
    private final Random random;
    private final List<String> log = new ArrayList<>();
    private final List<String> announcements = new ArrayList<>();
    private List<Integer> winners = List.of();
    private List<Integer> dice;
    private String phase = "ROLL";
    private int turn;
    private int turnsPlayed;
    private Long deadline;

    public MarbleGame(List<String> nicknames, Random random) {
        if (nicknames.size() < 2 || nicknames.size() > 4) throw new IllegalArgumentException("부루마블은 2~4명이 합니다.");
        this.players = nicknames.stream().map(Player::new).toList();
        this.random = random;
        java.util.Arrays.fill(owners, -1);
        say("각자 150만원으로 출발합니다. 출발을 지나면 30만원을 받습니다.");
    }
    private static Tile city(String name, int price, int rent) { return new Tile(name,"CITY",price,rent); }
    private static Tile special(String name, String kind) { return new Tile(name,kind,0,0); }
    private void invalid(String text) { throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, text); }
    private void say(String text) { log.add(text); if (log.size() > 7) log.removeFirst(); announcements.add(text); }

    @Override public void act(int seat, GameAction action) {
        if (isFinished() || seat < 0 || seat >= players.size() || players.get(seat).bankrupt) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
        if (seat != turn) throw new BusinessException(ErrorCode.ONLINE_NOT_YOUR_TURN);
        Player player = players.get(seat);
        Tile tile = TILES.get(player.position);
        switch (action.actionName()) {
            case "ROLL" -> { if (!phase.equals("ROLL")) invalid("이미 주사위를 굴렸습니다."); roll(); }
            case "BUY" -> {
                if (!phase.equals("DECIDE") || !tile.kind().equals("CITY") || owners[player.position] != -1 || player.cash < tile.price()) invalid("매입할 수 없는 땅입니다.");
                player.cash -= tile.price(); owners[player.position] = seat; phase = "END";
                say(player.name + ": " + tile.name() + "을 " + tile.price() + "만원에 샀습니다.");
            }
            case "UPGRADE" -> {
                if (!phase.equals("DECIDE") || owners[player.position] != seat || levels[player.position] >= 3 || player.cash < tile.price()/2) invalid("개발할 수 없는 땅입니다.");
                player.cash -= tile.price()/2; levels[player.position]++; phase = "END";
                say(player.name + ": " + tile.name() + "을 " + levels[player.position] + "단계로 개발했습니다.");
            }
            case "SELL" -> {
                Integer index = action.number();
                if (phase.equals("DECIDE") || index == null || index < 0 || index >= TILES.size() || owners[index] != seat) invalid("지금 매각할 수 없는 땅입니다.");
                sell(seat, index);
            }
            case "END" -> { if (phase.equals("ROLL")) invalid("주사위를 먼저 굴려 주세요."); endTurn(); }
            default -> throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        }
    }

    private void roll() {
        Player player = players.get(turn);
        phase = "END";
        if (player.skip) { player.skip = false; say(player.name + ": 무인도에서 한 차례 쉽니다."); return; }
        dice = List.of(random.nextInt(6)+1, random.nextInt(6)+1);
        int next = player.position + dice.get(0) + dice.get(1);
        if (next >= TILES.size()) { player.cash += 30; say(player.name + ": 출발 통과! 30만원을 받았습니다."); }
        player.position = next % TILES.size();
        int index = player.position;
        Tile tile = TILES.get(index);
        say(player.name + ": 주사위 " + dice.get(0) + " + " + dice.get(1) + " → " + tile.name());
        switch (tile.kind()) {
            case "CITY" -> {
                if (owners[index] == -1 || (owners[index] == turn && levels[index] < 3)) phase = "DECIDE";
                else if (owners[index] != turn) { int rent = tile.rent()*(levels[index]+1); say(player.name + ": 통행료 " + rent + "만원이 청구되었습니다."); pay(turn,rent,owners[index]); }
            }
            case "ISLAND" -> { player.skip = true; say(player.name + ": 다음 한 차례는 무인도에서 쉽니다."); }
            case "BONUS" -> { player.cash += 20; say(player.name + ": 휴양지 보너스 20만원!"); }
            case "TAX" -> { say(player.name + ": 세금 20만원이 청구되었습니다."); pay(turn,20,-1); }
            case "CHANCE" -> {
                if (random.nextBoolean()) { player.cash += 20; say(player.name + ": 행운의 보너스 20만원!"); }
                else { say(player.name + ": 수리비 15만원이 청구되었습니다."); pay(turn,15,-1); }
            }
            default -> { }
        }
        if (player.bankrupt) endTurn();
    }

    private int propertyValue(int index) { return TILES.get(index).price() + TILES.get(index).price()/2*levels[index]; }
    private int assets(int seat) { int total = players.get(seat).cash; for (int i=0;i<owners.length;i++) if (owners[i]==seat) total += propertyValue(i); return total; }
    private void sell(int seat, int index) { players.get(seat).cash += propertyValue(index)/2; owners[index]=-1; levels[index]=0; say(players.get(seat).name + ": " + TILES.get(index).name() + "을 반값에 매각했습니다."); }
    private void pay(int seat, int amount, int receiver) {
        Player player = players.get(seat);
        for (int index=0;index<owners.length && player.cash<amount;index++) if (owners[index]==seat) sell(seat,index);
        int paid = Math.min(player.cash,amount); player.cash -= paid;
        if (receiver>=0) players.get(receiver).cash += paid;
        if (paid<amount) { player.bankrupt=true; say(player.name + ": 납부금이 부족해 파산했습니다."); }
    }
    private long aliveCount() { return players.stream().filter(player -> !player.bankrupt).count(); }
    private void finish() {
        int best = -1;
        for (int seat=0;seat<players.size();seat++) if (!players.get(seat).bankrupt) best=Math.max(best,assets(seat));
        var result = new ArrayList<Integer>();
        for (int seat=0;seat<players.size();seat++) if (!players.get(seat).bankrupt && assets(seat)==best) result.add(seat);
        winners=List.copyOf(result); phase="OVER"; deadline=null; say(resultText());
    }
    private void endTurn() {
        turnsPlayed++; deadline=null;
        if (aliveCount()<=1 || turnsPlayed>=ROUNDS*players.size()) { finish(); return; }
        for (int offset=1;offset<=players.size();offset++) { int next=(turn+offset)%players.size(); if (!players.get(next).bankrupt) { turn=next; phase="ROLL"; dice=null; return; } }
    }
    @Override public boolean tick(long nowMillis) {
        if (isFinished()) return false;
        if (deadline==null) { deadline=nowMillis+TURN_MILLIS; return true; }
        if (nowMillis<deadline) return false;
        int oldTurn=turn;
        say(players.get(turn).name + ": 차례 시간 초과. 자동으로 진행합니다.");
        if (phase.equals("ROLL")) roll();
        if (!isFinished() && turn==oldTurn) endTurn();
        return true;
    }
    @Override public void leave(int seat) {
        if (isFinished() || seat<0 || seat>=players.size() || players.get(seat).bankrupt) return;
        players.get(seat).bankrupt=true; players.get(seat).cash=0;
        for (int i=0;i<owners.length;i++) if (owners[i]==seat) { owners[i]=-1; levels[i]=0; }
        say(players.get(seat).name + ": 기권했습니다.");
        if (aliveCount()<=1) finish(); else if (seat==turn) endTurn();
    }
    @Override public boolean isFinished() { return phase.equals("OVER"); }
    @Override public List<Integer> winnerSeats() { return winners; }
    @Override public String resultText() { return winners.isEmpty() ? "부루마블 무승부" : "부루마블 " + String.join(" · ",winners.stream().map(seat -> players.get(seat).name).toList()) + " 승리"; }
    @Override public Object viewFor(Integer seat) {
        var propertyViews = new ArrayList<PropertyView>(); for (int i=0;i<owners.length;i++) propertyViews.add(new PropertyView(owners[i]<0?null:owners[i],levels[i]));
        return new View(seat,players.stream().map(player -> new PlayerView(player.name,false,player.cash,player.position,player.skip,player.bankrupt)).toList(),
            List.copyOf(propertyViews),turn,turnsPlayed,phase,dice,winners,List.copyOf(log),deadline);
    }
    @Override public List<String> drainAnnouncements() { var values=List.copyOf(announcements); announcements.clear(); return values; }
}
