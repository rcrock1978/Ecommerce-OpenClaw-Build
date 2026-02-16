import mongoose, { Schema, Document } from 'mongoose';

// Interfaces
export interface IProduct extends Document {
  sku: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  categoryId: mongoose.Types.ObjectId;
  category?: ICategory;
  brand?: string;
  tags: string[];
  attributes: Record<string, any>;
  pricing: {
    currency: string;
    basePrice: number;
    salePrice?: number;
    saleStartsAt?: Date;
    saleEndsAt?: Date;
    costPrice?: number;
  };
  images: Array<{
    url: string;
    altText?: string;
    sortOrder: number;
    isPrimary: boolean;
  }>;
  variants: Array<{
    sku: string;
    name: string;
    attributes: Record<string, any>;
    priceOverride?: number;
    isActive: boolean;
  }>;
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    canonicalUrl?: string;
  };
  status: 'draft' | 'active' | 'archived';
  sellerId?: string;
  avgRating: number;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface ICategory extends Document {
  name: string;
  slug: string;
  description?: string;
  parentId?: mongoose.Types.ObjectId;
  path: string;
  level: number;
  sortOrder: number;
  imageUrl?: string;
  isActive: boolean;
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Product Schema
const productSchema = new Schema<IProduct>({
  sku: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255,
    index: 'text'
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  description: {
    type: String,
    maxlength: 5000
  },
  shortDescription: {
    type: String,
    maxlength: 500
  },
  categoryId: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
    index: true
  },
  brand: {
    type: String,
    trim: true,
    index: true
  },
  tags: [{
    type: String,
    trim: true,
    index: true
  }],
  attributes: {
    type: Schema.Types.Mixed,
    default: {}
  },
  pricing: {
    currency: {
      type: String,
      required: true,
      uppercase: true,
      default: 'USD'
    },
    basePrice: {
      type: Number,
      required: true,
      min: 0
    },
    salePrice: {
      type: Number,
      min: 0
    },
    saleStartsAt: Date,
    saleEndsAt: Date,
    costPrice: {
      type: Number,
      min: 0
    }
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    altText: String,
    sortOrder: {
      type: Number,
      default: 0
    },
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  variants: [{
    sku: {
      type: String,
      required: true,
      unique: true,
      uppercase: true
    },
    name: {
      type: String,
      required: true
    },
    attributes: {
      type: Schema.Types.Mixed,
      default: {}
    },
    priceOverride: Number,
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  seo: {
    metaTitle: String,
    metaDescription: String,
    canonicalUrl: String
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'archived'],
    default: 'draft',
    index: true
  },
  sellerId: {
    type: String,
    index: true
  },
  avgRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true,
  collection: 'products'
});

// Indexes
productSchema.index({ categoryId: 1, status: 1 });
productSchema.index({ sellerId: 1, status: 1 });
productSchema.index({ 'pricing.basePrice': 1 });
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ tags: 1 });
productSchema.index({ name: 'text', description: 'text', tags: 'text' }, {
  weights: { name: 10, tags: 5, description: 1 }
});

// Virtual for current price
productSchema.virtual('currentPrice').get(function() {
  const now = new Date();
  const { basePrice, salePrice, saleStartsAt, saleEndsAt } = this.pricing;

  if (salePrice && saleStartsAt && saleEndsAt) {
    if (now >= saleStartsAt && now <= saleEndsAt) {
      return salePrice;
    }
  }

  return basePrice;
});

// Instance methods
productSchema.methods.isOnSale = function(): boolean {
  const now = new Date();
  const { salePrice, saleStartsAt, saleEndsAt } = this.pricing;

  return !!(salePrice && saleStartsAt && saleEndsAt &&
           now >= saleStartsAt && now <= saleEndsAt);
};

productSchema.methods.getPrimaryImage = function() {
  return this.images.find(img => img.isPrimary) || this.images[0];
};

// Static methods
productSchema.statics.findBySku = function(sku: string) {
  return this.findOne({ sku: sku.toUpperCase() });
};

productSchema.statics.findActive = function() {
  return this.find({ status: 'active', deletedAt: { $exists: false } });
};

// Pre-save middleware
productSchema.pre('save', function(next) {
  // Generate slug from name if not provided
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  // Ensure only one primary image
  if (this.isModified('images')) {
    const primaryImages = this.images.filter(img => img.isPrimary);
    if (primaryImages.length > 1) {
      // Set first as primary, others as not
      this.images.forEach((img, index) => {
        img.isPrimary = index === 0;
      });
    }
  }

  next();
});

// Category Schema
const categorySchema = new Schema<ICategory>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  description: String,
  parentId: {
    type: Schema.Types.ObjectId,
    ref: 'Category'
  },
  path: {
    type: String,
    required: true,
    index: true
  },
  level: {
    type: Number,
    required: true,
    min: 0,
    index: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  imageUrl: String,
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  productCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true,
  collection: 'categories'
});

// Indexes
categorySchema.index({ parentId: 1 });
categorySchema.index({ path: 1 });

// Virtual for children
categorySchema.virtual('children', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parentId'
});

// Pre-save middleware for path generation
categorySchema.pre('save', async function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  // Generate path
  if (this.parentId) {
    const parent = await Category.findById(this.parentId);
    if (parent) {
      this.path = `${parent.path}/${this.slug}`;
      this.level = parent.level + 1;
    }
  } else {
    this.path = `/${this.slug}`;
    this.level = 0;
  }

  next();
});

// Models
export const Product = mongoose.model<IProduct>('Product', productSchema);
export const Category = mongoose.model<ICategory>('Category', categorySchema);