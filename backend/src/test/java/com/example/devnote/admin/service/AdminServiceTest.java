package com.example.devnote.admin.service;

import com.example.devnote.admin.dao.AdminDao;
import com.example.devnote.admin.dto.MemberManagementUpdateRequest;
import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.member.dao.MemberDao;
import com.example.devnote.member.dao.row.MemberRow;
import com.example.devnote.member.dto.MemberGrade;
import com.example.devnote.member.dto.MemberRole;
import com.example.devnote.member.service.AuthenticationService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminServiceTest {
    @Mock AuthenticationService authenticationService;
    @Mock MemberDao memberDao;
    @Mock AdminDao adminDao;
    @Mock HttpServletRequest request;
    @InjectMocks AdminService service;

    @Test
    void superAdministratorCannotLockOwnAccount() {
        MemberRow actor = new MemberRow();
        actor.setMemberId(1L);
        actor.setMemberRole("SUPER_ADMIN");
        when(authenticationService.findAuthenticatedMember(request)).thenReturn(actor);
        when(memberDao.selectMemberById(1L)).thenReturn(actor);

        assertThatThrownBy(() -> service.updateMember(1L,
            new MemberManagementUpdateRequest(MemberGrade.DIAMOND, MemberRole.SUPER_ADMIN, "LOCKED"), request))
            .isInstanceOf(BusinessException.class)
            .extracting(exception -> ((BusinessException) exception).getErrorCode()).isEqualTo(ErrorCode.ACCESS_DENIED);
        verify(memberDao, never()).updateMemberManagement(anyLong(), anyString(), anyString(), anyString());
    }
}
