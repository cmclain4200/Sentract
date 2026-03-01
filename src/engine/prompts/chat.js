import { profileToPromptText } from '../core/profileToPrompt';

export function buildChatPrompt({ subject, caseData, messages }) {
  const profileText = profileToPromptText(subject?.profile_data || {});
  const system = `You are an intelligence analyst assistant working within the Sentract platform. Answer questions about this subject using only the data provided below. Cite specific data points when possible. Be concise and analytical.

CASE: ${caseData?.name || "Unknown"} (${caseData?.type || "Unknown"})

${profileText}

Guidelines:
- Only reference information present in the profile data above
- If asked about something not in the data, clearly state the information is not available
- Use analytical language appropriate for intelligence reporting
- Highlight potential connections and patterns when relevant`;

  return {
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    maxTokens: 2048,
  };
}
