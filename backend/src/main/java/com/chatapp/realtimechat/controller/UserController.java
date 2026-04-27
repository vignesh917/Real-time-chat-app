package com.chatapp.realtimechat.controller;

import com.chatapp.realtimechat.dto.UserRegistrationRequest;
import com.chatapp.realtimechat.dto.UserSummaryResponse;
import com.chatapp.realtimechat.service.UserService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserController {

	private final UserService userService;

	public UserController(UserService userService) {
		this.userService = userService;
	}

	@PostMapping("/register")
	public UserSummaryResponse registerUser(@RequestBody @Valid UserRegistrationRequest request) {
		return userService.registerUser(request);
	}

	@GetMapping
	public List<UserSummaryResponse> getUsers(@RequestParam(required = false) String currentUser) {
		return userService.getUsers(currentUser);
	}
}
