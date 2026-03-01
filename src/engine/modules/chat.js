import { buildChatPrompt } from '../prompts/chat';

export function streamChat(provider, { subject, caseData, messages }) {
  const { system, messages: apiMessages, maxTokens } = buildChatPrompt({
    subject,
    caseData,
    messages,
  });

  const stream = provider.stream({ system, messages: apiMessages, maxTokens });

  return {
    [Symbol.asyncIterator]: () => stream[Symbol.asyncIterator](),
    getText: () => stream.getText(),
    getResult: () => ({ text: stream.getText() }),
  };
}
