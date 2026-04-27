package com.chatapp.realtimechat.service;

import com.chatapp.realtimechat.dto.PresenceSnapshot;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class PresenceService {

	private final Map<String, Set<String>> userSessions = new ConcurrentHashMap<>();
	private final SimpMessagingTemplate messagingTemplate;
	private final UserService userService;

	public PresenceService(SimpMessagingTemplate messagingTemplate, UserService userService) {
		this.messagingTemplate = messagingTemplate;
		this.userService = userService;
	}

	public void registerSession(String username, String sessionId) {
		String normalizedUsername = userService.requireUsername(username);
		userSessions.computeIfAbsent(normalizedUsername, ignored -> ConcurrentHashMap.newKeySet()).add(sessionId);
		broadcastPresence();
	}

	public void removeSession(String username, String sessionId) {
		String normalizedUsername = userService.requireUsername(username);
		Set<String> sessions = userSessions.get(normalizedUsername);
		if (sessions == null) {
			return;
		}

		sessions.remove(sessionId);
		if (sessions.isEmpty()) {
			userSessions.remove(normalizedUsername);
			userService.touchLastSeen(normalizedUsername);
		}
		broadcastPresence();
	}

	public boolean isOnline(String username) {
		String normalizedUsername = userService.requireUsername(username);
		return userSessions.containsKey(normalizedUsername);
	}

	public PresenceSnapshot currentSnapshot() {
		return new PresenceSnapshot(new LinkedHashSet<>(new TreeSet<>(userSessions.keySet())));
	}

	private void broadcastPresence() {
		messagingTemplate.convertAndSend("/topic/presence", currentSnapshot());
	}
}
