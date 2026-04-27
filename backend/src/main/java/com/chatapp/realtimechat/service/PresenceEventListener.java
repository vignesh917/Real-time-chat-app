package com.chatapp.realtimechat.service;

import java.security.Principal;
import java.util.Map;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

@Component
public class PresenceEventListener {

	private final PresenceService presenceService;

	public PresenceEventListener(PresenceService presenceService) {
		this.presenceService = presenceService;
	}

	@EventListener
	public void onSessionConnected(SessionConnectedEvent event) {
		StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
		String sessionId = accessor.getSessionId();
		String username = extractUsername(accessor);
		if (StringUtils.hasText(username) && StringUtils.hasText(sessionId)) {
			presenceService.registerSession(username, sessionId);
		}
	}

	@EventListener
	public void onSessionDisconnected(SessionDisconnectEvent event) {
		StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
		String sessionId = accessor.getSessionId();
		String username = extractUsername(accessor);
		if (StringUtils.hasText(username) && StringUtils.hasText(sessionId)) {
			presenceService.removeSession(username, sessionId);
		}
	}

	private String extractUsername(StompHeaderAccessor accessor) {
		Principal principal = accessor.getUser();
		if (principal != null && StringUtils.hasText(principal.getName())) {
			return principal.getName();
		}

		Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
		if (sessionAttributes == null) {
			return null;
		}

		Object username = sessionAttributes.get("username");
		return username instanceof String value ? value : null;
	}
}
