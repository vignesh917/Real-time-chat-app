package com.chatapp.realtimechat.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(
	name = "chat_messages",
	indexes = {
		@Index(name = "idx_chat_messages_sender", columnList = "senderUsername"),
		@Index(name = "idx_chat_messages_recipient", columnList = "recipientUsername"),
		@Index(name = "idx_chat_messages_sent_at", columnList = "sentAt")
	}
)
public class ChatMessage {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, length = 24)
	private String senderUsername;

	@Column(nullable = false, length = 24)
	private String recipientUsername;

	@Column(nullable = false, length = 1200)
	private String content;

	@Column(nullable = false)
	private Instant sentAt;

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public String getSenderUsername() {
		return senderUsername;
	}

	public void setSenderUsername(String senderUsername) {
		this.senderUsername = senderUsername;
	}

	public String getRecipientUsername() {
		return recipientUsername;
	}

	public void setRecipientUsername(String recipientUsername) {
		this.recipientUsername = recipientUsername;
	}

	public String getContent() {
		return content;
	}

	public void setContent(String content) {
		this.content = content;
	}

	public Instant getSentAt() {
		return sentAt;
	}

	public void setSentAt(Instant sentAt) {
		this.sentAt = sentAt;
	}
}
