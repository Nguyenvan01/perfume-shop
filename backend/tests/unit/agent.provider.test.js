'use strict';

const {
  ProviderError,
  createOpenAIAdapter,
  createAnthropicAdapter,
  createGeminiAdapter,
  createConfiguredAdapters,
} = require('../../src/modules/agents/agent.provider');
const { createAgentRunService } = require('../../src/modules/agents/agent.service');
const { SYSTEM_PROMPT, MAX_OUTPUT_TOKENS } = require('../../src/modules/agents/agent.constant');

const API_KEY = 'sk-test-SECRET-123';
const TASK = 'Compare two checkout designs';

const jsonResponse = (payload, status = 200) =>
  new Response(typeof payload === 'string' ? payload : JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const openaiPayload = {
  id: 'resp_123',
  object: 'response',
  status: 'completed',
  model: 'gpt-test',
  output: [
    { id: 'rs_1', type: 'reasoning', summary: [] },
    {
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      status: 'completed',
      content: [
        { type: 'output_text', text: 'Design A ', annotations: [] },
        { type: 'output_text', text: 'is simpler.', annotations: [] },
      ],
    },
  ],
  usage: { input_tokens: 12, output_tokens: 5, total_tokens: 17 },
};

const anthropicPayload = {
  id: 'msg_01',
  type: 'message',
  role: 'assistant',
  model: 'claude-test',
  content: [
    { type: 'thinking', thinking: 'internal', signature: 'sig' },
    { type: 'text', text: 'Design B is safer.' },
  ],
  stop_reason: 'end_turn',
  usage: { input_tokens: 10, output_tokens: 6 },
};

const geminiPayload = {
  candidates: [
    {
      content: { role: 'model', parts: [{ text: 'Design A wins.' }] },
      finishReason: 'STOP',
      index: 0,
    },
  ],
  usageMetadata: { promptTokenCount: 8, candidatesTokenCount: 4, totalTokenCount: 12 },
  modelVersion: 'gemini-test',
};

const PROVIDER_CASES = [
  {
    name: 'openai',
    create: () => createOpenAIAdapter({ apiKey: API_KEY, model: 'gpt-test' }),
    okPayload: openaiPayload,
    expectedText: 'Design A is simpler.',
  },
  {
    name: 'anthropic',
    create: () => createAnthropicAdapter({ apiKey: API_KEY, model: 'claude-test' }),
    okPayload: anthropicPayload,
    expectedText: 'Design B is safer.',
  },
  {
    name: 'gemini',
    create: () => createGeminiAdapter({ apiKey: API_KEY, model: 'gemini-test' }),
    okPayload: geminiPayload,
    expectedText: 'Design A wins.',
  },
];

const originalFetch = global.fetch;
let fetchMock;

beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock;
});

afterEach(() => {
  global.fetch = originalFetch;
});

const lastRequest = () => {
  const [url, init] = fetchMock.mock.calls[0];
  return { url, init, body: JSON.parse(init.body) };
};

describe('OpenAI adapter (Responses API)', () => {
  it('sends the expected request and parses output[].message.content[].output_text', async () => {
    fetchMock.mockResolvedValue(jsonResponse(openaiPayload));
    const signal = new AbortController().signal;

    const text = await createOpenAIAdapter({ apiKey: API_KEY, model: 'gpt-test' }).run({ task: TASK, signal });

    const { url, init, body } = lastRequest();
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(init.method).toBe('POST');
    expect(init.signal).toBe(signal);
    expect(init.headers).toEqual({
      'content-type': 'application/json',
      authorization: `Bearer ${API_KEY}`,
    });
    expect(body).toEqual({
      model: 'gpt-test',
      input: TASK,
      instructions: SYSTEM_PROMPT,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      store: false,
    });
    expect(text).toBe('Design A is simpler.');
  });

  it('treats status "incomplete" as a failure even when partial text exists', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...openaiPayload,
        status: 'incomplete',
        incomplete_details: { reason: 'max_output_tokens' },
      })
    );

    const promise = createOpenAIAdapter({ apiKey: API_KEY, model: 'gpt-test' }).run({ task: TASK });

    await expect(promise).rejects.toBeInstanceOf(ProviderError);
    await expect(promise).rejects.toThrow('Provider response was incomplete');
  });

  it('fails with "no text" when the response has no output_text parts', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ...openaiPayload, output: [{ type: 'reasoning', summary: [] }] })
    );

    await expect(
      createOpenAIAdapter({ apiKey: API_KEY, model: 'gpt-test' }).run({ task: TASK })
    ).rejects.toThrow('Provider returned no text');
  });
});

describe('Anthropic adapter (Messages API)', () => {
  it('sends the expected request and joins only text blocks', async () => {
    fetchMock.mockResolvedValue(jsonResponse(anthropicPayload));

    const text = await createAnthropicAdapter({ apiKey: API_KEY, model: 'claude-test' }).run({ task: TASK });

    const { url, init, body } = lastRequest();
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers).toEqual({
      'content-type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    });
    expect(body).toEqual({
      model: 'claude-test',
      max_tokens: MAX_OUTPUT_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: TASK }],
    });
    expect(text).toBe('Design B is safer.');
  });
});

