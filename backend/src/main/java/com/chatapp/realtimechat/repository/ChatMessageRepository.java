package com.chatapp.realtimechat.repository;

import com.chatapp.realtimechat.entity.ChatMessage;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

	@Query(
		"""
		select message from ChatMessage message
		where (
			message.senderUsername = :firstUser
			and message.recipientUsername = :secondUser
		) or (
			message.senderUsername = :secondUser
			and message.recipientUsername = :firstUser
		)
		order by message.sentAt asc
		"""
	)
	List<ChatMessage> findConversation(@Param("firstUser") String firstUser, @Param("secondUser") String secondUser);
}
