package com.chatapp.realtimechat.dto;

import java.time.Instant;

public record UserSummaryResponse(
	String username,
	String displayName,
	String accentColor,
	boolean online,
	Instant lastSeenAt
) {
}
