package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;

/** 모두 같은 미로에서 먼저 탈출하기. 이동·벽 충돌·승패는 서버가 검사한다. */
public class MazeGame implements OnlineGame {
    public static final long TIME_LIMIT_MILLIS=300_000;
    public record Point(int row,int col) {}
    public record View(List<String> walls, int size, Point start, Point exit, List<Point> positions, List<Integer> moves,
        List<Boolean> active, List<Integer> winnerSeats, Long deadline, boolean finished) {}
    private final List<String> nicknames;
    private final boolean[][] walls;
    private final Point[] positions;
    private final int[] moves;
    private final boolean[] active;
    private final List<String> announcements=new ArrayList<>();
    private List<Integer> winners=List.of();
    private Long deadline;
    private boolean finished;

    public MazeGame(List<String> nicknames, Random random, String difficulty) {
        if (nicknames.size()<2 || nicknames.size()>4) throw new IllegalArgumentException("미로 대전은 2~4명이 합니다.");
        this.nicknames=List.copyOf(nicknames);
        int size=switch(difficulty) { case "EASY"->11; case "HARD"->23; default->17; };
        walls=createMaze(size,random); positions=new Point[nicknames.size()]; Arrays.fill(positions,new Point(1,1));
        moves=new int[nicknames.size()]; active=new boolean[nicknames.size()]; Arrays.fill(active,true);
    }
    private static boolean[][] createMaze(int size, Random random) {
        boolean[][] board=new boolean[size][size]; for (var row:board) Arrays.fill(row,true);
        var stack=new ArrayList<Point>(); stack.add(new Point(1,1)); board[1][1]=false;
        int[][] directions={{-2,0},{2,0},{0,-2},{0,2}};
        while(!stack.isEmpty()) {
            Point current=stack.getLast(); var choices=new ArrayList<Point>();
            for(var direction:directions) { int row=current.row()+direction[0],col=current.col()+direction[1]; if(row>0 && row<size-1 && col>0 && col<size-1 && board[row][col]) choices.add(new Point(row,col)); }
            if(choices.isEmpty()) { stack.removeLast(); continue; }
            Point next=choices.get(random.nextInt(choices.size())); board[(current.row()+next.row())/2][(current.col()+next.col())/2]=false; board[next.row()][next.col()]=false; stack.add(next);
        }
        return board;
    }
    @Override public void act(int seat,GameAction action) {
        if(finished || seat<0 || seat>=active.length || !active[seat]) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
        if(!action.actionName().equals("MOVE")) throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        int dr=0,dc=0;
        switch(action.text()==null?"":action.text()) { case "UP"->dr=-1; case "DOWN"->dr=1; case "LEFT"->dc=-1; case "RIGHT"->dc=1; default->throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID,"올바른 이동 방향을 선택해 주세요."); }
        Point previous=positions[seat]; int row=previous.row()+dr,col=previous.col()+dc;
        if(row<0 || row>=walls.length || col<0 || col>=walls.length || walls[row][col]) return;
        positions[seat]=new Point(row,col); moves[seat]++;
        if(row==walls.length-2 && col==walls.length-2) { finished=true; winners=List.of(seat); deadline=null; announcements.add(nicknames.get(seat)+" 님이 먼저 미로를 탈출했습니다!"); }
    }
    @Override public boolean tick(long nowMillis) {
        if(finished) return false;
        if(deadline==null) { deadline=nowMillis+TIME_LIMIT_MILLIS; return true; }
        if(nowMillis<deadline) return false;
        finished=true; deadline=null; announcements.add("미로 제한 시간 종료. 탈출한 사람이 없어 무승부입니다."); return true;
    }
    @Override public void leave(int seat) {
        if(finished || seat<0 || seat>=active.length || !active[seat]) return;
        active[seat]=false; var left=new ArrayList<Integer>(); for(int i=0;i<active.length;i++) if(active[i]) left.add(i);
        if(left.size()<=1) { winners=List.copyOf(left); finished=true; deadline=null; announcements.add(resultText()); }
    }
    @Override public boolean isFinished() { return finished; }
    @Override public List<Integer> winnerSeats() { return winners; }
    @Override public String resultText() { return winners.isEmpty()?"미로게임 무승부":"미로게임 "+nicknames.get(winners.getFirst())+" 승리"; }
    @Override public Object viewFor(Integer seat) {
        var rows=new ArrayList<String>(); for(var row:walls) { var line=new StringBuilder(); for(boolean wall:row) line.append(wall?'1':'0'); rows.add(line.toString()); }
        var activeList=new ArrayList<Boolean>(); for(boolean value:active) activeList.add(value);
        return new View(List.copyOf(rows),walls.length,new Point(1,1),new Point(walls.length-2,walls.length-2),List.copyOf(Arrays.asList(positions)),Arrays.stream(moves).boxed().toList(),List.copyOf(activeList),winners,deadline,finished);
    }
    @Override public List<String> drainAnnouncements() { var values=List.copyOf(announcements); announcements.clear(); return values; }
}
