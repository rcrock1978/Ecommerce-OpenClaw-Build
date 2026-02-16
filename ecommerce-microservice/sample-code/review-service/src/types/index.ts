export interface Review {
  id?: string;
  productId: string;
  userId: string;
  orderId?: string;
  rating: number; // 1-5
  title: string;
  comment: string;
  images?: string[];
  verified: boolean;
  moderated: boolean;
  moderationStatus: 'pending' | 'approved' | 'rejected';
  moderationNotes?: string;
  helpful: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateReviewRequest {
  productId: string;
  userId: string;
  orderId?: string;
  rating: number;
  title: string;
  comment: string;
  images?: string[];
}

export interface UpdateReviewRequest {
  rating?: number;
  title?: string;
  comment?: string;
  images?: string[];
}

export interface ReviewFilters {
  productId?: string;
  userId?: string;
  rating?: number;
  verified?: boolean;
  moderated?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'rating' | 'helpful';
  sortOrder?: 'asc' | 'desc';
}

export interface ProductRatingSummary {
  productId: string;
  averageRating: number;
  totalReviews: number;
  ratingDistribution: { [key: number]: number };
}