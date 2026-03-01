import { useState, useRef, useEffect } from "react";
import { X, Send, Trash2, MessageSquare } from "lucide-react";
import useCaseChat from "./useCaseChat";
import ReactMarkdown from "react-markdown";

export default function CaseChat({ isOpen, onClose, subject, caseData }) {
  const { messages, streaming, sendMessage, clearMessages } = useCaseChat(subject, caseData);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  function handleSend() {
    if (!input.trim() || streaming) return;
    sendMessage(input);
    setInput("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      className="fixed right-0 top-0 h-full z-50 flex flex-col"
      style={{
        width: 420,
        background: "#0a0a0a",
        borderLeft: "1px solid #1a1a1a",
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s ease",
        boxShadow: isOpen ? "-4px 0 24px rgba(0,0,0,0.5)" : "none",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 shrink-0" style={{ height: 56, borderBottom: "1px solid #1a1a1a" }}>
        <div className="flex items-center gap-2">
          <MessageSquare size={14} color="#09BC8A" />
          <span className="text-[13px] text-white font-medium">
            {subject?.name || "Chat"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="p-1.5 rounded cursor-pointer"
              style={{ background: "transparent", border: "none" }}
              title="Clear chat"
            >
              <Trash2 size={13} color="#555" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded cursor-pointer"
            style={{ background: "transparent", border: "none" }}
          >
            <X size={15} color="#555" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <MessageSquare size={28} color="#333" className="mx-auto mb-3" />
            <div className="text-[13px]" style={{ color: "#555" }}>
              Ask questions about {subject?.name || "this subject"}'s profile data
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className="max-w-[85%] rounded-lg px-3 py-2 text-[13px]"
              style={{
                background: msg.role === "user" ? "#09BC8A" : "#1a1a1a",
                color: msg.role === "user" ? "#0a0a0a" : "#ccc",
              }}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_li]:my-0.5 [&_ul]:my-1 [&_ol]:my-1">
                  <ReactMarkdown>{msg.content || (streaming && i === messages.length - 1 ? "..." : "")}</ReactMarkdown>
                </div>
              ) : (
                <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 shrink-0" style={{ borderTop: "1px solid #1a1a1a" }}>
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this subject..."
            rows={1}
            className="flex-1 resize-none outline-none text-[13px]"
            style={{
              background: "#111",
              border: "1px solid #1e1e1e",
              borderRadius: 8,
              padding: "10px 12px",
              color: "#ccc",
              maxHeight: 100,
            }}
            onFocus={(e) => (e.target.style.borderColor = "#333")}
            onBlur={(e) => (e.target.style.borderColor = "#1e1e1e")}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || streaming}
            className="shrink-0 flex items-center justify-center rounded-lg cursor-pointer"
            style={{
              width: 36,
              height: 36,
              background: input.trim() && !streaming ? "#09BC8A" : "#1a1a1a",
              border: "none",
              color: input.trim() && !streaming ? "#0a0a0a" : "#555",
            }}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
