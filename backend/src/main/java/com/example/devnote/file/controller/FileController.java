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

/**
 * 파일 업로드·이미지 보기·다운로드 API입니다. (/api/v1/files)
 *
 * [업로드 흐름]
 *   1. 에디터·첨부 영역에서 파일을 고르면 먼저 이 API로 올린다 → 파일 번호(fileId)를 받는다(상태 TEMP).
 *   2. 문서를 저장할 때 그 번호를 함께 보내면 문서와 연결되고 ACTIVE가 된다(DocumentServiceImpl).
 *   3. 끝내 저장하지 않은 TEMP 파일은 TemporaryFileCleanupService가 나중에 정리한다.
 *
 * multipart/form-data: 파일을 담아 보내는 요청 형식. @RequestPart("이름")은 FormData에 append한 이름과 같아야 한다.
 */
@RestController
@RequestMapping("/api/v1/files")
@RequiredArgsConstructor
public class FileController {
    private final FileStorageService fileStorageService;
    private final CurrentMemberProvider currentMemberProvider;

    // 첨부파일 업로드: 허용된 확장자(문서·압축·이미지 등)면 모두 받는다.
    @PostMapping(value = "/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<FileUploadResponse> uploadAttachment(
        @RequestPart("attachmentFile") MultipartFile attachmentFile,
        HttpServletRequest servletRequest
    ) {
        Long memberId = currentMemberProvider.getCurrentMemberId(servletRequest);
        return ApiResponse.created(fileStorageService.uploadFile(attachmentFile, memberId));
    }

    // 에디터 본문 이미지 업로드: 이미지만 받고, 파일 앞부분(시그니처)까지 확인해 진짜 이미지인지 검사한다.
    @PostMapping(value = "/editor-images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<FileUploadResponse> uploadEditorImage(
        @RequestPart("imageFile") MultipartFile imageFile,
        HttpServletRequest servletRequest
    ) {
        Long memberId = currentMemberProvider.getCurrentMemberId(servletRequest);
        return ApiResponse.created(fileStorageService.uploadImageFile(imageFile, memberId));
    }

    // 이미지 보기(<img src>용). Content-Disposition: inline = 브라우저가 내려받지 않고 화면에 바로 표시한다.
    @GetMapping("/{fileId}/content")
    public ResponseEntity<Resource> displayFileContent(@PathVariable Long fileId) {
        FileStorageService.DownloadedFile downloadedFile = fileStorageService.displayImageContent(fileId);
        ContentDisposition contentDisposition = ContentDisposition.inline()
            // 한글 파일 이름이 깨지지 않도록 UTF-8로 인코딩한 filename*=UTF-8''... 형식을 만든다.
            .filename(downloadedFile.originalFileName(), StandardCharsets.UTF_8)
            .build();
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition.toString())
            .contentType(MediaType.parseMediaType(downloadedFile.mimeType()))
            .body(downloadedFile.resource());
    }

    // 다운로드. Content-Disposition: attachment = 브라우저가 "파일로 저장"한다. 저장 이름은 원래 파일 이름이다.
    @GetMapping("/{fileId}/download")
    public ResponseEntity<Resource> downloadFile(@PathVariable Long fileId) {
        FileStorageService.DownloadedFile downloadedFile = fileStorageService.downloadFile(fileId);
        ContentDisposition contentDisposition = ContentDisposition.attachment()
            .filename(downloadedFile.originalFileName(), StandardCharsets.UTF_8)
            .build();
        // 파일 응답은 ApiResponse로 감싸지 않는다. 본문이 JSON이 아니라 파일 내용(바이트) 자체이기 때문이다.
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition.toString())
            .contentType(MediaType.parseMediaType(downloadedFile.mimeType()))
            .body(downloadedFile.resource());
    }
}