describe('Gemini adapter (generateContent)', () => {
  it('sends the expected request with the key in a header, not the URL', async () => {
    fetchMock.mockResolvedValue(jsonResponse(geminiPayload));

    const text = await createGeminiAdapter({ apiKey: API_KEY, model: 'gemini-test' }).run({ task: TASK });

    const { url, init, body } = lastRequest();
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent'
    );
    expect(url).not.toContain(API_KEY);
    expect(init.headers).toEqual({ 'content-type': 'application/json', 'x-goog-api-key': API_KEY });
    expect(body).toEqual({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: TASK }] }],
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
    });
    expect(text).toBe('Design A wins.');
  });

  it('strips a leading "models/" prefix from the configured model name', async () => {
    fetchMock.mockResolvedValue(jsonResponse(geminiPayload));

    const adapter = createGeminiAdapter({ apiKey: API_KEY, model: 'models/gemini-test' });
    await adapter.run({ task: TASK });

    expect(lastRequest().url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent'
    );
  });

  it('fails with "no text" when there are no candidates (e.g. blocked prompt)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ promptFeedback: { blockReason: 'SAFETY' } }));

    await expect(
      createGeminiAdapter({ apiKey: API_KEY, model: 'gemini-test' }).run({ task: TASK })
    ).rejects.toThrow('Provider returned no text');
  });
});

describe.each(PROVIDER_CASES)('$name adapter error handling', ({ create }) => {
  it('non-OK status → generic message without the upstream body', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { message: 'upstream secret detail req_abc', type: 'server_error' } }, 500)
    );

    const error = await create().run({ task: TASK }).catch((caught) => caught);

    expect(error).toBeInstanceOf(ProviderError);
    expect(error.message).toBe('Provider request failed (500)');
    expect(error.message).not.toContain('upstream secret detail');
  });

  it('200 with a non-JSON body → ProviderError', async () => {
    fetchMock.mockResolvedValue(jsonResponse('<html>gateway</html>'));

    const error = await create().run({ task: TASK }).catch((caught) => caught);

    expect(error).toBeInstanceOf(ProviderError);
    expect(error.message).toBe('Invalid provider response');
  });

  it.each(['null', '[]', '"text"'])('200 with JSON %s → ProviderError', async (raw) => {
    fetchMock.mockResolvedValue(jsonResponse(raw));

    const error = await create().run({ task: TASK }).catch((caught) => caught);

    expect(error).toBeInstanceOf(ProviderError);
    expect(error.message).toBe('Invalid provider response');
  });

  it('200 with a malformed but valid JSON object → ProviderError (no TypeError)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ output: 'x', content: { a: 1 }, candidates: [{ content: { parts: null } }] })
    );

    await expect(create().run({ task: TASK })).rejects.toBeInstanceOf(ProviderError);
  });

  it('AbortError while reading the body is rethrown (reported as timeout)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new DOMException('This operation was aborted', 'AbortError')),
    });

    const error = await create().run({ task: TASK }).catch((caught) => caught);

    expect(error.name).toBe('AbortError');
  });
});

describe('API keys never reach the run result', () => {
  it.each(PROVIDER_CASES)('$name: success, upstream error and network error', async ({ name, create, okPayload }) => {
    const service = createAgentRunService({ adapters: { [name]: create() } });
    const other = PROVIDER_CASES.find((item) => item.name !== name).name;
    const run = () => service.run({ task: TASK, providers: [name, other], timeout_ms: 1000 });

    fetchMock.mockResolvedValueOnce(jsonResponse(okPayload));
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { message: `bad key ${API_KEY}` } }, 401));
    fetchMock.mockRejectedValueOnce(new TypeError(`fetch failed for ${API_KEY}`));

    const results = [await run(), await run(), await run()];

    expect(results.map((result) => result.results[0].status)).toEqual(['completed', 'failed', 'failed']);
    expect(results[1].results[0].error).toBe('Provider request failed (401)');
    expect(results[2].results[0].error).toBe('Provider request failed');
    for (const result of results) {
      expect(JSON.stringify(result)).not.toContain(API_KEY);
    }
  });
});

describe('createConfiguredAdapters', () => {
  it('enables a provider only when both key and model are set', () => {
    const adapters = createConfiguredAdapters({
      AGENT_OPENAI_API_KEY: API_KEY,
      AGENT_OPENAI_MODEL: 'gpt-test',
      AGENT_ANTHROPIC_API_KEY: API_KEY,
      AGENT_ANTHROPIC_MODEL: '',
      AGENT_GEMINI_API_KEY: '',
      AGENT_GEMINI_MODEL: 'gemini-test',
    });

    expect(Object.keys(adapters)).toEqual(['openai']);

    const models = createAgentRunService({ adapters }).listModels();
    expect(models).toEqual([
      { provider: 'openai', enabled: true, model: 'gpt-test' },
      { provider: 'anthropic', enabled: false, model: null },
      { provider: 'gemini', enabled: false, model: null },
    ]);
    expect(JSON.stringify(models)).not.toContain(API_KEY);
  });
});
