import { callAnthropic, hasAnthropicKey } from '../../lib/api';

export function createAnthropicProvider(config = {}) {
  const defaultModel = config.model || 'claude-sonnet-4-20250514';

  async function complete({ system, messages, maxTokens, signal }) {
    const data = await callAnthropic({
      model: defaultModel,
      max_tokens: maxTokens || 4096,
      system,
      messages,
      signal,
    });

    const text = data.content?.[0]?.text || '';
    return { text, raw: data };
  }

  function stream({ system, messages, maxTokens, signal }) {
    let accumulated = '';
    let done = false;

    const iterable = {
      async *[Symbol.asyncIterator]() {
        const response = await callAnthropic({
          model: defaultModel,
          max_tokens: maxTokens || 4096,
          system,
          messages,
          stream: true,
          signal,
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let lineBuf = '';

        try {
          while (true) {
            const { done: readerDone, value } = await reader.read();
            if (readerDone) break;

            lineBuf += decoder.decode(value, { stream: true });
            const lines = lineBuf.split('\n');
            lineBuf = lines.pop(); // keep incomplete trailing line in buffer

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                    accumulated += parsed.delta.text;
                    yield parsed.delta.text;
                  }
                } catch {
                  // Skip unparseable lines
                }
              }
            }
          }
        } finally {
          done = true;
        }
      },

      getText() {
        return accumulated;
      },
    };

    return iterable;
  }

  return {
    complete,
    stream,
    hasKey: hasAnthropicKey(),
  };
}
