package com.chatapp.realtimechat.service;

import com.chatapp.realtimechat.dto.UserRegistrationRequest;
import com.chatapp.realtimechat.dto.UserSummaryResponse;
import com.chatapp.realtimechat.entity.ChatUser;
import com.chatapp.realtimechat.repository.ChatUserRepository;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
public class UserService {

	private static final String[] ACCENT_COLORS = {
		"#ff6b6b",
		"#f59e0b",
		"#10b981",
		"#0ea5e9",
		"#6366f1",
		"#ec4899",
		"#f97316",
		"#14b8a6"
	};

	private final ChatUserRepository chatUserRepository;
	private final ObjectProvider<PresenceService> presenceServiceProvider;

	public UserService(ChatUserRepository chatUserRepository, ObjectProvider<PresenceService> presenceServiceProvider) {
		this.chatUserRepository = chatUserRepository;
		this.presenceServiceProvider = presenceServiceProvider;
	}

	@Transactional
	public UserSummaryResponse registerUser(UserRegistrationRequest request) {
		String username = requireUsername(request.username());
		String displayName = StringUtils.hasText(request.displayName()) ? request.displayName().trim() : username;

		ChatUser user = chatUserRepository
			.findByUsername(username)
			.map(existingUser -> updateDisplayName(existingUser, displayName))
			.orElseGet(() -> createUser(username, displayName));

		return toUserSummary(user);
	}

	@Transactional(readOnly = true)
	public List<UserSummaryResponse> getUsers(String currentUser) {
		String normalizedCurrentUser = StringUtils.hasText(currentUser) ? requireUsername(currentUser) : null;
		return chatUserRepository
			.findAllByOrderByDisplayNameAsc()
			.stream()
			.filter(user -> normalizedCurrentUser == null || !user.getUsername().equals(normalizedCurrentUser))
			.map(this::toUserSummary)
			.toList();
	}

	@Transactional
	public void ensureUserExists(String username) {
		String normalizedUsername = requireUsername(username);
		chatUserRepository.findByUsername(normalizedUsername).orElseGet(() -> createUser(normalizedUsername, normalizedUsername));
	}

	@Transactional
	public void touchLastSeen(String username) {
		chatUserRepository.findByUsername(requireUsername(username)).ifPresent(user -> {
			user.setLastSeenAt(Instant.now());
			chatUserRepository.save(user);
		});
	}

	public String requireUsername(String username) {
		String normalized = normalizeUsername(username);
		if (!StringUtils.hasText(normalized)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a username with letters or numbers.");
		}
		return normalized;
	}

	public String normalizeUsername(String username) {
		if (!StringUtils.hasText(username)) {
			return "";
		}

		String cleaned = username
			.trim()
			.toLowerCase(Locale.ROOT)
			.replaceAll("[^a-z0-9._-]", "")
			.replaceAll("^[._-]+|[._-]+$", "");

		if (cleaned.length() > 24) {
			cleaned = cleaned.substring(0, 24);
		}

		return cleaned;
	}

	private ChatUser updateDisplayName(ChatUser user, String displayName) {
		user.setDisplayName(displayName);
		return chatUserRepository.save(user);
	}

	private ChatUser createUser(String username, String displayName) {
		ChatUser user = new ChatUser();
		user.setUsername(username);
		user.setDisplayName(displayName);
		user.setAccentColor(resolveAccentColor(username));
		user.setCreatedAt(Instant.now());
		user.setLastSeenAt(Instant.now());
		return chatUserRepository.save(user);
	}

	private UserSummaryResponse toUserSummary(ChatUser user) {
		PresenceService presenceService = presenceServiceProvider.getIfAvailable();
		boolean online = presenceService != null && presenceService.isOnline(user.getUsername());
		return new UserSummaryResponse(
			user.getUsername(),
			user.getDisplayName(),
			user.getAccentColor(),
			online,
			user.getLastSeenAt()
		);
	}

	private String resolveAccentColor(String username) {
		int colorIndex = Math.floorMod(username.hashCode(), ACCENT_COLORS.length);
		return ACCENT_COLORS[colorIndex];
	}
}
