'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { ok, paginated } = require('../../utils/response');
const service = require('./customer.service');

const list = asyncHandler(async (req, res) => paginated(res, await service.list(req.query)));

const detail = asyncHandler(async (req, res) => ok(res, await service.detail(req.params.id)));

const listOrders = asyncHandler(async (req, res) =>
  paginated(res, await service.listOrders(req.params.id, req.query))
);

const setStatus = asyncHandler(async (req, res) =>
  ok(res, await service.setStatus(req.params.id, req.body.status, req.user.id), 'Status updated')
);

module.exports = { list, detail, listOrders, setStatus };
