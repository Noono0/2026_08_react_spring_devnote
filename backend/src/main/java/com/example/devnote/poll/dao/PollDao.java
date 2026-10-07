package com.example.devnote.poll.dao;

import com.example.devnote.poll.dao.parameter.PollBallotParameter;
import com.example.devnote.poll.dao.parameter.PollCreateParameter;
import com.example.devnote.poll.dao.row.PollOptionRow;
import com.example.devnote.poll.dao.row.PollRow;
import com.example.devnote.poll.dto.PollSearchCondition;

import java.util.List;

/**
 * 투표 테이블 접근 약속.
 *   polls(질문) 1 ─ N poll_options(선택지)
 *   polls 1 ─ N poll_ballots(투표지: 누가 투표했나) 1 ─ N poll_ballot_selections(투표지에 고른 선택지)
 * 투표지와 선택을 나눠, 복수 선택 투표에서도 "참여자 수"와 "선택 수"를 따로 셀 수 있다.
 */
public interface PollDao {
    List<PollRow> selectPolls(PollSearchCondition condition);
    long countPolls(PollSearchCondition condition);
    PollRow selectPoll(Long pollId);
    // SELECT ... FOR UPDATE: 이 투표 행을 잠가, 같은 투표에 대한 동시 투표 요청을 한 줄로 세운다.
    PollRow selectPollForUpdate(Long pollId);
    List<PollOptionRow> selectPollOptions(Long pollId);
    // 요청한 선택지 번호들이 정말 이 투표의 선택지인지 센다(개수가 다르면 남의 선택지가 섞인 것).
    int countPollOptions(Long pollId, List<Long> pollOptionIds);
    // 같은 브라우저(visitorKey) 또는 같은 회원(memberId)이 이미 투표했는가.
    boolean existsVote(Long pollId, String visitorKey, Long memberId);
    List<Long> selectVotedOptionIds(Long pollId, String visitorKey, Long memberId);
    long countPollBallots(Long pollId);
    void insertPollBallot(PollBallotParameter parameter);
    void insertPollBallotSelection(Long pollBallotId, Long pollOptionId);
    void insertPoll(PollCreateParameter parameter);
    void insertPollOption(Long pollId, String optionLabel, int sortOrder);
    int deletePollOptions(Long pollId);
    int updatePollDefinition(PollCreateParameter parameter);
    int updatePollStatus(Long pollId, String status);
    int softDeletePoll(Long pollId, Long deletedBy);
}
