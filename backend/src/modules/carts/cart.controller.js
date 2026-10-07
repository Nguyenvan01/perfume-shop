'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/response');
const service = require('./cart.service');

const getCart = asyncHandler(async (req, res) => ok(res, await service.getCart(req.user.id)));

const addItem = asyncHandler(async (req, res) =>
  ok(res, await service.addItem(req.user.id, req.body), 'Item added to cart')
);

const updateItem = asyncHandler(async (req, res) =>
  ok(res, await service.updateItem(req.user.id, req.params.itemId, req.body.quantity), 'Cart updated')
);

const removeItem = asyncHandler(async (req, res) =>
  ok(res, await service.removeItem(req.user.id, req.params.itemId), 'Item removed from cart')
);

const clear = asyncHandler(async (req, res) =>
  ok(res, await service.clear(req.user.id), 'Cart cleared')
);

const preview = asyncHandler(async (req, res) =>
  ok(res, await service.preview(req.user.id, req.body))
);

module.exports = { getCart, addItem, updateItem, removeItem, clear, preview };
