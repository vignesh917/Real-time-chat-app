package com.chatapp.realtimechat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DirectMessageRequest(
	@NotBlank(message = "A recipient is required.")
	String recipient,
	@NotBlank(message = "Message content cannot be empty.")
	@Size(max = 1200, message = "Messages must stay under 1200 characters.")
	String content
) {
}
