'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { ok, created, paginated } = require('../../utils/response');
const service = require('./order.service');

const isStaffRequest = (req) => req.user.roles.some((role) => ['ADMIN', 'STAFF'].includes(role));

const create = asyncHandler(async (req, res) =>
  created(res, await service.createOrder(req.user.id, req.body), 'Order created')
);

const myOrders = asyncHandler(async (req, res) =>
  paginated(res, await service.listMyOrders(req.user.id, req.query))
);

const list = asyncHandler(async (req, res) => paginated(res, await service.list(req.query)));

const detail = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.detail(req.params.id, { userId: req.user.id, isStaff: isStaffRequest(req) })
  )
);

const cancel = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.cancel(req.params.id, {
      userId: req.user.id,
      isStaff: isStaffRequest(req),
      reason: req.body.reason,
    }),
    'Order cancelled'
  )
);

const changeStatus = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.changeStatus(req.params.id, req.body.status, {
      userId: req.user.id,
      isStaff: true,
      note: req.body.note,
    }),
    'Order status updated'
  )
);

const processReturn = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.processReturn(req.params.id, { userId: req.user.id, reason: req.body.reason }),
    'Order returned'
  )
);

const updatePayment = asyncHandler(async (req, res) =>
  ok(res, await service.updatePaymentStatus(req.params.id, req.body.status), 'Payment updated')
);

const invoice = asyncHandler(async (req, res) => ok(res, await service.invoice(req.params.id)));

module.exports = {
  create,
  myOrders,
  list,
  detail,
  cancel,
  changeStatus,
  processReturn,
  updatePayment,
  invoice,
};
