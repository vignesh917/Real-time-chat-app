package com.chatapp.realtimechat.config;

import com.chatapp.realtimechat.service.UserService;
import java.util.Locale;
import java.util.Map;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class UsernameChannelInterceptor implements ChannelInterceptor {

	private final UserService userService;

	public UsernameChannelInterceptor(UserService userService) {
		this.userService = userService;
	}

	@Override
	public Message<?> preSend(Message<?> message, MessageChannel channel) {
		StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
		if (accessor == null || !StompCommand.CONNECT.equals(accessor.getCommand())) {
			return message;
		}

		String requestedUsername = firstNonBlank(
			accessor.getFirstNativeHeader("x-user"),
			accessor.getFirstNativeHeader("username"),
			accessor.getLogin()
		);
		String normalizedUsername = userService.requireUsername(requestedUsername);

		userService.ensureUserExists(normalizedUsername);
		accessor.setUser(new StompPrincipal(normalizedUsername.toLowerCase(Locale.ROOT)));

		Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
		if (sessionAttributes != null) {
			sessionAttributes.put("username", normalizedUsername.toLowerCase(Locale.ROOT));
		}

		return message;
	}

	private String firstNonBlank(String... values) {
		for (String value : values) {
			if (StringUtils.hasText(value)) {
				return value;
			}
		}
		return null;
	}
}
