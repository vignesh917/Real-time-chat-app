package com.chatapp.realtimechat.controller;

import com.chatapp.realtimechat.dto.ConversationMessageResponse;
import com.chatapp.realtimechat.dto.DirectMessageRequest;
import com.chatapp.realtimechat.dto.TypingIndicatorRequest;
import com.chatapp.realtimechat.dto.TypingIndicatorResponse;
import com.chatapp.realtimechat.service.ChatService;
import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class ChatSocketController {

	private final ChatService chatService;
	private final SimpMessagingTemplate messagingTemplate;

	public ChatSocketController(ChatService chatService, SimpMessagingTemplate messagingTemplate) {
		this.chatService = chatService;
		this.messagingTemplate = messagingTemplate;
	}

	@MessageMapping("/chat.send")
	public void sendDirectMessage(@Payload @Valid DirectMessageRequest request, Principal principal) {
		ConversationMessageResponse response = chatService.sendDirectMessage(requirePrincipalName(principal), request);
		messagingTemplate.convertAndSendToUser(response.recipient(), "/queue/messages", response);
		messagingTemplate.convertAndSendToUser(response.sender(), "/queue/messages", response);
	}

	@MessageMapping("/chat.typing")
	public void sendTypingIndicator(@Payload @Valid TypingIndicatorRequest request, Principal principal) {
		TypingIndicatorResponse response = chatService.createTypingIndicator(requirePrincipalName(principal), request);
		messagingTemplate.convertAndSendToUser(response.recipient(), "/queue/typing", response);
	}

	private String requirePrincipalName(Principal principal) {
		if (principal == null || principal.getName() == null) {
			throw new IllegalStateException("No chat user is bound to the WebSocket session.");
		}
		return principal.getName();
	}
}
