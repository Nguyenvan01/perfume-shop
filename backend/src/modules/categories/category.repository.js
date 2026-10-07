'use strict';

const { prisma } = require('../../config/database');

const CATEGORY_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  status: true,
  created_at: true,
  updated_at: true,
};

const notDeleted = { deleted_at: null };

function buildWhere({ q, status, publicOnly }) {
  const where = { ...notDeleted };
  if (q) where.name = { contains: q };
  if (status) where.status = status;
  if (publicOnly) where.status = 'ACTIVE';
  return where;
}

async function findMany({ filters, skip, take, orderBy }) {
  const where = buildWhere(filters);
  const [items, total] = await Promise.all([
    prisma.category.findMany({ where, skip, take, orderBy, select: CATEGORY_SELECT }),
    prisma.category.count({ where }),
  ]);
  return { items, total };
}

const findById = (id, { publicOnly } = {}) =>
  prisma.category.findFirst({
    where: { id, ...notDeleted, ...(publicOnly ? { status: 'ACTIVE' } : {}) },
    select: CATEGORY_SELECT,
  });

const findBySlug = (slug) =>
  prisma.category.findFirst({ where: { slug, ...notDeleted }, select: { id: true } });

const countProducts = (category_id) =>
  prisma.product.count({ where: { category_id, deleted_at: null } });

const create = (data) => prisma.category.create({ data, select: CATEGORY_SELECT });

const update = (id, data) =>
  prisma.category.update({ where: { id }, data, select: CATEGORY_SELECT });

const softDelete = (id) =>
  prisma.category.update({ where: { id }, data: { deleted_at: new Date(), status: 'INACTIVE' } });

module.exports = {
  CATEGORY_SELECT,
  findMany,
  findById,
  findBySlug,
  countProducts,
  create,
  update,
  softDelete,
};
