package com.example.devnote.portfolio.controller;

import com.example.devnote.common.api.ApiResponse;
import com.example.devnote.file.dto.FileUploadResponse;
import com.example.devnote.file.service.FileStorageService;
import com.example.devnote.portfolio.dto.PortfolioSectionResponse;
import com.example.devnote.portfolio.dto.PortfolioSectionSaveRequest;
import com.example.devnote.portfolio.service.PortfolioEditSessionService;
import com.example.devnote.portfolio.service.PortfolioSectionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * 공개 포트폴리오의 섹션(자기소개·기술·경력·프로젝트 …) API입니다. (/api/v1/portfolio)
 *
 * [권한]
 *   조회: 누구나. 단, 방문자에게는 공개(PUBLIC) 섹션만, 슈퍼관리자에게는 숨김(HIDDEN) 섹션까지 보인다.
 *   추가·수정·삭제·이미지 업로드: 슈퍼관리자 + X-Portfolio-Editor: true 헤더(PortfolioEditSessionService.requireEditor).
 */
@RestController
@RequestMapping("/api/v1/portfolio")
@RequiredArgsConstructor
public class PortfolioController {
    // 포트폴리오의 주인 = 1번 회원(슈퍼관리자). 편집기에서 올린 이미지는 이 회원의 파일로 저장한다.
    private static final long PORTFOLIO_OWNER_MEMBER_ID = 1L;
    private final PortfolioSectionService portfolioSectionService;
    private final PortfolioEditSessionService editSessionService;
    private final FileStorageService fileStorageService;

    @GetMapping("/sections")
    public ApiResponse<List<PortfolioSectionResponse>> getSections(HttpServletRequest request) {
        // 같은 주소라도 누가 요청했는지에 따라 다른 목록을 준다(편집 화면에서는 숨긴 섹션도 보여야 하므로).
        return ApiResponse.success(editSessionService.isUnlocked(request)
            ? portfolioSectionService.getAllSections()
            : portfolioSectionService.getPublicSections());
    }

    @PostMapping("/sections")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<PortfolioSectionResponse> createSection(
        @Valid @RequestBody PortfolioSectionSaveRequest saveRequest,
        HttpServletRequest request
    ) {
        editSessionService.requireEditor(request);
        return ApiResponse.created(portfolioSectionService.createSection(saveRequest));
    }

    @PutMapping("/sections/{portfolioSectionId}")
    public ApiResponse<PortfolioSectionResponse> updateSection(
        @PathVariable Long portfolioSectionId,
        @Valid @RequestBody PortfolioSectionSaveRequest saveRequest,
        HttpServletRequest request
    ) {
        editSessionService.requireEditor(request);
        return ApiResponse.success(portfolioSectionService.updateSection(portfolioSectionId, saveRequest));
    }

    @DeleteMapping("/sections/{portfolioSectionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSection(
        @PathVariable Long portfolioSectionId,
        // DELETE는 본문을 보내지 않는 것이 관례라 버전을 쿼리 문자열(?versionNumber=3)로 받는다.
        @RequestParam @Positive Long versionNumber,
        HttpServletRequest request
    ) {
        editSessionService.requireEditor(request);
        portfolioSectionService.deleteSection(portfolioSectionId, versionNumber);
    }

    // 포트폴리오 편집기 전용 이미지 업로드. 일반 업로드(/api/v1/files)와 달리 편집 권한을 먼저 확인한다.
    @PostMapping(value = "/editor-images", consumes = "multipart/form-data")
    public ApiResponse<FileUploadResponse> uploadEditorImage(
        @RequestPart("imageFile") MultipartFile imageFile,
        HttpServletRequest request
    ) {
        editSessionService.requireEditor(request);
        return ApiResponse.created(fileStorageService.uploadImageFile(imageFile, PORTFOLIO_OWNER_MEMBER_ID));
    }
}
