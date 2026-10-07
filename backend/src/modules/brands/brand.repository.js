'use strict';

const { prisma } = require('../../config/database');

const BRAND_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  logo_url: true,
  status: true,
  created_at: true,
  updated_at: true,
};

const notDeleted = { deleted_at: null };

function buildWhere({ q, status, publicOnly }) {
  const where = { ...notDeleted };
  if (q) where.name = { contains: q };
  if (status) where.status = status;
  // Khách chỉ thấy brand đang hoạt động; admin thấy tất cả.
  if (publicOnly) where.status = 'ACTIVE';
  return where;
}

async function findMany({ filters, skip, take, orderBy }) {
  const where = buildWhere(filters);
  const [items, total] = await Promise.all([
    prisma.brand.findMany({ where, skip, take, orderBy, select: BRAND_SELECT }),
    prisma.brand.count({ where }),
  ]);
  return { items, total };
}

const findById = (id, { publicOnly } = {}) =>
  prisma.brand.findFirst({
    where: { id, ...notDeleted, ...(publicOnly ? { status: 'ACTIVE' } : {}) },
    select: BRAND_SELECT,
  });

const findBySlug = (slug) =>
  prisma.brand.findFirst({ where: { slug, ...notDeleted }, select: { id: true } });

const findRawById = (id) => prisma.brand.findFirst({ where: { id, ...notDeleted } });

const countProducts = (brand_id) =>
  prisma.product.count({ where: { brand_id, deleted_at: null } });

const create = (data) => prisma.brand.create({ data, select: BRAND_SELECT });

const update = (id, data) => prisma.brand.update({ where: { id }, data, select: BRAND_SELECT });

const softDelete = (id) =>
  prisma.brand.update({ where: { id }, data: { deleted_at: new Date(), status: 'INACTIVE' } });

module.exports = {
  BRAND_SELECT,
  findMany,
  findById,
  findBySlug,
  findRawById,
  countProducts,
  create,
  update,
  softDelete,
};
