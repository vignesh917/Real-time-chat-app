package com.chatapp.realtimechat.repository;

import com.chatapp.realtimechat.entity.ChatUser;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatUserRepository extends JpaRepository<ChatUser, Long> {

	Optional<ChatUser> findByUsername(String username);

	List<ChatUser> findAllByOrderByDisplayNameAsc();
}
