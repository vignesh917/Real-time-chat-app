package com.chatapp.realtimechat.dto;

import java.util.Set;

public record PresenceSnapshot(Set<String> onlineUsers) {
}
