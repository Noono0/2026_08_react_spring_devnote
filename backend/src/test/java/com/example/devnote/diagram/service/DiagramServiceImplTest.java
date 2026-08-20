package com.example.devnote.diagram.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.diagram.dao.DiagramDao;
import com.example.devnote.diagram.dao.parameter.DiagramCreateParameter;
import com.example.devnote.diagram.dao.parameter.DiagramUpdateParameter;
import com.example.devnote.diagram.dao.parameter.DiagramVersionCreateParameter;
import com.example.devnote.diagram.dao.row.DiagramRow;
import com.example.devnote.diagram.dao.row.DiagramVersionRow;
import com.example.devnote.diagram.dto.DiagramDetailResponse;
import com.example.devnote.diagram.dto.DiagramSaveRequest;
import com.example.devnote.diagram.dto.DiagramType;
import com.example.devnote.diagram.dto.DiagramVersionResponse;
import com.example.devnote.member.service.CurrentMemberProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 다이어그램 서비스 단위 테스트.
 *
 * 검증 대상은 "서비스가 지켜야 할 규칙"이다.
 *   - 소유권: 남의 다이어그램은 존재조차 알려주지 않는다
 *   - 낙관적 잠금: 그 사이 누가 먼저 저장했으면 거부한다
 *   - 이력 정책: 내용이 바뀔 때만 남기고, 보관 개수를 넘기면 정리한다
 *   - 모델 검증: 유효하지 않은 JSON 은 저장하지 않는다
 */
@ExtendWith(MockitoExtension.class)
class DiagramServiceImplTest {
    private static final String VALID_MODEL = "{\"modelVersion\":1,\"nodes\":[],\"edges\":[]}";

    @Mock private DiagramDao diagramDao;
    @Mock private CurrentMemberProvider currentMemberProvider;

    private DiagramServiceImpl createService() {
        return new DiagramServiceImpl(diagramDao, currentMemberProvider, new ObjectMapper());
    }

    private DiagramRow existingDiagram(long diagramId, long versionNumber, String model) {
        DiagramRow row = new DiagramRow();
        row.setDiagramId(diagramId);
        row.setMemberId(1L);
        row.setDiagramTitle("주문 ERD");
        row.setDiagramDescription("설명");
        row.setDiagramType("ERD");
        row.setDiagramModel(model);
        row.setVersionNumber(versionNumber);
        row.setCreatedAt(LocalDateTime.now());
        row.setUpdatedAt(LocalDateTime.now());
        return row;
    }

    private DiagramSaveRequest saveRequest(String title, String model, Long versionNumber) {
        return new DiagramSaveRequest(title, "설명", DiagramType.ERD, model, "변경", versionNumber);
    }

    @Test
    void 남의_다이어그램은_찾을_수_없다() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        when(currentMemberProvider.getCurrentMemberId(request)).thenReturn(2L);
        // DAO 가 member_id 조건을 포함해 조회하므로 다른 회원의 것은 null 이 돌아온다.
        when(diagramDao.selectDiagram(10L, 2L)).thenReturn(null);

