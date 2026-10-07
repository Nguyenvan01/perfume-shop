'use strict';

/** Dấu của từng loại giao dịch kho (CLAUDE.md §7). */
const INVENTORY_TYPES = {
  IMPORT: 'IMPORT',
  EXPORT: 'EXPORT',
  SALE: 'SALE',
  RETURN: 'RETURN',
  ADJUSTMENT: 'ADJUSTMENT',
};

/** Loại làm tăng tồn kho; còn lại làm giảm (ADJUSTMENT đi cả hai chiều). */
const INCREASING_TYPES = [INVENTORY_TYPES.IMPORT, INVENTORY_TYPES.RETURN];
const DECREASING_TYPES = [INVENTORY_TYPES.EXPORT, INVENTORY_TYPES.SALE];

const SORTABLE = ['stock_quantity', 'sku', 'created_at'];

module.exports = { INVENTORY_TYPES, INCREASING_TYPES, DECREASING_TYPES, SORTABLE };
