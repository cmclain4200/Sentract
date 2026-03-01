import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useEngine } from "../../engine";

export default function useCaseChat(subject, caseData) {
  const engine = useEngine();
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef(null);

  // Load previous messages on mount
  useEffect(() => {
    if (!caseData?.id) return;
    supabase
      .from("chat_messages")
      .select("*")
      .eq("case_id", caseData.id)
      .eq("subject_id", subject?.id || null)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) {
          setMessages(data.map((m) => ({ role: m.role, content: m.content, id: m.id })));
        }
      });
  }, [caseData?.id, subject?.id]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || streaming) return;

    const userMsg = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);

    // Persist user message
    supabase.from("chat_messages").insert({
      case_id: caseData?.id,
      subject_id: subject?.id || null,
      role: "user",
      content: text.trim(),
    }).then(() => {});

    setStreaming(true);
    const assistantMsg = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const allMessages = [...messages, userMsg];

      const stream = engine.chat.stream({
        subject,
        caseData,
        messages: allMessages,
      });

      for await (const delta of stream) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: stream.getText() };
          return next;
        });
      }

      const fullText = stream.getText();

      // Persist assistant message
      supabase.from("chat_messages").insert({
        case_id: caseData?.id,
        subject_id: subject?.id || null,
        role: "assistant",
        content: fullText,
      }).then(() => {});

    } catch (err) {
      if (err.name !== "AbortError") {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: "Sorry, I encountered an error processing your request." };
          return next;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [messages, streaming, subject, caseData]);

  function clearMessages() {
    setMessages([]);
    if (caseData?.id) {
      supabase
        .from("chat_messages")
        .delete()
        .eq("case_id", caseData.id)
        .eq("subject_id", subject?.id || null)
        .then(() => {});
    }
  }

  function abort() {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }

  return { messages, streaming, sendMessage, clearMessages, abort };
}
