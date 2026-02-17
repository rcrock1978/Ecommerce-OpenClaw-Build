import mongoose, { Document } from 'mongoose';
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
export declare const Product: mongoose.Model<IProduct, {}, {}, {}, mongoose.Document<unknown, {}, IProduct> & IProduct & {
    _id: mongoose.Types.ObjectId;
}, any>;
export declare const Category: mongoose.Model<ICategory, {}, {}, {}, mongoose.Document<unknown, {}, ICategory> & ICategory & {
    _id: mongoose.Types.ObjectId;
}, any>;
//# sourceMappingURL=Product.d.ts.map