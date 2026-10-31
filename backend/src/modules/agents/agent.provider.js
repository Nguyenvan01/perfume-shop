'use strict';

const { SYSTEM_PROMPT, MAX_OUTPUT_TOKENS } = require('./agent.constant');

class ProviderError extends Error {
  constructor(provider, message) {
    super(message);
    this.name = 'ProviderError';
    this.provider = provider;
  }
}

async function postJson(url, { headers, body, signal, provider }) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    // The error body is never read: it can include prompt content, request ids,
    // or provider-specific implementation detail. Release it instead.
    try {
      await response.body?.cancel();
    } catch {
      // Nothing to release.
    }
    throw new ProviderError(provider, `Provider request failed (${response.status})`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    // A timeout while reading the body must still be reported as a timeout.
    if (error?.name === 'AbortError') throw error;
    throw new ProviderError(provider, 'Invalid provider response');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ProviderError(provider, 'Invalid provider response');
  }
  return payload;
}

const asArray = (value) => (Array.isArray(value) ? value : []);

function requireText(provider, text) {
  if (!text || !text.trim()) throw new ProviderError(provider, 'Provider returned no text');
  return text.trim();
}

/** Raw Responses API JSON: output[] → message items → output_text parts. */
function extractOpenAIText(payload) {
  if (payload.status === 'incomplete') {
    throw new ProviderError('openai', 'Provider response was incomplete');
  }
  if (payload.status && payload.status !== 'completed') {
    throw new ProviderError('openai', 'Provider response did not complete');
  }
  return asArray(payload.output)
    .filter((item) => item?.type === 'message')
    .flatMap((item) => asArray(item.content))
    .filter((part) => part?.type === 'output_text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');
}

function createOpenAIAdapter({ apiKey, model }) {
  return {
    provider: 'openai',
    model,
    async run({ task, signal }) {
      const payload = await postJson('https://api.openai.com/v1/responses', {
        provider: 'openai',
        signal,
        headers: { authorization: `Bearer ${apiKey}` },
        body: {
          model,
          input: task,
          instructions: SYSTEM_PROMPT,
          max_output_tokens: MAX_OUTPUT_TOKENS,
          store: false,
        },
      });
      return requireText('openai', extractOpenAIText(payload));
    },
  };
}

function createAnthropicAdapter({ apiKey, model }) {
  return {
    provider: 'anthropic',
    model,
    async run({ task, signal }) {
      const payload = await postJson('https://api.anthropic.com/v1/messages', {
        provider: 'anthropic',
        signal,
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: {
          model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: task }],
        },
      });
      const text = asArray(payload.content)
        .filter((part) => part?.type === 'text' && typeof part.text === 'string')
        .map((part) => part.text)
        .join('\n');
      return requireText('anthropic', text);
    },
  };
}

function createGeminiAdapter({ apiKey, model }) {
  // Accept both "gemini-x" and the "models/gemini-x" form the API lists.
  const modelId = model.replace(/^models\//, '');
  return {
    provider: 'gemini',
    model,
    async run({ task, signal }) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`;
      const payload = await postJson(endpoint, {
        provider: 'gemini',
        signal,
        headers: { 'x-goog-api-key': apiKey },
        body: {
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: task }] }],
          generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
        },
      });
      const parts = asArray(asArray(payload.candidates)[0]?.content?.parts);
      // Thinking models return chain-of-thought as parts marked `thought: true`; drop them,
      // like the OpenAI (reasoning items) and Anthropic (thinking blocks) adapters do.
      const text = parts
        .filter((part) => !part?.thought)
        .map((part) => (typeof part?.text === 'string' ? part.text : ''))
        .join('\n');
      return requireText('gemini', text);
    },
  };
}

function createConfiguredAdapters(env) {
  const adapters = {};
  if (env.AGENT_OPENAI_API_KEY && env.AGENT_OPENAI_MODEL) {
    adapters.openai = createOpenAIAdapter({
      apiKey: env.AGENT_OPENAI_API_KEY,
      model: env.AGENT_OPENAI_MODEL,
    });
  }
  if (env.AGENT_ANTHROPIC_API_KEY && env.AGENT_ANTHROPIC_MODEL) {
    adapters.anthropic = createAnthropicAdapter({
      apiKey: env.AGENT_ANTHROPIC_API_KEY,
      model: env.AGENT_ANTHROPIC_MODEL,
    });
  }
  if (env.AGENT_GEMINI_API_KEY && env.AGENT_GEMINI_MODEL) {
    adapters.gemini = createGeminiAdapter({
      apiKey: env.AGENT_GEMINI_API_KEY,
      model: env.AGENT_GEMINI_MODEL,
    });
  }
  return adapters;
}

module.exports = {
  ProviderError,
  createOpenAIAdapter,
  createAnthropicAdapter,
  createGeminiAdapter,
  createConfiguredAdapters,
};
