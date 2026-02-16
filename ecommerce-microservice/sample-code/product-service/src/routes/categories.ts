import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Category, ICategory } from '../models/Product';
import { requirePermission } from '../middleware/auth';
import { metricsMiddleware } from '../middleware/metrics';
import { asyncHandler } from '../utils/async-handler';
import { ValidationError, NotFoundError, ConflictError } from '../utils/errors';

const router = Router();

// Validation middleware
const handleValidationErrors = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }
  next();
};

// Create category validation
const createCategoryValidation = [
  body('name')
    .isLength({ min: 1, max: 100 })
    .trim()
    .withMessage('Name is required and must be 1-100 characters'),
  body('slug')
    .optional()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug must be lowercase letters, numbers, and hyphens only'),
  body('parentId')
    .optional()
    .isMongoId()
    .withMessage('Parent ID must be a valid ObjectId'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be max 500 characters'),
  handleValidationErrors
];

// Update category validation
const updateCategoryValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid category ID'),
  body('name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .trim(),
  body('isActive')
    .optional()
    .isBoolean(),
  handleValidationErrors
];

// Routes

// GET /api/v1/categories/tree - Get category tree
router.get('/tree', metricsMiddleware, asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  // Build tree structure
  const categoryMap = new Map<string, any>();
  const roots: any[] = [];

  // First pass: create all nodes
  categories.forEach(cat => {
    categoryMap.set(cat._id.toString(), {
      id: cat._id.toString(),
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      level: cat.level,
      sortOrder: cat.sortOrder,
      imageUrl: cat.imageUrl,
      isActive: cat.isActive,
      productCount: cat.productCount,
      children: [],
    });
  });

  // Second pass: build hierarchy
  categories.forEach(cat => {
    const node = categoryMap.get(cat._id.toString());

    if (cat.parentId) {
      const parent = categoryMap.get(cat.parentId.toString());
      if (parent) {
        parent.children.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  res.json({
    data: roots,
    _links: {
      self: req.originalUrl
    }
  });
}));

// GET /api/v1/categories - List categories
router.get('/', metricsMiddleware, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, parentId, isActive } = req.query;

  const query: any = {};
  if (parentId !== undefined) query.parentId = parentId || null;
  if (isActive !== undefined) query.isActive = isActive === 'true';

  const skip = (Number(page) - 1) * Number(limit);
  const categories = await Category.find(query)
    .sort({ sortOrder: 1, name: 1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Category.countDocuments(query);

  res.json({
    data: categories,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      total_pages: Math.ceil(total / Number(limit)),
      has_next: skip + categories.length < total,
      has_prev: Number(page) > 1
    },
    _links: {
      self: req.originalUrl
    }
  });
}));

// POST /api/v1/categories - Create category
router.post('/', requirePermission('write:products'), createCategoryValidation, metricsMiddleware, asyncHandler(async (req, res) => {
  const { name, slug, description, parentId, imageUrl } = req.body;

  // Check if slug already exists
  const existingCategory = await Category.findOne({ slug });
  if (existingCategory) {
    throw new ConflictError(`Category with slug '${slug}' already exists`);
  }

  // Validate parent exists if provided
  if (parentId) {
    const parent = await Category.findById(parentId);
    if (!parent) {
      throw new NotFoundError('Parent category not found');
    }
  }

  const category = new Category({
    name,
    slug,
    description,
    parentId: parentId || undefined,
    imageUrl,
  });

  const savedCategory = await category.save();

  res.status(201).json({
    data: savedCategory,
    _links: {
      self: `${req.originalUrl}/${savedCategory._id}`,
      tree: '/api/v1/categories/tree'
    }
  });
}));

// GET /api/v1/categories/:id - Get category by ID
router.get('/:id', metricsMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const category = await Category.findById(id);

  if (!category) {
    throw new NotFoundError('Category not found');
  }

  res.json({
    data: category,
    _links: {
      self: req.originalUrl,
      tree: '/api/v1/categories/tree'
    }
  });
}));

// PUT /api/v1/categories/:id - Update category
router.put('/:id', requirePermission('write:products'), updateCategoryValidation, metricsMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const category = await Category.findById(id);
  if (!category) {
    throw new NotFoundError('Category not found');
  }

  // Check slug uniqueness if changing
  if (updates.slug && updates.slug !== category.slug) {
    const existingCategory = await Category.findOne({
      slug: updates.slug,
      _id: { $ne: id }
    });
    if (existingCategory) {
      throw new ConflictError(`Category with slug '${updates.slug}' already exists`);
    }
  }

  Object.assign(category, updates);
  const updatedCategory = await category.save();

  res.json({
    data: updatedCategory,
    _links: {
      self: req.originalUrl,
      tree: '/api/v1/categories/tree'
    }
  });
}));

// DELETE /api/v1/categories/:id - Delete category
router.delete('/:id', requirePermission('write:products'), metricsMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const category = await Category.findById(id);
  if (!category) {
    throw new NotFoundError('Category not found');
  }

  // Check if category has children
  const childrenCount = await Category.countDocuments({ parentId: id });
  if (childrenCount > 0) {
    throw new ConflictError('Cannot delete category with child categories');
  }

  // Check if category has products
  // Note: This would require a query to the Product collection
  // For now, we'll assume referential integrity is handled at application level

  await Category.findByIdAndDelete(id);

  res.status(204).send();
}));

export default router;