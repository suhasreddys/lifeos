"use client";

import { FormEvent, useRef, useState } from "react";
import { IconSparkles, IconSend, IconCalendar, IconDocument, IconCheckSquare, IconFinance } from "./Icons";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const quickActions = [
  { icon: IconCalendar, label: "Upcoming Renewals", prompt: "What are my upcoming document renewal dates?" },
  { icon: IconDocument, label: "Summarize Documents", prompt: "Summarize my saved documents in the vault." },
  { icon: IconCheckSquare, label: "Pending Tasks", prompt: "What tasks need my attention today?" },
  { icon: IconFinance, label: "Financial Summary", prompt: "What is my financial balance & summary?" },
];

export default function AiChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hello! I am your LifeOS Personal Assistant. How can I help with your documents, daily planning, tasks, calendar, or financial records today?",
    },
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
        content: m.content,
      }));

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiHistory }),
      });

      const data = (await res.json()) as { text?: string; error?: string };

      if (!res.ok || !data.text) {
        throw new Error(data.error ?? "Failed to get AI response.");
      }

      setMessages((current) => [...current, { role: "assistant", content: data.text! }]);
    } catch (err) {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: `⚠️ Error: ${err instanceof Error ? err.message : "Could not complete request."}` },
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
    <div style={{ display: "grid", gap: 16, maxWidth: 860, margin: "0 auto" }}>
      {/* Quick Suggestion Chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {quickActions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.label}
              type="button"
              onClick={() => sendMessage(act.prompt)}
              disabled={isLoading}
              className="quick-action-btn"
              style={{ fontSize: 12, padding: "6px 14px" }}
            >
              <Icon size={14} />
              <span>{act.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Chat Box Container */}
      <div
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--line)",
          borderRadius: 24,
          boxShadow: "var(--shadow-md)",
          display: "flex",
          flexDirection: "column",
          minHeight: 520,
          maxHeight: "calc(100vh - 260px)",
          overflow: "hidden",
        }}
      >
        {/* Chat Messages Log */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {messages.map((m, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                width: "100%",
              }}
            >
              <div
                style={{
                  maxWidth: "80%",
                  padding: "14px 18px",
                  borderRadius: 20,
                  fontSize: 14,
                  lineHeight: 1.55,
                  whiteSpace: "pre-wrap",
                  background: m.role === "user" ? "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" : "var(--subtle-bg)",
                  color: m.role === "user" ? "#ffffff" : "var(--ink)",
                  border: m.role === "assistant" ? "1px solid var(--line)" : "none",
                  borderBottomRightRadius: m.role === "user" ? 4 : 20,
                  borderBottomLeftRadius: m.role === "assistant" ? 4 : 20,
                  boxShadow: m.role === "user" ? "0 4px 14px rgba(99, 102, 241, 0.3)" : "none",
                }}
              >
                {m.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div style={{ display: "flex", justifyContent: "flex-start", width: "100%" }}>
              <div
                style={{
                  padding: "12px 18px",
                  borderRadius: 20,
                  background: "var(--subtle-bg)",
                  color: "var(--muted)",
                  fontSize: 13,
                  fontWeight: 600,
                  border: "1px solid var(--line)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <IconSparkles size={16} className="animate-spin" />
                <span>Gemini is thinking...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            gap: 10,
            padding: "14px 16px",
            borderTop: "1px solid var(--line)",
            background: "var(--paper)",
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your documents, tasks, budget, or day plan..."
            disabled={isLoading}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 14,
              border: "1px solid var(--input-border)",
              background: "var(--input-bg)",
              color: "var(--ink)",
              fontSize: 14,
              outline: 0,
            }}
          />
          <button
            type="submit"
            className="primary-button"
            disabled={isLoading || !input.trim()}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px" }}
          >
            <IconSend size={16} />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
