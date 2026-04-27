package com.chatapp.realtimechat.controller;

import com.chatapp.realtimechat.dto.ConversationMessageResponse;
import com.chatapp.realtimechat.service.ChatService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/conversations")
public class ConversationController {

	private final ChatService chatService;

	public ConversationController(ChatService chatService) {
		this.chatService = chatService;
	}

	@GetMapping("/{currentUser}/{otherUser}")
	public List<ConversationMessageResponse> getConversation(
		@PathVariable String currentUser,
		@PathVariable String otherUser
	) {
		return chatService.getConversation(currentUser, otherUser);
	}
}
