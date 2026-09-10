"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const suggestions = [
  "⚠️ Upcoming renewal dates?",
  "📁 Summarize my documents",
  "✓ Pending tasks list",
  "💰 Financial balance summary"
];

export default function FloatingAiButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hi there! I'm your LifeOS Personal AI Assistant. Ask me anything about your documents, reminders, tasks, or finances!"
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
        throw new Error(data.error ?? "Failed to get response.");
      }

      setMessages((current) => [...current, { role: "assistant", content: data.text! }]);
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
    <div className="floating-ai-wrapper">
      {/* Floating AI Chat Popover Drawer */}
      {isOpen && (
        <div className="floating-ai-popover">
          <div className="popover-header">
            <div className="popover-brand">
              <span className="popover-icon">✨</span>
              <div>
                <strong>LifeOS Personal AI Assistant</strong>
                <span className="popover-status">● Gemini Connected</span>
              </div>
            </div>
            <div className="popover-header-actions">
              <Link href="/ai" className="popover-expand-btn" title="Open Fullscreen Chat" onClick={() => setIsOpen(false)}>
                ↗ Fullscreen
              </Link>
              <button type="button" className="popover-close-btn" onClick={() => setIsOpen(false)} aria-label="Close AI Chat">
                ✕
              </button>
            </div>
          </div>

          <div className="popover-body">
            {messages.map((msg, idx) => (
              <div key={idx} className={`popover-bubble-row popover-bubble-row--${msg.role}`}>
                <div className={`popover-bubble popover-bubble--${msg.role}`}>
                  <p>{msg.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="popover-bubble-row popover-bubble-row--assistant">
                <div className="popover-bubble popover-bubble--assistant">
                  <p className="typing-dots">Searching LifeOS & generating answer...</p>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="popover-suggestions">
            {suggestions.map((sug) => (
              <button
                key={sug}
                type="button"
                className="popover-chip"
                onClick={() => sendMessage(sug.replace(/^[^\s]+\s+/, ""))}
                disabled={isLoading}
              >
                {sug}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="popover-footer">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your LifeOS..."
              disabled={isLoading}
            />
            <button type="submit" className="popover-send-btn" disabled={isLoading || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      )}

      {/* Prominent Large Floating AI Button */}
      <button
        type="button"
        className={`floating-ai-button ${isOpen ? "floating-ai-button--active" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle LifeOS Personal AI Assistant"
      >
        <span className="floating-ai-sparkle">✨</span>
        <span className="floating-ai-label">{isOpen ? "Close Assistant" : "Ask LifeOS Personal AI"}</span>
        <span className="floating-ai-pulse" />
      </button>
    </div>
  );
}
