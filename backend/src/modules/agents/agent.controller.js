'use strict';

const env = require('../../config/env');
const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/response');
const { createConfiguredAdapters } = require('./agent.provider');
const { createAgentRunService } = require('./agent.service');

const agentRunService = createAgentRunService({ adapters: createConfiguredAdapters(env) });

const listModels = asyncHandler(async (_req, res) => ok(res, agentRunService.listModels()));

const run = asyncHandler(async (req, res) =>
  ok(res, await agentRunService.run(req.body), 'Agent run finished')
);

module.exports = { listModels, run };
