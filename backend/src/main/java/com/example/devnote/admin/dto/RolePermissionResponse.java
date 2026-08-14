package com.example.devnote.admin.dto;

public record RolePermissionResponse(String memberRole, String permissionCode, String permissionName, String permissionDescription, boolean allowed) {
}
