package com.example.devnote.file.config;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.util.List;

@Validated
@ConfigurationProperties(prefix = "application.file-storage")
public record FileStorageProperties(
    @NotNull String rootDirectory,
    @Positive long maximumFileSizeBytes,
    @NotEmpty List<String> allowedExtensions
) {
}
