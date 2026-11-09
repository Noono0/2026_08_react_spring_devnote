package com.example.devnote.member.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.member.dao.MemberDao;
import com.example.devnote.member.dao.row.MemberRow;
import com.example.devnote.member.dto.MemberProfileUpdateRequest;
import com.example.devnote.member.dto.PasswordChangeRequest;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MemberProfileServiceTest {
    @Mock AuthenticationService authenticationService;
    @Mock MemberDao memberDao;
    @Mock MemberPasswordService passwordService;
    @Mock HttpServletRequest request;
    MemberProfileService service;

    @BeforeEach
    void setUp() {
        service = new MemberProfileService(authenticationService, memberDao, passwordService);
    }

    @Test
    void ownProfileRequiresLogin() {
        assertError(ErrorCode.AUTHENTICATION_REQUIRED, () -> service.getOwnProfile(request));
    }

    @Test
    void managedDetailRequiresAdministrator() {
        when(authenticationService.findAuthenticatedMember(request)).thenReturn(member(1L, "USER"));
        assertError(ErrorCode.ACCESS_DENIED, () -> service.getManagedProfile(2L, request));
        verify(memberDao, never()).selectMemberForManagement(anyLong());
    }

    @Test
    void ordinaryMemberCanUpdateOwnNameAndEmail() {
        MemberRow member = member(1L, "USER");
        when(authenticationService.findAuthenticatedMember(request)).thenReturn(member);
        when(memberDao.updateMemberProfile(1L, "새 이름", "new@example.com")).thenReturn(1);
        when(memberDao.selectMemberById(1L)).thenReturn(member);

        service.updateOwnProfile(new MemberProfileUpdateRequest(" 새 이름 ", " NEW@EXAMPLE.COM "), request);

        verify(memberDao).updateMemberProfile(1L, "새 이름", "new@example.com");
    }

    @Test
    void administratorCanEditOrdinaryMemberButNotAnotherAdministrator() {
        MemberRow administrator = member(2L, "ADMIN");
        when(authenticationService.findAuthenticatedMember(request)).thenReturn(administrator);
        when(memberDao.selectMemberForManagement(1L)).thenReturn(member(1L, "USER"));
        when(memberDao.updateMemberProfile(1L, "이름", "new@example.com")).thenReturn(1);
        when(memberDao.selectMemberById(1L)).thenReturn(member(1L, "USER"));
        service.updateManagedProfile(1L, new MemberProfileUpdateRequest("이름", "new@example.com"), request);

        when(memberDao.selectMemberForManagement(3L)).thenReturn(member(3L, "SUPER_ADMIN"));
        assertError(ErrorCode.ACCESS_DENIED,
            () -> service.updateManagedProfile(3L, new MemberProfileUpdateRequest("이름", "new@example.com"), request));
        verify(memberDao, never()).updateMemberProfile(eq(3L), anyString(), anyString());
    }

    @Test
    void administratorCanEditOwnAccountAndSuperAdministratorCanEditAnyAccount() {
        MemberRow administrator = member(2L, "ADMIN");
        when(authenticationService.findAuthenticatedMember(request)).thenReturn(administrator, member(3L, "SUPER_ADMIN"));
        when(memberDao.selectMemberForManagement(2L)).thenReturn(administrator);
        when(memberDao.selectMemberForManagement(4L)).thenReturn(member(4L, "ADMIN"));
        when(memberDao.updateMemberProfile(anyLong(), anyString(), anyString())).thenReturn(1);
        when(memberDao.selectMemberById(2L)).thenReturn(administrator);
        when(memberDao.selectMemberById(4L)).thenReturn(member(4L, "ADMIN"));

        service.updateManagedProfile(2L, new MemberProfileUpdateRequest("내 이름", "me@example.com"), request);
        service.updateManagedProfile(4L, new MemberProfileUpdateRequest("관리자", "other@example.com"), request);

        verify(memberDao).updateMemberProfile(2L, "내 이름", "me@example.com");
        verify(memberDao).updateMemberProfile(4L, "관리자", "other@example.com");
    }

    @Test
    void currentPasswordMustMatchBeforeChangingPassword() {
        MemberRow member = member(1L, "USER");
        member.setPasswordHash("old-hash");
        when(authenticationService.findAuthenticatedMember(request)).thenReturn(member);
        when(passwordService.matches("wrong", "old-hash")).thenReturn(false);

        assertError(ErrorCode.CURRENT_PASSWORD_INVALID,
            () -> service.changeOwnPassword(new PasswordChangeRequest("wrong", "new-password"), request));
        verify(memberDao, never()).updateMemberPassword(anyLong(), anyString());
    }

    @Test
    void matchingCurrentPasswordStoresOnlyEncodedNewPassword() {
        MemberRow member = member(1L, "USER");
        member.setPasswordHash("old-hash");
        when(authenticationService.findAuthenticatedMember(request)).thenReturn(member);
        when(passwordService.matches("old-password", "old-hash")).thenReturn(true);
        when(passwordService.encode("new-password")).thenReturn("new-hash");

        service.changeOwnPassword(new PasswordChangeRequest("old-password", "new-password"), request);

        verify(memberDao).updateMemberPassword(1L, "new-hash");
    }

    @Test
    void duplicateEmailReturnsExplicitConflict() {
        when(authenticationService.findAuthenticatedMember(request)).thenReturn(member(1L, "USER"));
        when(memberDao.updateMemberProfile(1L, "이름", "taken@example.com"))
            .thenThrow(new DuplicateKeyException("duplicate"));

        assertError(ErrorCode.EMAIL_ALREADY_EXISTS,
            () -> service.updateOwnProfile(new MemberProfileUpdateRequest("이름", "taken@example.com"), request));
    }

    @Test
    void removedMemberCannotBeEdited() {
        when(authenticationService.findAuthenticatedMember(request)).thenReturn(member(2L, "SUPER_ADMIN"));
        MemberRow removed = member(1L, "USER");
        removed.setUseYn("N");
        when(memberDao.selectMemberForManagement(1L)).thenReturn(removed);

        assertError(ErrorCode.MEMBER_NOT_FOUND,
            () -> service.updateManagedProfile(1L, new MemberProfileUpdateRequest("이름", "new@example.com"), request));
        verify(memberDao, never()).updateMemberProfile(anyLong(), anyString(), anyString());
    }

    @Test
    void detailResponseNeverIncludesPasswordHash() {
        MemberRow member = member(1L, "USER");
        member.setPasswordHash("secret-hash");
        when(authenticationService.findAuthenticatedMember(request)).thenReturn(member);

        assertThat(service.getOwnProfile(request).toString()).doesNotContain("secret-hash");
    }

    private MemberRow member(Long id, String role) {
        MemberRow member = new MemberRow();
        member.setMemberId(id);
        member.setLoginId("member" + id);
        member.setMemberName("회원");
        member.setEmail("member" + id + "@example.com");
        member.setMemberRole(role);
        member.setGradeCode("BRONZE");
        member.setAccountStatus("ACTIVE");
        member.setUseYn("Y");
        return member;
    }

    private void assertError(ErrorCode errorCode, Runnable action) {
        assertThatThrownBy(action::run).isInstanceOf(BusinessException.class)
            .extracting(exception -> ((BusinessException) exception).getErrorCode()).isEqualTo(errorCode);
    }
}
