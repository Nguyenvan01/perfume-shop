'use strict';

const express = require('express');
const healthRoute = require('../modules/health/health.route');
const authRoute = require('../modules/auth/auth.route');
const userRoute = require('../modules/users/user.route');
const roleRoute = require('../modules/roles/role.route');
const permissionRoute = require('../modules/roles/permission.route');
const brandRoute = require('../modules/brands/brand.route');
const categoryRoute = require('../modules/categories/category.route');
const productRoute = require('../modules/products/product.route');
const variantRoute = require('../modules/product-variants/variant.route');
const inventoryRoute = require('../modules/inventory/inventory.route');
const customerRoute = require('../modules/customers/customer.route');

const router = express.Router();

router.use('/health', healthRoute);
router.use('/auth', authRoute);
router.use('/users', userRoute);
router.use('/roles', roleRoute);
router.use('/permissions', permissionRoute);
router.use('/brands', brandRoute);
router.use('/categories', categoryRoute);
router.use('/products', productRoute);
router.use('/variants', variantRoute);
router.use('/inventory', inventoryRoute);
router.use('/customers', customerRoute);

module.exports = router;
