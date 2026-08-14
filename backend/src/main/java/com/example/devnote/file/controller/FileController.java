package com.example.devnote.file.controller;

import com.example.devnote.common.api.ApiResponse;
import com.example.devnote.file.dto.FileUploadResponse;
import com.example.devnote.file.service.FileStorageService;
import com.example.devnote.member.service.CurrentMemberProvider;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/v1/files")
@RequiredArgsConstructor
public class FileController {
    private final FileStorageService fileStorageService;
    private final CurrentMemberProvider currentMemberProvider;

    @PostMapping(value = "/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<FileUploadResponse> uploadAttachment(
        @RequestPart("attachmentFile") MultipartFile attachmentFile,
        HttpServletRequest servletRequest
    ) {
        Long memberId = currentMemberProvider.getCurrentMemberId(servletRequest);
        return ApiResponse.created(fileStorageService.uploadFile(attachmentFile, memberId));
    }

    @PostMapping(value = "/editor-images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<FileUploadResponse> uploadEditorImage(
        @RequestPart("imageFile") MultipartFile imageFile,
        HttpServletRequest servletRequest
    ) {
        Long memberId = currentMemberProvider.getCurrentMemberId(servletRequest);
        return ApiResponse.created(fileStorageService.uploadImageFile(imageFile, memberId));
    }

    @GetMapping("/{fileId}/content")
    public ResponseEntity<Resource> displayFileContent(@PathVariable Long fileId) {
        FileStorageService.DownloadedFile downloadedFile = fileStorageService.displayImageContent(fileId);
        ContentDisposition contentDisposition = ContentDisposition.inline()
            .filename(downloadedFile.originalFileName(), StandardCharsets.UTF_8)
            .build();
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition.toString())
            .contentType(MediaType.parseMediaType(downloadedFile.mimeType()))
            .body(downloadedFile.resource());
    }

    @GetMapping("/{fileId}/download")
    public ResponseEntity<Resource> downloadFile(@PathVariable Long fileId) {
        FileStorageService.DownloadedFile downloadedFile = fileStorageService.downloadFile(fileId);
        ContentDisposition contentDisposition = ContentDisposition.attachment()
            .filename(downloadedFile.originalFileName(), StandardCharsets.UTF_8)
            .build();
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition.toString())
            .contentType(MediaType.parseMediaType(downloadedFile.mimeType()))
            .body(downloadedFile.resource());
    }
}
