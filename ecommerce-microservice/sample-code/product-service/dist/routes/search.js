"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const search_1 = require("../services/search");
const metrics_1 = require("../middleware/metrics");
const async_handler_1 = require("../utils/async-handler");
const errors_1 = require("../utils/errors");
const router = (0, express_1.Router)();
const searchService = new search_1.SearchService();
// Validation middleware
const handleValidationErrors = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        throw new errors_1.ValidationError('Validation failed', errors.array());
    }
    next();
};
// Search validation
const searchValidation = [
    (0, express_validator_1.query)('q')
        .isLength({ min: 1, max: 100 })
        .trim()
        .withMessage('Search query is required and must be 1-100 characters'),
    (0, express_validator_1.query)('category')
        .optional()
        .isMongoId(),
    (0, express_validator_1.query)('brand')
        .optional()
        .isLength({ max: 100 }),
    (0, express_validator_1.query)('minPrice')
        .optional()
        .isFloat({ min: 0 }),
    (0, express_validator_1.query)('maxPrice')
        .optional()
        .isFloat({ min: 0 }),
    (0, express_validator_1.query)('limit')
        .optional()
        .isInt({ min: 1, max: 50 })
        .toInt(),
    handleValidationErrors
];
// Routes
// GET /api/v1/search - Search products
router.get('/', searchValidation, metrics_1.metricsMiddleware, (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { q: query, category, brand, minPrice, maxPrice, limit = 20 } = req.query;
    const filters = {
        search: query,
        category,
        brand,
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
    };
    const result = await searchService.searchProducts(filters, { field: 'createdAt', order: 'desc' }, { limit });
    res.json({
        data: result.products,
        query,
        total: result.total,
        facets: {
            // In a real implementation, this would come from Elasticsearch aggregations
            categories: [],
            brands: [],
            price_ranges: []
        },
        _links: {
            self: req.originalUrl
        }
    });
}));
// GET /api/v1/search/suggestions - Get search suggestions
router.get('/suggestions', metrics_1.metricsMiddleware, (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { q: query, limit = 10 } = req.query;
    if (!query || typeof query !== 'string') {
        return res.json({ suggestions: [] });
    }
    const suggestions = await searchService.getSearchSuggestions(query, Number(limit));
    res.json({
        query,
        suggestions,
        _links: {
            self: req.originalUrl,
            search: `/api/v1/search?q=${encodeURIComponent(query)}`
        }
    });
}));
// GET /api/v1/search/filters - Get available filter options
router.get('/filters', metrics_1.metricsMiddleware, (0, async_handler_1.asyncHandler)(async (req, res) => {
    // In a real implementation, this would query Elasticsearch for aggregations
    // For now, return mock data
    const filters = {
        categories: [
            { id: 'electronics', name: 'Electronics', count: 150 },
            { id: 'clothing', name: 'Clothing', count: 89 },
            { id: 'books', name: 'Books', count: 45 }
        ],
        brands: [
            { name: 'Apple', count: 25 },
            { name: 'Samsung', count: 18 },
            { name: 'Nike', count: 12 }
        ],
        price_ranges: [
            { range: '0-50', label: '$0 - $50', count: 67 },
            { range: '50-100', label: '$50 - $100', count: 43 },
            { range: '100-200', label: '$100 - $200', count: 38 },
            { range: '200+', label: '$200+', count: 29 }
        ]
    };
    res.json({
        data: filters,
        _links: {
            self: req.originalUrl
        }
    });
}));
exports.default = router;
//# sourceMappingURL=search.js.map