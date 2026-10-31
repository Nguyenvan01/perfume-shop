'use strict';

const PROVIDERS = ['openai', 'anthropic', 'gemini'];

/** Same instruction for every provider so their answers are comparable. */
const SYSTEM_PROMPT =
  'Answer the task directly. Do not claim to execute tools or make external changes.';

/** Per-provider output cap, so one run has a bounded cost. */
const MAX_OUTPUT_TOKENS = 2048;

const TASK_MAX_LENGTH = 12_000;

const TIMEOUT_MS = { MIN: 1_000, MAX: 120_000, DEFAULT: 45_000 };

/** Each run calls several paid APIs at once, so it is limited per admin user. */
const RUN_RATE_LIMIT = { windowMs: 60 * 1000, limit: 5 };

module.exports = {
  PROVIDERS,
  SYSTEM_PROMPT,
  MAX_OUTPUT_TOKENS,
  TASK_MAX_LENGTH,
  TIMEOUT_MS,
  RUN_RATE_LIMIT,
};
