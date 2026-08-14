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

@RestController
@RequestMapping("/api/v1/portfolio")
@RequiredArgsConstructor
public class PortfolioController {
    private static final long PORTFOLIO_OWNER_MEMBER_ID = 1L;
    private final PortfolioSectionService portfolioSectionService;
    private final PortfolioEditSessionService editSessionService;
    private final FileStorageService fileStorageService;

    @GetMapping("/sections")
    public ApiResponse<List<PortfolioSectionResponse>> getSections(HttpServletRequest request) {
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
        @RequestParam @Positive Long versionNumber,
        HttpServletRequest request
    ) {
        editSessionService.requireEditor(request);
        portfolioSectionService.deleteSection(portfolioSectionId, versionNumber);
    }

    @PostMapping(value = "/editor-images", consumes = "multipart/form-data")
    public ApiResponse<FileUploadResponse> uploadEditorImage(
        @RequestPart("imageFile") MultipartFile imageFile,
        HttpServletRequest request
    ) {
        editSessionService.requireEditor(request);
        return ApiResponse.created(fileStorageService.uploadImageFile(imageFile, PORTFOLIO_OWNER_MEMBER_ID));
    }
}
