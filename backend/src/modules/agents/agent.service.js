'use strict';

const { randomUUID } = require('crypto');
const { PROVIDERS, TIMEOUT_MS } = require('./agent.constant');
const { ProviderError } = require('./agent.provider');

function messageFor(error) {
  if (error?.name === 'AbortError') return 'Timed out';
  // Only our own ProviderError messages are safe to return; anything else
  // (network errors, bugs) may carry internal detail.
  if (error instanceof ProviderError) return error.message;
  return 'Provider request failed';
}

function createTimeoutError() {
  const error = new Error('Timed out');
  error.name = 'AbortError';
  return error;
}

/**
 * Race the adapter against a timer so the deadline holds even if an adapter
 * ignores the abort signal. The signal is still aborted to stop the request.
 */
function runWithTimeout(adapter, task, timeoutMs) {
  const controller = new AbortController();
  const work = adapter.run({ task, signal: controller.signal });

  let timer;
  const deadline = new Promise((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(createTimeoutError());
      controller.abort();
    }, timeoutMs);
  });

  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}

/**
 * Deep module for a single multi-model run. Its interface stays deliberately
 * small: list the configured providers, or run one task against a selection.
 * Each adapter is isolated, so one provider failure never cancels the others.
 */
function createAgentRunService({ adapters, now = () => Date.now() }) {
  function listModels() {
    return PROVIDERS.map((provider) => ({
      provider,
      enabled: Boolean(adapters[provider]),
      model: adapters[provider]?.model || null,
    }));
  }

  /** Takes the validated request body (snake_case, like sibling services). */
  async function run({ task, providers, timeout_ms = TIMEOUT_MS.DEFAULT }) {
    const startedAt = now();
    const selected = providers.map((provider) => ({ provider, adapter: adapters[provider] }));

    const settled = await Promise.all(
      selected.map(async ({ provider, adapter }) => {
        if (!adapter) {
          return {
            provider,
            model: null,
            status: 'unavailable',
            error: 'Provider is not configured',
            duration_ms: 0,
          };
        }

        const providerStartedAt = now();
        try {
          const output = await runWithTimeout(adapter, task, timeout_ms);
          return {
            provider,
            model: adapter.model,
            status: 'completed',
            output,
            duration_ms: now() - providerStartedAt,
          };
        } catch (error) {
          return {
            provider,
            model: adapter.model,
            status: error?.name === 'AbortError' ? 'timed_out' : 'failed',
            error: messageFor(error),
            duration_ms: now() - providerStartedAt,
          };
        }
      })
    );

    return {
      id: randomUUID(),
      status: settled.some((result) => result.status === 'completed') ? 'completed' : 'failed',
      duration_ms: now() - startedAt,
      results: settled,
    };
  }

  return { listModels, run };
}

module.exports = { createAgentRunService };
