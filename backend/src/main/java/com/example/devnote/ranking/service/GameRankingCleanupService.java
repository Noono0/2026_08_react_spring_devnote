package com.example.devnote.ranking.service;

import com.example.devnote.ranking.dao.GameRankingDao;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

/**
 * 1주일이 지난 비회원 게임 기록을 지웁니다(회원 기록은 계속 남는다).
 * 1시간마다 돌기 때문에 기록은 7일 ~ 7일 1시간 사이에 사라진다(DevNoteApplication의 @EnableScheduling).
 */
@Slf4j
@Service
public class GameRankingCleanupService {
    static final Duration GUEST_RECORD_RETENTION = Duration.ofDays(7);

    private final GameRankingDao gameRankingDao;
    private final Clock clock;

    @Autowired
    public GameRankingCleanupService(GameRankingDao gameRankingDao) {
        this(gameRankingDao, Clock.systemUTC());
    }

    /** 테스트에서 시간을 고정할 때 쓰는 생성자 */
    GameRankingCleanupService(GameRankingDao gameRankingDao, Clock clock) {
        this.gameRankingDao = gameRankingDao;
        this.clock = clock;
    }

    @Scheduled(cron = "0 0 * * * *")
    public void cleanUpOnSchedule() {
        int deletedCount = deleteExpiredGuestRecords();
        if (deletedCount > 0) log.info("1주일 지난 비회원 게임 기록 정리 삭제={}", deletedCount);
    }

    public int deleteExpiredGuestRecords() {
        LocalDateTime cutoff = LocalDateTime.ofInstant(clock.instant().minus(GUEST_RECORD_RETENTION), ZoneOffset.UTC);
        return gameRankingDao.deleteGuestOnlineResultsBefore(cutoff) + gameRankingDao.deleteGuestSoloRecordsBefore(cutoff);
    }
}
