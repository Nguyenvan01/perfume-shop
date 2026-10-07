'use strict';

const { prisma } = require('../../config/database');

const PROMOTION_SELECT = {
  id: true,
  code: true,
  name: true,
  discount_type: true,
  discount_value: true,
  minimum_order_value: true,
  max_discount: true,
  start_date: true,
  end_date: true,
  usage_limit: true,
  per_customer_limit: true,
  used_count: true,
  status: true,
};

const findByCode = (code, client = prisma) =>
  client.promotion.findUnique({ where: { code }, select: PROMOTION_SELECT });

/**
 * Khóa dòng promotion để đếm lượt dùng không bị race: hai khách dùng mã cuối
 * cùng lúc sẽ xếp hàng, chỉ một người lấy được lượt cuối.
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 */
async function lockByCodeForUpdate(tx, code) {
  const rows = await tx.$queryRaw`
    SELECT id, code, discount_type, discount_value, minimum_order_value, max_discount,
           start_date, end_date, usage_limit, per_customer_limit, used_count, status
    FROM promotions
    WHERE code = ${code}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

const countCustomerUsage = (promotion_id, customer_id, client = prisma) =>
  client.promotionUsage.count({ where: { promotion_id, customer_id } });

const createUsage = (tx, data) => tx.promotionUsage.create({ data });

const incrementUsedCount = (tx, id, by = 1) =>
  tx.promotion.update({ where: { id }, data: { used_count: { increment: by } } });

const deleteUsageByOrder = (tx, order_id) =>
  tx.promotionUsage.deleteMany({ where: { order_id } });


// ─── CRUD (W6) ───

const notDeleted = {};

function buildWhere({ q, status, active_only }, now = new Date()) {
  const where = { ...notDeleted };
  if (q) where.OR = [{ code: { contains: q } }, { name: { contains: q } }];
  if (status) where.status = status;
  // active_only: đang hiệu lực NGAY LÚC NÀY, không chỉ status ACTIVE.
  if (active_only) {
    where.status = 'ACTIVE';
    where.start_date = { lte: now };
    where.end_date = { gte: now };
  }
  return where;
}

async function findMany({ filters, skip, take, orderBy }) {
  const where = buildWhere(filters);
  const [items, total] = await Promise.all([
    prisma.promotion.findMany({ where, skip, take, orderBy, select: PROMOTION_SELECT }),
    prisma.promotion.count({ where }),
  ]);
  return { items, total };
}

const findById = (id) =>
  prisma.promotion.findUnique({
    where: { id },
    select: { ...PROMOTION_SELECT, created_at: true, updated_at: true, _count: { select: { usages: true } } },
  });

const create = (data) => prisma.promotion.create({ data, select: PROMOTION_SELECT });

const update = (id, data) => prisma.promotion.update({ where: { id }, data, select: PROMOTION_SELECT });

const remove = (id) => prisma.promotion.delete({ where: { id } });

const countUsages = (promotion_id) => prisma.promotionUsage.count({ where: { promotion_id } });

module.exports = {
  PROMOTION_SELECT,
  findByCode,
  lockByCodeForUpdate,
  countCustomerUsage,
  createUsage,
  incrementUsedCount,
  deleteUsageByOrder,
  findMany,
  findById,
  create,
  update,
  remove,
  countUsages,
};
