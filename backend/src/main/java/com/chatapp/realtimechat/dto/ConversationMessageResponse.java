package com.chatapp.realtimechat.dto;

import java.time.Instant;

public record ConversationMessageResponse(
	Long id,
	String sender,
	String recipient,
	String content,
	Instant sentAt
) {
}
