"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const ProductService_1 = require("../services/ProductService");
const event_publisher_1 = require("../services/event-publisher");
const cache_1 = require("../services/cache");
const search_1 = require("../services/search");
const auth_1 = require("../middleware/auth");
const metrics_1 = require("../middleware/metrics");
const async_handler_1 = require("../utils/async-handler");
const errors_1 = require("../utils/errors");
const router = (0, express_1.Router)();
// Initialize services
const eventPublisher = new event_publisher_1.EventPublisher();
const cacheService = new cache_1.CacheService();
const searchService = new search_1.SearchService();
const productService = new ProductService_1.ProductService(eventPublisher, cacheService, searchService);
// Validation middleware
const handleValidationErrors = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        throw new errors_1.ValidationError('Validation failed', errors.array());
    }
    next();
};
// Create product validation
const createProductValidation = [
    (0, express_validator_1.body)('sku')
        .isLength({ min: 1, max: 100 })
        .matches(/^[A-Z0-9-_]+$/)
        .withMessage('SKU must be 1-100 characters, uppercase letters, numbers, hyphens, and underscores only'),
    (0, express_validator_1.body)('name')
        .isLength({ min: 1, max: 255 })
        .trim()
        .withMessage('Name is required and must be 1-255 characters'),
    (0, express_validator_1.body)('description')
        .optional()
        .isLength({ max: 5000 })
        .withMessage('Description must be max 5000 characters'),
    (0, express_validator_1.body)('shortDescription')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Short description must be max 500 characters'),
    (0, express_validator_1.body)('categoryId')
        .isMongoId()
        .withMessage('Valid category ID is required'),
    (0, express_validator_1.body)('brand')
        .optional()
        .isLength({ max: 100 })
        .trim(),
    (0, express_validator_1.body)('tags')
        .optional()
        .isArray()
        .withMessage('Tags must be an array'),
    (0, express_validator_1.body)('tags.*')
        .isLength({ min: 1, max: 50 })
        .trim(),
    (0, express_validator_1.body)('pricing.basePrice')
        .isFloat({ min: 0 })
        .withMessage('Base price must be a positive number'),
    (0, express_validator_1.body)('pricing.currency')
        .optional()
        .isLength({ min: 3, max: 3 })
        .isUppercase()
        .withMessage('Currency must be a 3-letter uppercase code'),
    (0, express_validator_1.body)('pricing.salePrice')
        .optional()
        .isFloat({ min: 0 })
        .custom((value, { req }) => {
        if (value && value >= req.body.pricing.basePrice) {
            throw new Error('Sale price must be less than base price');
        }
        return true;
    }),
    (0, express_validator_1.body)('images')
        .optional()
        .isArray(),
    (0, express_validator_1.body)('images.*.url')
        .isURL()
        .withMessage('Image URL must be valid'),
    (0, express_validator_1.body)('variants')
        .optional()
        .isArray(),
    (0, express_validator_1.body)('variants.*.sku')
        .matches(/^[A-Z0-9-_]+$/)
        .withMessage('Variant SKU format is invalid'),
    handleValidationErrors
];
// Update product validation
const updateProductValidation = [
    (0, express_validator_1.param)('id')
        .isMongoId()
        .withMessage('Invalid product ID'),
    (0, express_validator_1.body)('sku')
        .optional()
        .isLength({ min: 1, max: 100 })
        .matches(/^[A-Z0-9-_]+$/)
        .withMessage('SKU format is invalid'),
    (0, express_validator_1.body)('name')
        .optional()
        .isLength({ min: 1, max: 255 })
        .trim(),
    (0, express_validator_1.body)('status')
        .optional()
        .isIn(['draft', 'active', 'archived']),
    handleValidationErrors
];
// List products validation
const listProductsValidation = [
    (0, express_validator_1.query)('page')
        .optional()
        .isInt({ min: 1 })
        .toInt(),
    (0, express_validator_1.query)('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .toInt(),
    (0, express_validator_1.query)('category')
        .optional()
        .isMongoId(),
    (0, express_validator_1.query)('brand')
        .optional()
        .isLength({ max: 100 }),
    (0, express_validator_1.query)('minPrice')
        .optional()
        .isFloat({ min: 0 })
        .toFloat(),
    (0, express_validator_1.query)('maxPrice')
        .optional()
        .isFloat({ min: 0 })
        .toFloat(),
    (0, express_validator_1.query)('status')
        .optional()
        .isIn(['draft', 'active', 'archived']),
    (0, express_validator_1.query)('sort')
        .optional()
        .isIn(['name', 'createdAt', 'price', 'rating']),
    (0, express_validator_1.query)('order')
        .optional()
        .isIn(['asc', 'desc']),
    handleValidationErrors
];
// Routes
// GET /api/v1/products - List products
router.get('/', listProductsValidation, metrics_1.metricsMiddleware, (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 20, category, brand, minPrice, maxPrice, status, tags, search, sort = 'createdAt', order = 'desc' } = req.query;
    const filters = {
        category,
        brand,
        minPrice,
        maxPrice,
        status,
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
        search
    };
    const sortOptions = {
        field: sort,
        order: order
    };
    const pagination = {
        page: Number(page),
        limit: Number(limit)
    };
    const result = await productService.searchProducts(filters, sortOptions, pagination);
    res.json({
        data: result.products,
        pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total: result.total,
            total_pages: Math.ceil(result.total / pagination.limit),
            has_next: result.hasNext,
            has_prev: pagination.page > 1
        },
        _links: {
            self: req.originalUrl,
            next: result.hasNext ? `${req.path}?page=${pagination.page + 1}&limit=${pagination.limit}` : null,
            prev: pagination.page > 1 ? `${req.path}?page=${pagination.page - 1}&limit=${pagination.limit}` : null
        }
    });
}));
// POST /api/v1/products - Create product
router.post('/', (0, auth_1.requirePermission)('write:products'), createProductValidation, metrics_1.metricsMiddleware, (0, async_handler_1.asyncHandler)(async (req, res) => {
    const product = await productService.createProduct(req.body);
    res.status(201).json({
        data: product,
        _links: {
            self: `${req.originalUrl}/${product._id}`,
            category: `/api/v1/categories/${product.categoryId}`
        }
    });
}));
// GET /api/v1/products/:id - Get product by ID
router.get('/:id', metrics_1.metricsMiddleware, (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        // Try SKU lookup
        try {
            const product = await productService.getProductBySku(id);
            return res.json({
                data: product,
                _links: {
                    self: req.originalUrl,
                    category: `/api/v1/categories/${product.categoryId}`
                }
            });
        }
        catch (error) {
            // Continue to ID lookup
        }
    }
    const product = await productService.getProductById(id);
    res.json({
        data: product,
        _links: {
            self: req.originalUrl,
            category: `/api/v1/categories/${product.categoryId}`
        }
    });
}));
// PUT /api/v1/products/:id - Update product
router.put('/:id', (0, auth_1.requirePermission)('write:products'), updateProductValidation, metrics_1.metricsMiddleware, (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const product = await productService.updateProduct(id, req.body);
    res.json({
        data: product,
        _links: {
            self: req.originalUrl,
            category: `/api/v1/categories/${product.categoryId}`
        }
    });
}));
// DELETE /api/v1/products/:id - Delete product
router.delete('/:id', (0, auth_1.requirePermission)('write:products'), metrics_1.metricsMiddleware, (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    await productService.deleteProduct(id);
    res.status(204).send();
}));
// GET /api/v1/products/:id/variants - Get product variants
router.get('/:id/variants', metrics_1.metricsMiddleware, (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const product = await productService.getProductById(id);
    res.json({
        data: product.variants,
        _links: {
            self: req.originalUrl,
            product: `/api/v1/products/${id}`
        }
    });
}));
exports.default = router;
//# sourceMappingURL=products.js.map