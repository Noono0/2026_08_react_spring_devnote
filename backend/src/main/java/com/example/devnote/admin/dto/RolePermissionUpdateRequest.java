package com.example.devnote.admin.dto;

/** 권한 켜기/끄기 요청 본문. { "allowed": true } */
public record RolePermissionUpdateRequest(boolean allowed) {
}
