# E-Commerce Frontend

A modern, responsive Next.js 14 frontend for the e-commerce microservice platform.

## Features

- **Next.js 14** with App Router and React Server Components
- **TypeScript** for type safety
- **Tailwind CSS** for responsive styling
- **Authentication** integration with JWT
- **Product catalog** display
- **Shopping cart** with local state management
- **Checkout flow** with payment integration
- **SEO optimization** and performance
- **Error handling** and loading states
- **Docker containerization**

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- Zustand (state management)
- React Hook Form + Zod (form validation)
- Axios (API calls)
- Lucide React (icons)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository and navigate to the frontend directory:
   ```bash
   cd ecommerce-microservice/frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.local.example .env.local
   ```

4. Update `.env.local` with your API endpoints:
   ```
   NEXT_PUBLIC_API_BASE=http://localhost:8000
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## API Integration

The frontend integrates with the following microservices:

- **User Service** (Auth): `http://localhost:3001`
- **Product Service** (Catalog): `http://localhost:3002`
- **Payment Service** (Checkout): `http://localhost:3005`
- **API Gateway**: `http://localhost:8000`

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication pages
│   ├── products/          # Product pages
│   ├── cart/              # Shopping cart
│   ├── checkout/          # Checkout flow
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # Reusable UI components
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── ProductCard.tsx
│   └── CartItem.tsx
├── lib/                   # Utilities and configurations
│   ├── api.ts             # API client
│   ├── store.ts           # Zustand stores
│   ├── types.ts           # TypeScript types
│   └── middleware.ts      # Next.js middleware
└── middleware.ts          # Auth middleware
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Docker

Build and run with Docker:

```bash
# Build the image
docker build -t ecommerce-frontend .

# Run the container
docker run -p 3000:3000 ecommerce-frontend
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_BASE` | API Gateway URL | `http://localhost:8000` |

## Features in Detail

### Authentication
- JWT-based authentication
- Login/Register forms with validation
- Protected routes with middleware
- User profile management

### Product Catalog
- Product listing with pagination
- Product detail pages
- Search and filtering (future enhancement)
- Responsive product cards

### Shopping Cart
- Add/remove items
- Quantity management
- Local storage persistence
- Cart summary

### Checkout
- Shipping information form
- Order summary
- Payment integration placeholder
- Order confirmation

### UI/UX
- Responsive design for mobile/desktop
- Loading states and error handling
- Accessibility considerations
- Modern design with Tailwind CSS

## Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation as needed
4. Ensure all linting passes

## License

This project is part of the e-commerce microservice platform.