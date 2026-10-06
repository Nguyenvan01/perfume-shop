'use strict';

const { checkDatabaseConnection } = require('../../config/database');
const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/response');
const pkg = require('../../../package.json');

const getHealth = asyncHandler(async (_req, res) => {
  let db = 'up';
  try {
    await checkDatabaseConnection();
  } catch {
    db = 'down';
  }

  return ok(
    res,
    {
      status: db === 'up' ? 'ok' : 'degraded',
      db,
      uptime: Math.round(process.uptime()),
      version: pkg.version,
    },
    'Service is healthy'
  );
});

module.exports = { getHealth };
