package com.example.devnote.board.todo.service;

import com.example.devnote.board.todo.controller.TodoPushDeviceCookie;
import com.example.devnote.member.service.AuthenticationStateChanging;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component @RequiredArgsConstructor
public class TodoPushAuthenticationListener {
    private final TodoPushDeviceCookie cookies;
    private final TodoPushService push;
    @EventListener
    public void onAuthenticationChange(AuthenticationStateChanging event) {
        push.disableDevice(cookies.deviceHash(event.request()));
    }
}
