package com.example.devnote.poll.dao;

import com.example.devnote.poll.dao.parameter.PollBallotParameter;
import com.example.devnote.poll.dao.parameter.PollCreateParameter;
import com.example.devnote.poll.dao.row.PollOptionRow;
import com.example.devnote.poll.dao.row.PollRow;
import com.example.devnote.poll.dto.PollSearchCondition;

import java.util.List;

public interface PollDao {
    List<PollRow> selectPolls(PollSearchCondition condition);
    long countPolls(PollSearchCondition condition);
    PollRow selectPoll(Long pollId);
    PollRow selectPollForUpdate(Long pollId);
    List<PollOptionRow> selectPollOptions(Long pollId);
    int countPollOptions(Long pollId, List<Long> pollOptionIds);
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
