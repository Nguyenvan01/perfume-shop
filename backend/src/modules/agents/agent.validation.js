'use strict';

const { z } = require('../../utils/validation');
const { PROVIDERS, TASK_MAX_LENGTH, TIMEOUT_MS } = require('./agent.constant');

const providerSchema = z.enum(PROVIDERS);

const runSchema = {
  body: z
    .object({
      task: z.string().trim().min(1).max(TASK_MAX_LENGTH),
      providers: z.array(providerSchema).min(2).max(PROVIDERS.length),
      timeout_ms: z.coerce
        .number()
        .int()
        .min(TIMEOUT_MS.MIN)
        .max(TIMEOUT_MS.MAX)
        .default(TIMEOUT_MS.DEFAULT),
    })
    .refine((data) => new Set(data.providers).size === data.providers.length, {
      message: 'providers must not contain duplicates',
      path: ['providers'],
    }),
};

module.exports = { runSchema };
