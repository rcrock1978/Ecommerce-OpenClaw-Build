import { jest } from '@jest/globals';
import { ReviewService } from '../services/reviewService';
import { ReviewModel } from '../models/review';

// Mock logger
jest.mock('../utils/logger', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ReviewService', () => {
  let reviewService: ReviewService;

  beforeEach(() => {
    reviewService = new ReviewService();
  });

  describe('createReview', () => {
    it('should create a review successfully', async () => {
      const request = {
        productId: 'product-123',
        userId: 'user-456',
        orderId: 'order-789',
        rating: 5,
        title: 'Great product!',
        comment: 'Really loved this product.',
        images: ['image1.jpg'],
      };

      const savedReview = {
        _id: 'review-id',
        ...request,
        verified: true,
        moderated: false,
        moderationStatus: 'pending',
        helpful: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        save: jest.fn().mockResolvedValue({
          _id: 'review-id',
          ...request,
          verified: true,
          moderated: false,
          moderationStatus: 'pending',
          helpful: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      };

      (ReviewModel.findOne as jest.Mock).mockResolvedValue(null);
      (ReviewModel as any).mockImplementation(() => savedReview);

      const result = await reviewService.createReview(request);

      expect(ReviewModel.findOne).toHaveBeenCalledWith({
        productId: 'product-123',
        userId: 'user-456',
      });
      expect(savedReview.save).toHaveBeenCalled();
      expect(result).toEqual({
        id: 'review-id',
        productId: 'product-123',
        userId: 'user-456',
        orderId: 'order-789',
        rating: 5,
        title: 'Great product!',
        comment: 'Really loved this product.',
        images: ['image1.jpg'],
        verified: true,
        moderated: false,
        moderationStatus: 'pending',
        helpful: 0,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should throw error if user already reviewed product', async () => {
      const request = {
        productId: 'product-123',
        userId: 'user-456',
        rating: 4,
        title: 'Good product',
        comment: 'Nice product.',
      };

      (ReviewModel.findOne as jest.Mock).mockResolvedValue({
        _id: 'existing-review-id',
        productId: 'product-123',
        userId: 'user-456',
      });

      await expect(reviewService.createReview(request)).rejects.toThrow('User has already reviewed this product');
    });

    it('should create unverified review without orderId', async () => {
      const request = {
        productId: 'product-123',
        userId: 'user-456',
        rating: 3,
        title: 'Okay product',
        comment: 'It\'s okay.',
      };

      const savedReview = {
        _id: 'review-id',
        ...request,
        verified: false,
        moderated: false,
        moderationStatus: 'pending',
        helpful: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        save: jest.fn().mockResolvedValue({
          _id: 'review-id',
          ...request,
          verified: false,
          moderated: false,
          moderationStatus: 'pending',
          helpful: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      };

      (ReviewModel.findOne as jest.Mock).mockResolvedValue(null);
      (ReviewModel as any).mockImplementation(() => savedReview);

      const result = await reviewService.createReview(request);

      expect(result.verified).toBe(false);
    });
  });

  describe('getReview', () => {
    it('should return review if found', async () => {
      const mockReview = {
        _id: 'review-id',
        productId: 'product-123',
        userId: 'user-456',
        rating: 5,
        title: 'Great!',
        comment: 'Awesome product.',
        verified: true,
        moderated: true,
        moderationStatus: 'approved',
        helpful: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (ReviewModel.findById as jest.Mock).mockResolvedValue(mockReview);

      const result = await reviewService.getReview('review-id');

      expect(ReviewModel.findById).toHaveBeenCalledWith('review-id');
      expect(result).toEqual({
        id: 'review-id',
        productId: 'product-123',
        userId: 'user-456',
        rating: 5,
        title: 'Great!',
        comment: 'Awesome product.',
        verified: true,
        moderated: true,
        moderationStatus: 'approved',
        helpful: 10,
        createdAt: mockReview.createdAt,
        updatedAt: mockReview.updatedAt,
      });
    });

    it('should return null if review not found', async () => {
      (ReviewModel.findById as jest.Mock).mockResolvedValue(null);

      const result = await reviewService.getReview('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('updateReview', () => {
    it('should update review successfully', async () => {
      const existingReview = {
        _id: 'review-id',
        productId: 'product-123',
        userId: 'user-456',
        rating: 4,
        title: 'Good',
        comment: 'Nice.',
        save: jest.fn().mockResolvedValue({
          _id: 'review-id',
          productId: 'product-123',
          userId: 'user-456',
          rating: 5,
          title: 'Excellent',
          comment: 'Amazing!',
          updatedAt: new Date(),
        }),
      };

      (ReviewModel.findById as jest.Mock).mockResolvedValue(existingReview);

      const updates = {
        rating: 5,
        title: 'Excellent',
        comment: 'Amazing!',
      };

      const result = await reviewService.updateReview('review-id', 'user-456', updates);

      expect(ReviewModel.findById).toHaveBeenCalledWith('review-id');
      expect(existingReview.save).toHaveBeenCalled();
      expect(result.rating).toBe(5);
      expect(result.title).toBe('Excellent');
    });

    it('should throw error if review not found', async () => {
      (ReviewModel.findById as jest.Mock).mockResolvedValue(null);

      await expect(reviewService.updateReview('nonexistent-id', 'user-456', { rating: 5 })).rejects.toThrow('Review not found');
    });

    it('should throw error if user does not own review', async () => {
      const existingReview = {
        _id: 'review-id',
        userId: 'different-user',
      };

      (ReviewModel.findById as jest.Mock).mockResolvedValue(existingReview);

      await expect(reviewService.updateReview('review-id', 'user-456', { rating: 5 })).rejects.toThrow('Unauthorized to update this review');
    });
  });

  describe('deleteReview', () => {
    it('should delete review successfully', async () => {
      const existingReview = {
        _id: 'review-id',
        userId: 'user-456',
        deleteOne: jest.fn().mockResolvedValue(undefined),
      };

      (ReviewModel.findById as jest.Mock).mockResolvedValue(existingReview);

      await reviewService.deleteReview('review-id', 'user-456');

      expect(existingReview.deleteOne).toHaveBeenCalled();
    });

    it('should throw error if review not found', async () => {
      (ReviewModel.findById as jest.Mock).mockResolvedValue(null);

      await expect(reviewService.deleteReview('nonexistent-id', 'user-456')).rejects.toThrow('Review not found');
    });
  });

  describe('getProductReviews', () => {
    it('should return product reviews with filters', async () => {
      const mockReviews = [
        {
          _id: 'review-1',
          productId: 'product-123',
          userId: 'user-1',
          rating: 5,
          title: 'Great!',
          comment: 'Awesome.',
          verified: true,
          moderated: true,
          moderationStatus: 'approved',
          helpful: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockQuery = {
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockReviews),
          }),
        }),
      };

      (ReviewModel.find as jest.Mock).mockReturnValue(mockQuery);

      const filters = {
        productId: 'product-123',
        rating: 5,
        verified: true,
        limit: 10,
        offset: 0,
        sortBy: 'createdAt' as const,
        sortOrder: 'desc' as const,
      };

      const result = await reviewService.getProductReviews('product-123', filters);

      expect(ReviewModel.find).toHaveBeenCalledWith({
        productId: 'product-123',
        rating: 5,
        verified: true,
        moderated: true,
        moderationStatus: 'approved',
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('review-1');
    });
  });

  describe('getProductRatingSummary', () => {
    it('should calculate rating summary correctly', async () => {
      const mockReviews = [
        { rating: 5 },
        { rating: 4 },
        { rating: 5 },
        { rating: 3 },
      ];

      (ReviewModel.find as jest.Mock).mockResolvedValue(mockReviews);

      const result = await reviewService.getProductRatingSummary('product-123');

      expect(result.productId).toBe('product-123');
      expect(result.averageRating).toBe(4.25);
      expect(result.totalReviews).toBe(4);
      expect(result.ratingDistribution).toEqual({
        1: 0,
        2: 0,
        3: 1,
        4: 1,
        5: 2,
      });
    });
  });

  describe('moderateReview', () => {
    it('should approve review', async () => {
      const mockReview = {
        _id: 'review-id',
        moderated: false,
        moderationStatus: 'pending',
        save: jest.fn().mockResolvedValue(undefined),
      };

      (ReviewModel.findById as jest.Mock).mockResolvedValue(mockReview);

      await reviewService.moderateReview('review-id', 'approved', 'Looks good');

      expect(mockReview.moderated).toBe(true);
      expect(mockReview.moderationStatus).toBe('approved');
      expect(mockReview.save).toHaveBeenCalled();
    });

    it('should reject review', async () => {
      const mockReview = {
        _id: 'review-id',
        moderated: false,
        moderationStatus: 'pending',
        save: jest.fn().mockResolvedValue(undefined),
      };

      (ReviewModel.findById as jest.Mock).mockResolvedValue(mockReview);

      await reviewService.moderateReview('review-id', 'rejected', 'Inappropriate content');

      expect(mockReview.moderationStatus).toBe('rejected');
      expect(mockReview.save).toHaveBeenCalled();
    });
  });

  describe('markHelpful', () => {
    it('should increment helpful count', async () => {
      const mockReview = {
        _id: 'review-id',
        helpful: 5,
        save: jest.fn().mockResolvedValue(undefined),
      };

      (ReviewModel.findById as jest.Mock).mockResolvedValue(mockReview);

      await reviewService.markHelpful('review-id');

      expect(mockReview.helpful).toBe(6);
      expect(mockReview.save).toHaveBeenCalled();
    });
  });
});