        assertThatThrownBy(() -> createService().getDiagram(10L, request))
            .isInstanceOfSatisfying(BusinessException.class,
                exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.DIAGRAM_NOT_FOUND));
    }

    @Test
    void 버전이_어긋나면_저장을_거부한다() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        when(currentMemberProvider.getCurrentMemberId(request)).thenReturn(1L);
        when(diagramDao.selectDiagram(10L, 1L)).thenReturn(existingDiagram(10L, 5L, VALID_MODEL));
        // 갱신 건수 0 = WHERE 절의 version_number 가 맞지 않았다는 뜻이다.
        when(diagramDao.updateDiagram(any(DiagramUpdateParameter.class))).thenReturn(0);

        assertThatThrownBy(() -> createService().update(10L, saveRequest("새 제목", VALID_MODEL, 3L), request))
            .isInstanceOfSatisfying(BusinessException.class,
                exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.DIAGRAM_VERSION_CONFLICT));

        // 충돌했으면 이력도 남기지 않아야 한다.
        verify(diagramDao, never()).insertDiagramVersion(any());
    }

    @Test
    void 내용이_바뀌면_이력을_남기고_오래된_이력을_정리한다() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        when(currentMemberProvider.getCurrentMemberId(request)).thenReturn(1L);
        when(diagramDao.selectDiagram(10L, 1L)).thenReturn(existingDiagram(10L, 5L, VALID_MODEL));
        when(diagramDao.updateDiagram(any(DiagramUpdateParameter.class))).thenReturn(1);

        String changedModel = "{\"modelVersion\":1,\"nodes\":[{\"nodeId\":\"a\"}],\"edges\":[]}";
        createService().update(10L, saveRequest("주문 ERD", changedModel, 5L), request);

        ArgumentCaptor<DiagramVersionCreateParameter> captor =
            ArgumentCaptor.forClass(DiagramVersionCreateParameter.class);
        verify(diagramDao).insertDiagramVersion(captor.capture());
        // 다음 버전 번호로 이력이 남아야 한다.
        assertThat(captor.getValue().getVersionNumber()).isEqualTo(6L);
        verify(diagramDao).deleteOldDiagramVersions(anyLong(), anyInt());
    }

    @Test
    void 내용이_그대로면_이력을_남기지_않는다() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        when(currentMemberProvider.getCurrentMemberId(request)).thenReturn(1L);
        when(diagramDao.selectDiagram(10L, 1L)).thenReturn(existingDiagram(10L, 5L, VALID_MODEL));
        when(diagramDao.updateDiagram(any(DiagramUpdateParameter.class))).thenReturn(1);

        // 제목도 모델도 그대로 저장 → 이력이 쌓이면 저장 공간만 낭비된다.
        createService().update(10L, saveRequest("주문 ERD", VALID_MODEL, 5L), request);

        verify(diagramDao, never()).insertDiagramVersion(any());
    }

    @Test
    void 유효하지_않은_JSON_모델은_저장하지_않는다() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        when(currentMemberProvider.getCurrentMemberId(request)).thenReturn(1L);

        assertThatThrownBy(() -> createService().create(saveRequest("깨진 모델", "{망가진", null), request))
            .isInstanceOfSatisfying(BusinessException.class,
                exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.DIAGRAM_MODEL_INVALID));

        verify(diagramDao, never()).insertDiagram(any());
    }

    @Test
    void 생성하면_1번_버전이_함께_기록된다() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        when(currentMemberProvider.getCurrentMemberId(request)).thenReturn(1L);
        // insert 후 생성된 키가 채워지는 상황을 흉내 낸다.
        doAnswerSetDiagramId();
        when(diagramDao.selectDiagram(77L, 1L)).thenReturn(existingDiagram(77L, 1L, VALID_MODEL));

        DiagramDetailResponse created = createService().create(saveRequest("새 ERD", VALID_MODEL, null), request);

        assertThat(created.diagramId()).isEqualTo(77L);
        ArgumentCaptor<DiagramVersionCreateParameter> captor =
            ArgumentCaptor.forClass(DiagramVersionCreateParameter.class);
        verify(diagramDao).insertDiagramVersion(captor.capture());
        assertThat(captor.getValue().getVersionNumber()).isEqualTo(1L);
    }

    private void doAnswerSetDiagramId() {
        org.mockito.Mockito.doAnswer(invocation -> {
            DiagramCreateParameter parameter = invocation.getArgument(0);
            parameter.setDiagramId(77L);
            return null;
        }).when(diagramDao).insertDiagram(any(DiagramCreateParameter.class));
    }

    @Test
    void 없는_버전을_조회하면_오류를_돌려준다() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        when(currentMemberProvider.getCurrentMemberId(request)).thenReturn(1L);
        when(diagramDao.selectDiagram(10L, 1L)).thenReturn(existingDiagram(10L, 5L, VALID_MODEL));
        when(diagramDao.selectDiagramVersion(10L, 99L)).thenReturn(null);

        assertThatThrownBy(() -> createService().getVersion(10L, 99L, request))
            .isInstanceOfSatisfying(BusinessException.class,
                exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.DIAGRAM_VERSION_NOT_FOUND));
    }

    @Test
    void 버전_목록에는_모델_JSON을_담지_않는다() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        when(currentMemberProvider.getCurrentMemberId(request)).thenReturn(1L);
        when(diagramDao.selectDiagram(10L, 1L)).thenReturn(existingDiagram(10L, 5L, VALID_MODEL));

        DiagramVersionRow versionRow = new DiagramVersionRow();
        versionRow.setDiagramVersionId(1L);
        versionRow.setDiagramId(10L);
        versionRow.setVersionNumber(1L);
        versionRow.setDiagramTitle("주문 ERD");
        versionRow.setDiagramType("ERD");
        versionRow.setDiagramModel(VALID_MODEL);
        versionRow.setCreatedAt(LocalDateTime.now());
        when(diagramDao.selectDiagramVersions(10L)).thenReturn(List.of(versionRow));

        List<DiagramVersionResponse> versions = createService().getVersions(10L, request);

        // 목록 응답이 커지지 않도록 모델은 빼고 내려보낸다.
        assertThat(versions).hasSize(1);
        assertThat(versions.get(0).diagramModelJson()).isNull();
    }
}
