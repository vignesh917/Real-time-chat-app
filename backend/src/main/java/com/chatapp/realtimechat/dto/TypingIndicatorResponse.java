package com.chatapp.realtimechat.dto;

import java.time.Instant;

public record TypingIndicatorResponse(
	String sender,
	String recipient,
	boolean typing,
	Instant timestamp
) {
}
