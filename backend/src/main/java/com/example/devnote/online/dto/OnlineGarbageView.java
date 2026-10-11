package com.example.devnote.online.dto;

/** 테트리스 대전 방해 줄: 몇 줄을, 몇 번째 칸(0~9)을 비워서 넣을지, 누가 보냈는지 */
public record OnlineGarbageView(int lines, int holeCol, String fromNickname) {}
