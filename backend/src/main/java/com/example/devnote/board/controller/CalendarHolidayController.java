package com.example.devnote.board.controller;

import com.example.devnote.board.dto.CalendarHolidayDtos.*;
import com.example.devnote.board.service.CalendarHolidayService;
import com.example.devnote.common.api.ApiResponse;
import com.example.devnote.member.service.CurrentMemberProvider;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController @RequiredArgsConstructor
@RequestMapping("/api/v1/calendar/holidays")
public class CalendarHolidayController {
    private final CalendarHolidayService holidayService;
    private final CurrentMemberProvider currentMemberProvider;
    @GetMapping
    public ApiResponse<HolidayMonth> month(@RequestParam String month) { return ApiResponse.success(holidayService.month(month)); }
    @PostMapping
    public ResponseEntity<ApiResponse<Holiday>> create(@Valid @RequestBody HolidayRequest body, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(holidayService.create(body, currentMemberProvider.getCurrentMemberId(request))));
    }
    @PutMapping("/{holidayId}")
    public ApiResponse<Holiday> update(@PathVariable long holidayId, @Valid @RequestBody HolidayRequest body, HttpServletRequest request) {
        return ApiResponse.success(holidayService.update(holidayId, body, currentMemberProvider.getCurrentMemberId(request)));
    }
    @DeleteMapping("/{holidayId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long holidayId, @RequestParam long versionNumber, HttpServletRequest request) {
        holidayService.delete(holidayId, versionNumber, currentMemberProvider.getCurrentMemberId(request));
    }
}
