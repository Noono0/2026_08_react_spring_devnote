package com.example.devnote.online.dto;

/** 고를 수 있는 게임 목록(available=false는 화면에 "준비 중") */
public record OnlineGameTypeResponse(String code, String label, int minSeats, int maxSeats, boolean available) {}
