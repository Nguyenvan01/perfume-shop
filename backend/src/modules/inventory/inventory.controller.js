'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { ok, created, paginated } = require('../../utils/response');
const { INVENTORY_TYPES } = require('./inventory.constant');
const service = require('./inventory.service');

const list = asyncHandler(async (req, res) => paginated(res, await service.list(req.query)));

const summary = asyncHandler(async (_req, res) => ok(res, await service.summary()));

const lowStock = asyncHandler(async (req, res) => paginated(res, await service.lowStock(req.query)));

const importStock = asyncHandler(async (req, res) =>
  created(
    res,
    {
      transactions: await service.createBulkMovement({
        type: INVENTORY_TYPES.IMPORT,
        items: req.body.items,
        note: req.body.note,
        userId: req.user.id,
      }),
    },
    'Stock imported'
  )
);

const exportStock = asyncHandler(async (req, res) =>
  created(
    res,
    {
      transactions: await service.createBulkMovement({
        type: INVENTORY_TYPES.EXPORT,
        items: req.body.items,
        note: req.body.note,
        userId: req.user.id,
      }),
    },
    'Stock exported'
  )
);

const adjust = asyncHandler(async (req, res) =>
  created(
    res,
    { transaction: await service.createAdjustment({ ...req.body, userId: req.user.id }) },
    'Stock adjusted'
  )
);

const transactions = asyncHandler(async (req, res) =>
  paginated(res, await service.listTransactions(req.query))
);

module.exports = { list, summary, lowStock, importStock, exportStock, adjust, transactions };
