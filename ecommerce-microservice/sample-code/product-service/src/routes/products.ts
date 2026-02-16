import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { ProductService } from '../services/ProductService';
import { EventPublisher } from '../services/event-publisher';
import { CacheService } from '../services/cache';
import { SearchService } from '../services/search';
import { requirePermission } from '../middleware/auth';
import { metricsMiddleware } from '../middleware/metrics';
import { asyncHandler } from '../utils/async-handler';
import { ValidationError } from '../utils/errors';

const router = Router();

// Initialize services
const eventPublisher = new EventPublisher();
const cacheService = new CacheService();
const searchService = new SearchService();
const productService = new ProductService(eventPublisher, cacheService, searchService);

// Validation middleware
const handleValidationErrors = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }
  next();
};

// Create product validation
const createProductValidation = [
  body('sku')
    .isLength({ min: 1, max: 100 })
    .matches(/^[A-Z0-9-_]+$/)
    .withMessage('SKU must be 1-100 characters, uppercase letters, numbers, hyphens, and underscores only'),
  body('name')
    .isLength({ min: 1, max: 255 })
    .trim()
    .withMessage('Name is required and must be 1-255 characters'),
  body('description')
    .optional()
    .isLength({ max: 5000 })
    .withMessage('Description must be max 5000 characters'),
  body('shortDescription')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Short description must be max 500 characters'),
  body('categoryId')
    .isMongoId()
    .withMessage('Valid category ID is required'),
  body('brand')
    .optional()
    .isLength({ max: 100 })
    .trim(),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .isLength({ min: 1, max: 50 })
    .trim(),
  body('pricing.basePrice')
    .isFloat({ min: 0 })
    .withMessage('Base price must be a positive number'),
  body('pricing.currency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .isUppercase()
    .withMessage('Currency must be a 3-letter uppercase code'),
  body('pricing.salePrice')
    .optional()
    .isFloat({ min: 0 })
    .custom((value, { req }) => {
      if (value && value >= req.body.pricing.basePrice) {
        throw new Error('Sale price must be less than base price');
      }
      return true;
    }),
  body('images')
    .optional()
    .isArray(),
  body('images.*.url')
    .isURL()
    .withMessage('Image URL must be valid'),
  body('variants')
    .optional()
    .isArray(),
  body('variants.*.sku')
    .matches(/^[A-Z0-9-_]+$/)
    .withMessage('Variant SKU format is invalid'),
  handleValidationErrors
];

// Update product validation
const updateProductValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid product ID'),
  body('sku')
    .optional()
    .isLength({ min: 1, max: 100 })
    .matches(/^[A-Z0-9-_]+$/)
    .withMessage('SKU format is invalid'),
  body('name')
    .optional()
    .isLength({ min: 1, max: 255 })
    .trim(),
  body('status')
    .optional()
    .isIn(['draft', 'active', 'archived']),
  handleValidationErrors
];

// List products validation
const listProductsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .toInt(),
  query('category')
    .optional()
    .isMongoId(),
  query('brand')
    .optional()
    .isLength({ max: 100 }),
  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .toFloat(),
  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .toFloat(),
  query('status')
    .optional()
    .isIn(['draft', 'active', 'archived']),
  query('sort')
    .optional()
    .isIn(['name', 'createdAt', 'price', 'rating']),
  query('order')
    .optional()
    .isIn(['asc', 'desc']),
  handleValidationErrors
];

// Routes

// GET /api/v1/products - List products
router.get('/', listProductsValidation, metricsMiddleware, asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    category,
    brand,
    minPrice,
    maxPrice,
    status,
    tags,
    search,
    sort = 'createdAt',
    order = 'desc'
  } = req.query;

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
    field: sort as any,
    order: order as any
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
router.post('/', requirePermission('write:products'), createProductValidation, metricsMiddleware, asyncHandler(async (req, res) => {
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
router.get('/:id', metricsMiddleware, asyncHandler(async (req, res) => {
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
    } catch (error) {
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
router.put('/:id', requirePermission('write:products'), updateProductValidation, metricsMiddleware, asyncHandler(async (req, res) => {
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
router.delete('/:id', requirePermission('write:products'), metricsMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  await productService.deleteProduct(id);

  res.status(204).send();
}));

// GET /api/v1/products/:id/variants - Get product variants
router.get('/:id/variants', metricsMiddleware, asyncHandler(async (req, res) => {
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

export default router;