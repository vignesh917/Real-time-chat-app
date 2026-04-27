package com.chatapp.realtimechat.service;

import com.chatapp.realtimechat.dto.ConversationMessageResponse;
import com.chatapp.realtimechat.dto.DirectMessageRequest;
import com.chatapp.realtimechat.dto.TypingIndicatorRequest;
import com.chatapp.realtimechat.dto.TypingIndicatorResponse;
import com.chatapp.realtimechat.entity.ChatMessage;
import com.chatapp.realtimechat.repository.ChatMessageRepository;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ChatService {

	private final ChatMessageRepository chatMessageRepository;
	private final UserService userService;

	public ChatService(ChatMessageRepository chatMessageRepository, UserService userService) {
		this.chatMessageRepository = chatMessageRepository;
		this.userService = userService;
	}

	@Transactional
	public ConversationMessageResponse sendDirectMessage(String senderUsername, DirectMessageRequest request) {
		String sender = userService.requireUsername(senderUsername);
		String recipient = userService.requireUsername(request.recipient());
		String content = request.content() == null ? "" : request.content().trim();

		if (sender.equals(recipient)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose another user for one-to-one chat.");
		}
		if (content.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Message content cannot be empty.");
		}

		userService.ensureUserExists(sender);
		userService.ensureUserExists(recipient);

		ChatMessage message = new ChatMessage();
		message.setSenderUsername(sender);
		message.setRecipientUsername(recipient);
		message.setContent(content);
		message.setSentAt(Instant.now());

		return mapMessage(chatMessageRepository.save(message));
	}

	@Transactional(readOnly = true)
	public List<ConversationMessageResponse> getConversation(String currentUser, String otherUser) {
		String normalizedCurrentUser = userService.requireUsername(currentUser);
		String normalizedOtherUser = userService.requireUsername(otherUser);
		userService.ensureUserExists(normalizedCurrentUser);
		userService.ensureUserExists(normalizedOtherUser);

		return chatMessageRepository
			.findConversation(normalizedCurrentUser, normalizedOtherUser)
			.stream()
			.map(this::mapMessage)
			.toList();
	}

	public TypingIndicatorResponse createTypingIndicator(String senderUsername, TypingIndicatorRequest request) {
		String sender = userService.requireUsername(senderUsername);
		String recipient = userService.requireUsername(request.recipient());

		if (sender.equals(recipient)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Typing indicators require another user.");
		}

		userService.ensureUserExists(sender);
		userService.ensureUserExists(recipient);
		return new TypingIndicatorResponse(sender, recipient, request.typing(), Instant.now());
	}

	private ConversationMessageResponse mapMessage(ChatMessage message) {
		return new ConversationMessageResponse(
			message.getId(),
			message.getSenderUsername(),
			message.getRecipientUsername(),
			message.getContent(),
			message.getSentAt()
		);
	}
}
