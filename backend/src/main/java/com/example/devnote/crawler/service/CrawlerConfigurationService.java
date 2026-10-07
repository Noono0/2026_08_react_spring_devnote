package com.example.devnote.crawler.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.crawler.dao.CrawlerConfigurationDao;
import com.example.devnote.crawler.dao.parameter.CrawlerConfigurationSaveParameter;
import com.example.devnote.crawler.dao.parameter.CrawlerRunHistoryCreateParameter;
import com.example.devnote.crawler.dao.row.CrawlerConfigurationRow;
import com.example.devnote.crawler.dao.row.CrawlerRunHistoryRow;
import com.example.devnote.crawler.dto.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

/**
 * 크롤러 설정 저장과 "저장된 설정으로 실행 + 이력 남기기"를 담당합니다.
 *
 * ★ 로그인 아이디·비밀번호는 DB에 저장하지 않는다(withoutCredentials). 설정·이력에는 빈 값으로 바꿔 넣고,
 *   실행할 때만 화면이 보낸 값을 그대로 엔진에 넘긴다.
 */
@Service
@RequiredArgsConstructor
public class CrawlerConfigurationService {
    private final CrawlerConfigurationDao crawlerConfigurationDao;
    private final CrawlerService crawlerService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<CrawlerConfigurationResponse> getConfigurations() {
        return crawlerConfigurationDao.selectConfigurations().stream().map(this::toConfigurationResponse).toList();
    }

    @Transactional(readOnly = true)
    public CrawlerConfigurationResponse getConfiguration(Long configurationId) {
        return toConfigurationResponse(requireConfiguration(configurationId));
    }

    @Transactional
    public CrawlerConfigurationResponse create(CrawlerConfigurationSaveRequest request) {
        CrawlerConfigurationSaveParameter parameter = toSaveParameter(null, request);
        crawlerConfigurationDao.insertConfiguration(parameter);
        return getConfiguration(parameter.getCrawlerConfigurationId());
    }

    @Transactional
    public CrawlerConfigurationResponse update(Long configurationId, CrawlerConfigurationSaveRequest request) {
        requireConfiguration(configurationId);
        if (crawlerConfigurationDao.updateConfiguration(toSaveParameter(configurationId, request)) == 0) {
            throw new BusinessException(ErrorCode.CRAWLER_CONFIGURATION_NOT_FOUND);
        }
        return getConfiguration(configurationId);
    }

    @Transactional
    public void delete(Long configurationId) {
        if (crawlerConfigurationDao.deleteConfiguration(configurationId) == 0) {
            throw new BusinessException(ErrorCode.CRAWLER_CONFIGURATION_NOT_FOUND);
        }
    }

    /**
     * 저장된 설정으로 실행하고 이력을 남긴다.
     * 이 메서드에는 @Transactional을 붙이지 않았다. 실행이 실패해도 "실패했다"는 이력은 남아야 하기 때문이다.
     * (트랜잭션으로 묶으면 예외가 났을 때 이력 INSERT까지 롤백되어 기록이 사라진다)
     * 크롤링은 수십 초 걸릴 수 있어, 그동안 DB 트랜잭션을 열어 두지 않는 효과도 있다.
     */
    public CrawlerTrackedRunResponse run(Long configurationId, CrawlerRunRequest request) {
        requireConfiguration(configurationId);
        CrawlerRunRequest safeRequest = withoutCredentials(request);
        CrawlerRunHistoryCreateParameter history = CrawlerRunHistoryCreateParameter.builder()
            .crawlerConfigurationId(configurationId)
            .requestJson(writeJson(safeRequest, "실행 요청을 이력으로 변환하지 못했습니다."))
            .build();
        crawlerConfigurationDao.insertRunHistory(history);
        long startedNanos = System.nanoTime();
        try {
            CrawlerRunResponse result = crawlerService.run(request);
            long durationMillis = elapsedMillis(startedNanos);
            crawlerConfigurationDao.completeRunHistorySuccess(
                history.getCrawlerRunHistoryId(),
                writeJson(result, "크롤링 결과를 이력으로 변환하지 못했습니다."),
                durationMillis,
                result.items().size()
            );
            return new CrawlerTrackedRunResponse(history.getCrawlerRunHistoryId(), result);
        // 실패 종류에 따라 "어느 단계에서" 실패했는지를 다르게 기록하고, 예외는 다시 던져 화면에도 알린다.
        // CrawlerFailure(크롤링 단계 실패) → 엔진이 알려 준 단계 이름 / BusinessException(설정 오류) / 그 밖의 예외(예상 못 한 오류)
        } catch (CrawlerFailure failure) {
            crawlerConfigurationDao.completeRunHistoryFailure(
                history.getCrawlerRunHistoryId(), failure.getStage(), failure.getMessage(), elapsedMillis(startedNanos));
            throw failure;
        } catch (BusinessException failure) {
            crawlerConfigurationDao.completeRunHistoryFailure(
                history.getCrawlerRunHistoryId(), "요청 설정 확인", failure.getMessage(), elapsedMillis(startedNanos));
            throw failure;
        } catch (RuntimeException failure) {
            crawlerConfigurationDao.completeRunHistoryFailure(
                history.getCrawlerRunHistoryId(), "크롤링 실행", "예상하지 못한 오류로 실행하지 못했습니다.", elapsedMillis(startedNanos));
            throw failure;
        }
    }

