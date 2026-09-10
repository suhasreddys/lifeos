"use client";

import { FormEvent, useRef, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const quickActions = [
  { icon: "📅", label: "Upcoming Renewals", prompt: "What are my upcoming document renewal dates?" },
  { icon: "📁", label: "Summarize Documents", prompt: "Summarize my saved documents in the vault." },
  { icon: "✓", label: "Pending Tasks", prompt: "What tasks need my attention today?" },
  { icon: "💰", label: "Financial Summary", prompt: "What is my financial balance & summary?" }
];

export default function AiChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hello! How can I assist with your documents, tasks, calendar, or financial records today?"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }

  async function sendMessage(textToSend: string) {
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: "user", content: textToSend };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);
    scrollToBottom();

    try {
      const apiHistory = updatedMessages.map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("model" as const),
        content: m.content
      }));

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiHistory })
      });

      const data = (await res.json()) as { text?: string; error?: string };

      if (!res.ok || !data.text) {
        throw new Error(data.error ?? "Failed to get AI response.");
      }

      setMessages((current) => [
        ...current,
        { role: "assistant", content: data.text! }
      ]);
    } catch (err) {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: `⚠️ Error: ${err instanceof Error ? err.message : "Could not complete request."}` }
      ]);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 900, margin: "0 auto" }}>
      {/* Quick Suggestion Chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {quickActions.map((act) => (
          <button
            key={act.label}
            type="button"
            onClick={() => sendMessage(act.prompt)}
            disabled={isLoading}
            style={{
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "var(--ink)",
              padding: "7px 14px",
              borderRadius: 20,
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: isLoading ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = "rgba(99, 102, 241, 0.15)";
                e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.35)";
                e.currentTarget.style.color = "#a5b4fc";
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.color = "var(--ink)";
              }
            }}
          >
            <span>{act.icon}</span>
            <span>{act.label}</span>
          </button>
        ))}
      </div>

      {/* Messages Panel */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.5) 100%)",
          borderRadius: 16,
          border: "1px solid rgba(255, 255, 255, 0.08)",
          padding: 20,
          minHeight: 380,
          maxHeight: 520,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.25)"
        }}
      >
        {messages.map((msg, idx) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={idx}
              style={{
                display: "flex",
                justifyContent: isUser ? "flex-end" : "flex-start"
              }}
            >
              <div
                style={{
                  maxWidth: "80%",
                  padding: "12px 16px",
                  borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: isUser
                    ? "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)"
                    : "rgba(255, 255, 255, 0.06)",
                  color: "#ffffff",
                  fontSize: "0.92rem",
                  lineHeight: 1.5,
                  boxShadow: isUser ? "0 4px 14px rgba(99, 102, 241, 0.3)" : "none",
                  border: isUser ? "none" : "1px solid rgba(255, 255, 255, 0.08)"
                }}
              >
                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg.content}</p>
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "16px 16px 16px 4px",
                padding: "12px 16px",
                color: "var(--muted)",
                fontSize: "0.88rem",
                display: "flex",
                alignItems: "center",
                gap: 8
              }}
            >
              <span className="spinner" style={{ width: 14, height: 14, border: "2px solid #818cf8", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
              Analyzing LifeOS context...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Form Bar */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center"
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about your documents, tasks, or calendar..."
          disabled={isLoading}
          style={{
            flex: 1,
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: 12,
            padding: "12px 16px",
            color: "var(--ink)",
            fontSize: "0.9rem",
            outline: "none",
            boxSizing: "border-box",
            transition: "all 0.2s"
          }}
          onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(255, 255, 255, 0.12)")}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          style={{
            padding: "12px 22px",
            borderRadius: 12,
            background: isLoading || !input.trim() ? "rgba(99, 102, 241, 0.3)" : "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
            color: "#ffffff",
            border: "none",
            fontWeight: 800,
            fontSize: "0.88rem",
            cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
            boxShadow: "0 4px 12px rgba(99, 102, 241, 0.25)",
            transition: "all 0.2s",
            whiteSpace: "nowrap"
          }}
        >
          {isLoading ? "Thinking..." : "Send"}
        </button>
      </form>
    </div>
  );
}
