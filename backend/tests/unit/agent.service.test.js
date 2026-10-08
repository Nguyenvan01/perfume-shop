'use strict';

const { createAgentRunService } = require('../../src/modules/agents/agent.service');
const { ProviderError } = require('../../src/modules/agents/agent.provider');
const { runSchema } = require('../../src/modules/agents/agent.validation');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('AgentRun multi-model orchestration', () => {
  it('starts configured models concurrently and preserves the requested order', async () => {
    let releaseOpenAI;
    let releaseGemini;
    const openaiDone = new Promise((resolve) => {
      releaseOpenAI = resolve;
    });
    const geminiDone = new Promise((resolve) => {
      releaseGemini = resolve;
    });
    const openaiRun = jest.fn(async () => {
      await openaiDone;
      return 'OpenAI answer';
    });
    const geminiRun = jest.fn(async () => {
      await geminiDone;
      return 'Gemini answer';
    });
    const service = createAgentRunService({
      adapters: {
        openai: { model: 'openai-test', run: openaiRun },
        gemini: { model: 'gemini-test', run: geminiRun },
      },
    });

    const run = service.run({ task: 'Compare two approaches', providers: ['gemini', 'openai'], timeout_ms: 1000 });
    await Promise.resolve();
    expect(openaiRun).toHaveBeenCalledTimes(1);
    expect(geminiRun).toHaveBeenCalledTimes(1);

    releaseOpenAI();
    releaseGemini();
    const result = await run;

    expect(result.status).toBe('completed');
    expect(result.results.map((item) => item.provider)).toEqual(['gemini', 'openai']);
    expect(result.results.every((item) => item.status === 'completed')).toBe(true);
  });

  it('does not cancel a successful provider when another provider fails', async () => {
    const service = createAgentRunService({
      adapters: {
        openai: { model: 'openai-test', run: async () => 'Useful answer' },
        anthropic: { model: 'anthropic-test', run: async () => { throw new ProviderError('anthropic', 'Provider request failed (503)'); } },
      },
    });

    const result = await service.run({ task: 'Summarize', providers: ['openai', 'anthropic'], timeout_ms: 1000 });

    expect(result.status).toBe('completed');
    expect(result.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: 'openai', status: 'completed', output: 'Useful answer' }),
        expect.objectContaining({ provider: 'anthropic', status: 'failed', error: 'Provider request failed (503)' }),
      ])
    );
  });

  it('hides the message of unexpected (non-provider) errors', async () => {
    const service = createAgentRunService({
      adapters: {
        openai: { model: 'openai-test', run: async () => { throw new TypeError('connect ECONNREFUSED 10.0.0.5:443'); } },
        gemini: { model: 'gemini-test', run: async () => 'ok' },
      },
    });

    const result = await service.run({ task: 'Summarize', providers: ['openai', 'gemini'], timeout_ms: 1000 });

    expect(result.results[0]).toEqual(
      expect.objectContaining({ provider: 'openai', status: 'failed', error: 'Provider request failed' })
    );
    expect(JSON.stringify(result)).not.toContain('ECONNREFUSED');
  });

  it('reports an unconfigured provider without exposing credentials', async () => {
    const service = createAgentRunService({ adapters: {} });

    const result = await service.run({ task: 'Plan a release', providers: ['openai', 'gemini'], timeout_ms: 1000 });

    expect(result.status).toBe('failed');
    expect(result.results).toEqual([
      expect.objectContaining({ provider: 'openai', status: 'unavailable', error: 'Provider is not configured' }),
      expect.objectContaining({ provider: 'gemini', status: 'unavailable', error: 'Provider is not configured' }),
    ]);
  });

  it('listModels reports every supported provider and only enabled ones have a model', () => {
    const service = createAgentRunService({
      adapters: { anthropic: { model: 'claude-test', run: async () => 'x' } },
    });

    expect(service.listModels()).toEqual([
      { provider: 'openai', enabled: false, model: null },
      { provider: 'anthropic', enabled: true, model: 'claude-test' },
      { provider: 'gemini', enabled: false, model: null },
    ]);
  });
});

describe('AgentRun timeout', () => {
  it('times out an adapter that honors the abort signal', async () => {
    let receivedSignal;
    const honoring = {
      model: 'honoring',
      run: ({ signal }) =>
        new Promise((_resolve, reject) => {
          receivedSignal = signal;
          signal.addEventListener('abort', () =>
            reject(new DOMException('This operation was aborted', 'AbortError'))
          );
        }),
    };
    const service = createAgentRunService({
      adapters: { openai: honoring, gemini: { model: 'fast', run: async () => 'done' } },
    });

    const result = await service.run({ task: 'Slow', providers: ['openai', 'gemini'], timeout_ms: 20 });

    expect(result.results[0]).toEqual(
      expect.objectContaining({ provider: 'openai', status: 'timed_out', error: 'Timed out' })
    );
    expect(result.results[1]).toEqual(expect.objectContaining({ provider: 'gemini', status: 'completed' }));
    expect(receivedSignal.aborted).toBe(true);
  });

  it('times out an adapter that ignores the abort signal', async () => {
    let receivedSignal;
    const ignoring = {
      model: 'ignoring',
      run: ({ signal }) => {
        receivedSignal = signal;
        return new Promise(() => {}); // never settles
      },
    };
    const service = createAgentRunService({ adapters: { anthropic: ignoring } });

    const startedAt = Date.now();
    const result = await service.run({ task: 'Hang', providers: ['anthropic', 'gemini'], timeout_ms: 20 });

    expect(Date.now() - startedAt).toBeLessThan(1000);
    expect(result.status).toBe('failed');
    expect(result.results[0]).toEqual(
      expect.objectContaining({ provider: 'anthropic', status: 'timed_out', error: 'Timed out' })
    );
    expect(receivedSignal.aborted).toBe(true);
  });

  it('clears the timer once the adapter finishes (signal is never aborted afterwards)', async () => {
    let receivedSignal;
    const service = createAgentRunService({
      adapters: {
        openai: {
          model: 'fast',
          run: async ({ signal }) => {
            receivedSignal = signal;
            return 'done';
          },
        },
      },
    });

    await service.run({ task: 'Quick', providers: ['openai', 'gemini'], timeout_ms: 20 });
    await wait(50);

    expect(receivedSignal.aborted).toBe(false);
  });
});

describe('AgentRun with the validated request body (regression: timeout_ms was ignored)', () => {
  const slowAdapter = (model) => ({
    model,
    run: async () => {
      await wait(50);
      return `${model} answer`;
    },
  });

  it('honors timeout_ms parsed by runSchema', async () => {
    const body = runSchema.body.parse({
      task: '  Compare  ',
      providers: ['openai', 'anthropic'],
      timeout_ms: '1500',
    });
    const service = createAgentRunService({
      adapters: { openai: slowAdapter('o'), anthropic: slowAdapter('a') },
    });

    const result = await service.run(body);

    expect(body.timeout_ms).toBe(1500);
    expect(result.status).toBe('completed');
    expect(result.results.map((item) => item.status)).toEqual(['completed', 'completed']);
  });

  it('applies the schema default when timeout_ms is omitted', async () => {
    const body = runSchema.body.parse({ task: 'Compare', providers: ['gemini', 'openai'] });
    const service = createAgentRunService({
      adapters: { gemini: slowAdapter('g'), openai: slowAdapter('o') },
    });

    const result = await service.run(body);

    expect(body.timeout_ms).toBe(45_000);
    expect(result.results.map((item) => item.status)).toEqual(['completed', 'completed']);
  });
});
