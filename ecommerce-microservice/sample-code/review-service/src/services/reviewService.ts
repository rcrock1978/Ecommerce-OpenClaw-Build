import { ReviewModel } from '../models/review';
import { Review, CreateReviewRequest, UpdateReviewRequest, ReviewFilters, ProductRatingSummary } from '../types';
import logger from '../utils/logger';

export class ReviewService {
  async createReview(request: CreateReviewRequest): Promise<Review> {
    // Check if user already reviewed this product
    const existingReview = await ReviewModel.findOne({
      productId: request.productId,
      userId: request.userId,
    });

    if (existingReview) {
      throw new Error('User has already reviewed this product');
    }

    const review = new ReviewModel({
      ...request,
      verified: !!request.orderId, // Verified if from an order
      moderated: false,
      moderationStatus: 'pending',
      helpful: 0,
    });

    const saved = await review.save();

    logger.info('Review created', { reviewId: saved._id, productId: request.productId, userId: request.userId });

    return {
      id: saved._id.toString(),
      productId: saved.productId,
      userId: saved.userId,
      orderId: saved.orderId,
      rating: saved.rating,
      title: saved.title,
      comment: saved.comment,
      images: saved.images,
      verified: saved.verified,
      moderated: saved.moderated,
      moderationStatus: saved.moderationStatus,
      moderationNotes: saved.moderationNotes,
      helpful: saved.helpful,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }

  async getReview(reviewId: string): Promise<Review | null> {
    const review = await ReviewModel.findById(reviewId);
    if (!review) return null;

    return {
      id: review._id.toString(),
      productId: review.productId,
      userId: review.userId,
      orderId: review.orderId,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      images: review.images,
      verified: review.verified,
      moderated: review.moderated,
      moderationStatus: review.moderationStatus,
      moderationNotes: review.moderationNotes,
      helpful: review.helpful,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    };
  }

  async updateReview(reviewId: string, userId: string, updates: UpdateReviewRequest): Promise<Review> {
    const review = await ReviewModel.findOne({ _id: reviewId, userId });
    if (!review) {
      throw new Error('Review not found or not owned by user');
    }

    if (review.moderated) {
      throw new Error('Cannot update moderated review');
    }

    Object.assign(review, updates);
    await review.save();

    logger.info('Review updated', { reviewId, userId });

    return await this.getReview(reviewId)!;
  }

  async deleteReview(reviewId: string, userId: string): Promise<void> {
    const review = await ReviewModel.findOneAndDelete({ _id: reviewId, userId });
    if (!review) {
      throw new Error('Review not found or not owned by user');
    }

    logger.info('Review deleted', { reviewId, userId });
  }

  async getProductReviews(productId: string, filters: ReviewFilters = {}): Promise<Review[]> {
    const query: any = { productId };

    if (filters.verified !== undefined) {
      query.verified = filters.verified;
    }

    if (filters.rating) {
      query.rating = filters.rating;
    }

    if (filters.moderated !== undefined) {
      query.moderated = filters.moderated;
    }

    const sort: any = {};
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;
    sort[sortBy] = sortOrder;

    const reviews = await ReviewModel.find(query)
      .sort(sort)
      .limit(filters.limit || 50)
      .skip(filters.offset || 0);

    return reviews.map(review => ({
      id: review._id.toString(),
      productId: review.productId,
      userId: review.userId,
      orderId: review.orderId,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      images: review.images,
      verified: review.verified,
      moderated: review.moderated,
      moderationStatus: review.moderationStatus,
      moderationNotes: review.moderationNotes,
      helpful: review.helpful,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    }));
  }

  async getProductRatingSummary(productId: string): Promise<ProductRatingSummary> {
    const pipeline = [
      { $match: { productId, moderated: true, moderationStatus: 'approved' } },
      {
        $group: {
          _id: '$productId',
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratingDistribution: {
            $push: '$rating'
          }
        }
      }
    ];

    const result = await ReviewModel.aggregate(pipeline);

    if (result.length === 0) {
      return {
        productId,
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }

    const summary = result[0];
    const distribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    summary.ratingDistribution.forEach((rating: number) => {
      distribution[rating] = (distribution[rating] || 0) + 1;
    });

    return {
      productId,
      averageRating: Math.round(summary.averageRating * 10) / 10,
      totalReviews: summary.totalReviews,
      ratingDistribution: distribution,
    };
  }

  async moderateReview(reviewId: string, status: 'approved' | 'rejected', notes?: string): Promise<void> {
    const review = await ReviewModel.findById(reviewId);
    if (!review) {
      throw new Error('Review not found');
    }

    review.moderated = true;
    review.moderationStatus = status;
    review.moderationNotes = notes;
    await review.save();

    logger.info('Review moderated', { reviewId, status });
  }

  async markHelpful(reviewId: string): Promise<void> {
    await ReviewModel.findByIdAndUpdate(reviewId, { $inc: { helpful: 1 } });
  }
}

export default new ReviewService();