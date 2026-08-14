package com.example.devnote.member.dto;

public enum MemberRole {
    USER,
    ADMIN,
    SUPER_ADMIN;

    public boolean isAdministrator() {
        return this == ADMIN || this == SUPER_ADMIN;
    }
}
