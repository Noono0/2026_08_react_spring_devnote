package com.example.devnote.admin.dao.row;

import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class RolePermissionRow {
    private String memberRole;
    private String permissionCode;
    private String permissionName;
    private String permissionDescription;
    private String allowedYn;
}
