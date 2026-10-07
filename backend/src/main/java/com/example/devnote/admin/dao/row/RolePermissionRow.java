package com.example.devnote.admin.dao.row;

import lombok.Getter;
import lombok.Setter;

/** 권한 표의 한 칸: 어떤 역할(memberRole)이 어떤 기능(permissionCode)을 쓸 수 있는가(allowedYn = Y/N). */
@Getter @Setter
public class RolePermissionRow {
    private String memberRole;
    private String permissionCode;
    private String permissionName;
    private String permissionDescription;
    private String allowedYn;
}
