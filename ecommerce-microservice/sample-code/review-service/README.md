# Review Service

Product reviews and ratings microservice for the e-commerce platform.

## Features

- **Product Reviews**: User reviews with ratings, titles, comments
- **Review Moderation**: Admin approval/rejection system
- **Rating Summaries**: Average ratings and distribution per product
- **Review Filtering**: Sort and filter reviews by various criteria
- **Verified Reviews**: Reviews from actual purchases
- **Helpful Votes**: Community feedback on review quality
- **MongoDB Storage**: Flexible document storage for reviews

## Tech Stack

- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: MongoDB
- **ODM**: Mongoose
- **Validation**: Joi
- **Logging**: Winston

## API Endpoints

### Create Review
```
POST /api/reviews
Content-Type: application/json

{
  "productId": "string",
  "userId": "string",
  "orderId": "string?", // optional, makes review verified
  "rating": 5,
  "title": "Great product!",
  "comment": "Really happy with this purchase",
  "images": ["url1", "url2"]
}
```

### Get Review
```
GET /api/reviews/:reviewId
```

### Update Review
```
PUT /api/reviews/:reviewId
Content-Type: application/json

{
  "rating": 4,
  "comment": "Updated comment"
}
```

### Delete Review
```
DELETE /api/reviews/:reviewId
```

### Get Product Reviews
```
GET /api/reviews/product/:productId?verified=true&rating=5&limit=20&offset=0&sortBy=createdAt&sortOrder=desc
```

### Get Product Rating Summary
```
GET /api/reviews/product/:productId/summary
```

Response:
```json
{
  "productId": "prod123",
  "averageRating": 4.2,
  "totalReviews": 150,
  "ratingDistribution": {
    "1": 5,
    "2": 10,
    "3": 25,
    "4": 50,
    "5": 60
  }
}
```

### Moderate Review (Admin)
```
PUT /api/reviews/:reviewId/moderate
Content-Type: application/json

{
  "status": "approved",
  "notes": "Good review"
}
```

### Mark Review Helpful
```
POST /api/reviews/:reviewId/helpful
```

## Environment Variables

- `PORT`: Service port (default: 3009)
- `NODE_ENV`: Environment (development/production)
- `MONGO_URI`: MongoDB connection URI
- `LOG_LEVEL`: Logging level (default: info/debug)

## Database Schema

Reviews are stored in MongoDB with the following structure:

```javascript
{
  productId: String,
  userId: String,
  orderId: String?, // optional
  rating: Number, // 1-5
  title: String,
  comment: String,
  images: [String],
  verified: Boolean,
  moderated: Boolean,
  moderationStatus: 'pending' | 'approved' | 'rejected',
  moderationNotes: String?,
  helpful: Number,
  createdAt: Date,
  updatedAt: Date
}
```

## Development

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run linting
npm run lint
```

## Docker

```bash
# Build image
docker build -t review-service .

# Run container
docker run -p 3009:3009 review-service
```

## Health Check

```
GET /health
```

Returns service status and timestamp.

## Architecture Notes

- Reviews are moderated before being publicly visible
- Verified reviews come from completed orders
- Rating summaries only include approved reviews
- Users can only review products they've purchased
- Review updates are only allowed before moderation