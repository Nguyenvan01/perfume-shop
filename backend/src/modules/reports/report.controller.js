'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/response');
const service = require('./report.service');

const dashboard = asyncHandler(async (req, res) => ok(res, await service.dashboard(req.query)));
const revenue = asyncHandler(async (req, res) => ok(res, await service.revenue(req.query)));
const topProducts = asyncHandler(async (req, res) => ok(res, await service.topProducts(req.query)));
const revenueByBrand = asyncHandler(async (req, res) =>
  ok(res, await service.revenueByBrand(req.query))
);
const orderStatus = asyncHandler(async (req, res) => ok(res, await service.orderStatus(req.query)));
const lowStock = asyncHandler(async (req, res) => ok(res, await service.lowStock(req.query)));

module.exports = { dashboard, revenue, topProducts, revenueByBrand, orderStatus, lowStock };
