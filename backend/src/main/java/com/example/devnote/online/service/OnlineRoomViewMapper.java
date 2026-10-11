package com.example.devnote.online.service;

import com.example.devnote.online.domain.OmokGame;
import com.example.devnote.online.domain.OnlineChatMessage;
import com.example.devnote.online.domain.OnlineParticipant;
import com.example.devnote.online.domain.OnlineRoom;
import com.example.devnote.online.domain.TetrisBattle;
import com.example.devnote.online.dto.OmokView;
import com.example.devnote.online.dto.OnlineChatView;
import com.example.devnote.online.dto.OnlineParticipantView;
import com.example.devnote.online.dto.OnlineRoomSummaryResponse;
import com.example.devnote.online.dto.OnlineRoomView;
import com.example.devnote.online.dto.TetrisBattleView;

import java.util.List;
import java.util.stream.IntStream;

/**
 * 방(도메인) → 화면용 DTO로 바꾸는 함수 모음. 바꾸는 중에 방 상태가 바뀌지 않도록 방을 잠근 상태에서 부른다.
 * 비밀번호·회원 번호·연결 번호 같은 내부 값은 여기서 걸러져 밖으로 나가지 않는다.
 */
final class OnlineRoomViewMapper {
    private OnlineRoomViewMapper() {}

    static OnlineRoomView toView(OnlineRoom room, String myParticipantId) {
        List<OnlineParticipantView> participants = room.getParticipants().stream()
            .map(participant -> toParticipantView(room, participant))
            .toList();
        return new OnlineRoomView(
            room.getRoomId(),
            room.getTitle(),
            room.getGameType().name(),
            room.getGameType().getLabel(),
            room.getSeatCount(),
            OnlineRoom.MAX_PARTICIPANTS,
            room.hasPassword(),
            room.isMembersOnly(),
            room.getStatus().name(),
            room.getHostId(),
            myParticipantId,
            room.getSeats(),
            participants,
            toOmokView(room.getOmokGame()),
            toTetrisView(room.getTetrisBattle()),
            room.getLastResult()
        );
    }

    static OnlineRoomSummaryResponse toSummary(OnlineRoom room) {
        String hostNickname = room.getParticipants().stream()
            .filter(participant -> room.isHost(participant.getParticipantId()))
            .map(OnlineParticipant::getNickname)
            .findFirst()
            .orElse(null);
        return new OnlineRoomSummaryResponse(
            room.getRoomId(),
            room.getTitle(),
            room.getGameType().name(),
            room.getGameType().getLabel(),
            room.getSeatCount(),
            room.countPlayers(),
            room.getParticipants().size(),
            OnlineRoom.MAX_PARTICIPANTS,
            room.getStatus().name(),
            room.hasPassword(),
            room.isMembersOnly(),
            hostNickname
        );
    }

    static List<OnlineChatView> toChatViews(List<OnlineChatMessage> messages) {
        return messages.stream()
            .map(message -> new OnlineChatView(message.chatId(), message.nickname(), message.text(), message.sentAt(), message.system(), message.spectator()))
            .toList();
    }

    private static OnlineParticipantView toParticipantView(OnlineRoom room, OnlineParticipant participant) {
        int seat = room.seatOf(participant.getParticipantId());
        return new OnlineParticipantView(participant.getParticipantId(), participant.getNickname(), participant.isMember(), seat >= 0 ? seat : null);
    }

    private static TetrisBattleView toTetrisView(TetrisBattle battle) {
        if (battle == null) return null;
        List<TetrisBattleView.TetrisPlayerView> players = IntStream.range(0, battle.getPlayerCount())
            .mapToObj(seat -> new TetrisBattleView.TetrisPlayerView(
                seat, battle.getNicknames().get(seat), battle.isAlive(seat), battle.scoreOf(seat), battle.linesOf(seat), battle.boardOf(seat), battle.rankOf(seat)))
            .toList();
        return new TetrisBattleView(battle.getSeed(), battle.getWinnerSeat(), players);
    }

    private static OmokView toOmokView(OmokGame game) {
        if (game == null) return null;
        OmokView.OmokPositionView lastMove = game.getLastMove() == null ? null
            : new OmokView.OmokPositionView(game.getLastMove().row(), game.getLastMove().col());
        List<OmokView.OmokPositionView> winLine = game.getWinLine().stream()
            .map(position -> new OmokView.OmokPositionView(position.row(), position.col()))
            .toList();
        return new OmokView(game.copyBoard(), game.getTurnSeat(), game.getWinnerSeat(), game.isDraw(), lastMove, winLine);
    }
}
