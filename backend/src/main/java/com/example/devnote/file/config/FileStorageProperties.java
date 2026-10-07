package com.example.devnote.file.config;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;
import java.util.List;

/**
 * 파일 저장 설정(application.yml의 application.file-storage.*)을 담는 객체입니다.
 *   rootDirectory        : 업로드 파일을 저장할 폴더(기본 ./storage, Docker에서는 볼륨 경로)
 *   maximumFileSizeBytes : 파일 하나의 최대 크기(바이트)
 *   allowedExtensions    : 올릴 수 있는 확장자 목록
 *
 * @Validated + @NotNull 등: 설정값이 비었거나 잘못되면 서버가 시작할 때 바로 실패해 문제를 일찍 알린다.
 *
 * temporaryFileRetention: 업로드 후 문서·포트폴리오에서 쓰지 않은 임시 파일을 남겨 둘 기간입니다.
 * 편집 화면을 오래 열어 둔 채 저장하는 경우를 고려해 기본값을 하루로 둡니다.
 */
@Validated
@ConfigurationProperties(prefix = "application.file-storage")
public record FileStorageProperties(
    @NotNull String rootDirectory,
    @Positive long maximumFileSizeBytes,
    @NotEmpty List<String> allowedExtensions,
    @NotNull Duration temporaryFileRetention
) {
}
