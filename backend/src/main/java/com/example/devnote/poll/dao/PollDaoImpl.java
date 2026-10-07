package com.example.devnote.poll.dao;

import com.example.devnote.poll.dao.parameter.PollBallotParameter;
import com.example.devnote.poll.dao.parameter.PollCreateParameter;
import com.example.devnote.poll.dao.row.PollOptionRow;
import com.example.devnote.poll.dao.row.PollRow;
import com.example.devnote.poll.dto.PollSearchCondition;
import lombok.RequiredArgsConstructor;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** PollDao의 MyBatis 구현. PollMapper.xml의 같은 id SQL을 실행한다. */
@Repository
@RequiredArgsConstructor
public class PollDaoImpl implements PollDao {
    private static final String NAMESPACE = "com.example.devnote.poll.PollMapper.";
    private final SqlSessionTemplate sqlSessionTemplate;

    @Override public List<PollRow> selectPolls(PollSearchCondition condition) { return sqlSessionTemplate.selectList(NAMESPACE + "selectPolls", condition); }
    @Override public long countPolls(PollSearchCondition condition) { return sqlSessionTemplate.selectOne(NAMESPACE + "countPolls", condition); }
    @Override public PollRow selectPoll(Long pollId) { return sqlSessionTemplate.selectOne(NAMESPACE + "selectPoll", pollId); }
    @Override public PollRow selectPollForUpdate(Long pollId) { return sqlSessionTemplate.selectOne(NAMESPACE + "selectPollForUpdate", pollId); }
    @Override public List<PollOptionRow> selectPollOptions(Long pollId) { return sqlSessionTemplate.selectList(NAMESPACE + "selectPollOptions", pollId); }
    @Override public int countPollOptions(Long pollId, List<Long> pollOptionIds) { return sqlSessionTemplate.selectOne(NAMESPACE + "countPollOptions", Map.of("pollId", pollId, "pollOptionIds", pollOptionIds)); }
    // <Integer>selectOne: 결과 타입을 명시해 COUNT(*) 값을 Integer로 받고, 0보다 크면 이미 투표한 것으로 본다.
    @Override public boolean existsVote(Long pollId, String visitorKey, Long memberId) { return sqlSessionTemplate.<Integer>selectOne(NAMESPACE + "countVote", participantParameters(pollId, visitorKey, memberId)) > 0; }
    @Override public List<Long> selectVotedOptionIds(Long pollId, String visitorKey, Long memberId) { return sqlSessionTemplate.selectList(NAMESPACE + "selectVotedOptionIds", participantParameters(pollId, visitorKey, memberId)); }
    @Override public long countPollBallots(Long pollId) { return sqlSessionTemplate.selectOne(NAMESPACE + "countPollBallots", pollId); }
    @Override public void insertPollBallot(PollBallotParameter parameter) { sqlSessionTemplate.insert(NAMESPACE + "insertPollBallot", parameter); }
    @Override public void insertPollBallotSelection(Long pollBallotId, Long pollOptionId) { sqlSessionTemplate.insert(NAMESPACE + "insertPollBallotSelection", Map.of("pollBallotId", pollBallotId, "pollOptionId", pollOptionId)); }
    @Override public void insertPoll(PollCreateParameter parameter) { sqlSessionTemplate.insert(NAMESPACE + "insertPoll", parameter); }
    @Override public void insertPollOption(Long pollId, String optionLabel, int sortOrder) { sqlSessionTemplate.insert(NAMESPACE + "insertPollOption", Map.of("pollId", pollId, "optionLabel", optionLabel, "sortOrder", sortOrder)); }
    @Override public int deletePollOptions(Long pollId) { return sqlSessionTemplate.delete(NAMESPACE + "deletePollOptions", pollId); }
    @Override public int updatePollDefinition(PollCreateParameter parameter) { return sqlSessionTemplate.update(NAMESPACE + "updatePollDefinition", parameter); }
    @Override public int updatePollStatus(Long pollId, String status) { return sqlSessionTemplate.update(NAMESPACE + "updatePollStatus", Map.of("pollId", pollId, "status", status)); }
    @Override public int softDeletePoll(Long pollId, Long deletedBy) { return sqlSessionTemplate.update(NAMESPACE + "softDeletePoll", Map.of("pollId", pollId, "deletedBy", deletedBy)); }

    /** 비회원이면 memberId가 null이라 Map.of 대신 HashMap을 쓴다(Map.of는 null 값을 허용하지 않는다). */
    private Map<String, Object> participantParameters(Long pollId, String visitorKey, Long memberId) {
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("pollId", pollId);
        parameters.put("visitorKey", visitorKey);
        parameters.put("memberId", memberId);
        return parameters;
    }
}
