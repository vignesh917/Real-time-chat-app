package com.chatapp.realtimechat.dto;

import jakarta.validation.constraints.NotBlank;

public record TypingIndicatorRequest(
	@NotBlank(message = "A recipient is required.")
	String recipient,
	boolean typing
) {
}