    @Transactional(readOnly = true)
    public List<CrawlerRunHistorySummaryResponse> getHistories(Long configurationId) {
        requireConfiguration(configurationId);
        return crawlerConfigurationDao.selectRunHistories(configurationId).stream().map(this::toHistorySummary).toList();
    }

    @Transactional(readOnly = true)
    public CrawlerRunHistoryDetailResponse getHistory(Long historyId) {
        CrawlerRunHistoryRow row = crawlerConfigurationDao.selectRunHistory(historyId);
        if (row == null) throw new BusinessException(ErrorCode.CRAWLER_HISTORY_NOT_FOUND);
        return new CrawlerRunHistoryDetailResponse(
            row.getCrawlerRunHistoryId(), row.getCrawlerConfigurationId(), row.getRunStatus(),
            readJson(row.getRequestJson(), CrawlerRunRequest.class, "저장된 실행 요청을 읽지 못했습니다."),
            row.getResultJson() == null ? null : readJson(row.getResultJson(), CrawlerRunResponse.class, "저장된 실행 결과를 읽지 못했습니다."),
            row.getFailureStage(), row.getFailureMessage(), row.getDurationMillis(), row.getItemCount(),
            toInstant(row.getStartedAt()), toInstant(row.getCompletedAt())
        );
    }

    @Transactional
    public void deleteHistory(Long historyId) {
        if (crawlerConfigurationDao.deleteRunHistory(historyId) == 0) {
            throw new BusinessException(ErrorCode.CRAWLER_HISTORY_NOT_FOUND);
        }
    }

    /** 저장 전에도 단계 순서 규칙을 검사하고, 로그인 정보를 지운 요청을 JSON으로 바꿔 담는다. */
    private CrawlerConfigurationSaveParameter toSaveParameter(Long configurationId, CrawlerConfigurationSaveRequest request) {
        CrawlerService.validateSteps(request.request());
        return CrawlerConfigurationSaveParameter.builder()
            .crawlerConfigurationId(configurationId)
            .configurationTitle(request.title().trim())
            .configurationDescription(request.description() == null ? "" : request.description().trim())
            .sitePreset(request.sitePreset().name())
            .requestJson(writeJson(withoutCredentials(request.request()), "크롤링 설정을 저장 가능한 형태로 변환하지 못했습니다."))
            .build();
    }

    /** 로그인 아이디·비밀번호 자리만 빈 문자열로 바꾼 새 요청을 만든다(record는 값을 바꿀 수 없어 새로 만든다). */
    private CrawlerRunRequest withoutCredentials(CrawlerRunRequest request) {
        CrawlerLoginRequest login = request.login();
        CrawlerLoginRequest safeLogin = new CrawlerLoginRequest(
            login.mode(), login.loginUrl(), "", "", login.usernameSelector(), login.passwordSelector(),
            login.submitSelector(), login.loggedInSelector());
        return new CrawlerRunRequest(
            request.showBrowser(), request.startUrl(), safeLogin, request.pageSearch(), request.contentFrameSelector(), request.itemSelector(),
            request.fields(), request.collectionFilter(), request.nextPageSelector(), request.maxPages(),
            request.waitAfterNavigationMillis(), request.maxItems(), request.browserWindow(), request.steps(),
            request.collectDetail(), request.detailSelector(), request.parseListing());
    }

    private CrawlerConfigurationRow requireConfiguration(Long configurationId) {
        CrawlerConfigurationRow row = crawlerConfigurationDao.selectConfiguration(configurationId);
        if (row == null) throw new BusinessException(ErrorCode.CRAWLER_CONFIGURATION_NOT_FOUND);
        return row;
    }

    private CrawlerConfigurationResponse toConfigurationResponse(CrawlerConfigurationRow row) {
        return new CrawlerConfigurationResponse(
            row.getCrawlerConfigurationId(), row.getConfigurationTitle(), row.getConfigurationDescription(),
            CrawlerSitePreset.valueOf(row.getSitePreset()),
            readJson(row.getRequestJson(), CrawlerRunRequest.class, "저장된 크롤링 설정을 읽지 못했습니다."),
            row.getRunCount(), row.getLastRunStatus(), toInstant(row.getLastRunAt()),
            toInstant(row.getCreatedAt()), toInstant(row.getUpdatedAt())
        );
    }

    private CrawlerRunHistorySummaryResponse toHistorySummary(CrawlerRunHistoryRow row) {
        return new CrawlerRunHistorySummaryResponse(
            row.getCrawlerRunHistoryId(), row.getCrawlerConfigurationId(), row.getRunStatus(),
            row.getFailureStage(), row.getFailureMessage(), row.getDurationMillis(), row.getItemCount(),
            toInstant(row.getStartedAt()), toInstant(row.getCompletedAt())
        );
    }

    private String writeJson(Object value, String message) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new BusinessException(ErrorCode.COMMON_INTERNAL_SERVER_ERROR, message);
        }
    }

    private <T> T readJson(String json, Class<T> type, String message) {
        try {
            return objectMapper.readValue(json, type);
        } catch (JsonProcessingException exception) {
            throw new BusinessException(ErrorCode.COMMON_INTERNAL_SERVER_ERROR, message);
        }
    }

    private long elapsedMillis(long startedNanos) {
        return (System.nanoTime() - startedNanos) / 1_000_000;
    }

    private Instant toInstant(LocalDateTime value) {
        return value == null ? null : value.toInstant(ZoneOffset.UTC);
    }
}
