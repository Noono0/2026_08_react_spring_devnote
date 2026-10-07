package com.example.devnote.admin.dto;

/** 권한 표 한 칸의 응답. allowed는 DB의 allowed_yn을 boolean으로 바꾼 값이다. */
public record RolePermissionResponse(String memberRole, String permissionCode, String permissionName, String permissionDescription, boolean allowed) {
}
