# User Service

User authentication and management microservice for the e-commerce platform.

## Features

- User registration and login
- JWT-based authentication
- Profile management
- Role-based access control (Customer, Seller, Admin)
- Password hashing with bcrypt

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `POST /auth/refresh-token` - Refresh access token
- `POST /auth/logout` - Logout user

### User Management
- `GET /users/me` - Get current user profile
- `PUT /users/me` - Update current user profile
- `GET /users` - List users (Admin only)
- `GET /users/:id` - Get specific user (Admin only)

## Development

### Prerequisites

- Node.js 18+
- PostgreSQL

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file with:

```env
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/userdb
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d
CORS_ORIGIN=http://localhost:3000
```

### Running the Service

```bash
npm run dev
```

### Building

```bash
npm run build
npm start
```

## Testing

### Running Tests

```bash
npm test
```

This runs all tests with coverage reporting.

### Test Coverage

The service includes comprehensive unit and integration tests covering:

- User model operations (CRUD, password verification)
- Authentication middleware (JWT validation, authorization)
- API endpoints (registration, login, profile management)
- Error handling and edge cases

### Test Structure

- **Unit Tests**: `src/__tests__/user.test.ts`, `src/__tests__/auth.test.ts`
- **Integration Tests**: `src/__tests__/auth.integration.test.ts`, `src/__tests__/users.integration.test.ts`

Tests use Jest with mocked dependencies for isolation and reliability.

## Database Schema

The service expects a `users` table with the following structure:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'customer',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```