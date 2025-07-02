# Shopify Webhook Server - Modular Architecture

A well-structured Node.js server for handling Shopify webhooks with clean separation of concerns.

## 📁 Project Structure

```
src/
├── config/
│   ├── database.js          # Prisma client configuration
│   └── constants.js         # Environment variables & constants
├── middleware/
│   └── webhook.js           # Shopify webhook verification
├── managers/
│   ├── OrderManager.js      # Order processing logic
│   ├── StatsManager.js      # Statistics calculations
│   └── AnalyticsManager.js  # Analytics & reporting
├── routes/
│   ├── webhooks.js          # Webhook endpoints
│   └── api.js               # REST API endpoints
├── utils/
│   └── payment.js           # Payment processing utilities
└── server.js                # Main server entry point
```

## 🎯 Key Features

### Modular Architecture
- **Managers**: Business logic separated by domain (Orders, Stats, Analytics)
- **Routes**: Clean separation of webhook and API endpoints
- **Middleware**: Reusable components for authentication and validation
- **Config**: Centralized configuration management

### Order Processing
- **OrderManager**: Handles complete order lifecycle
- **Transaction Safety**: All database operations are atomic
- **Error Handling**: Comprehensive error logging and recovery

### Analytics & Reporting
- **Real-time Statistics**: Daily order stats with automatic updates
- **Product Analytics**: Top-selling products and revenue metrics
- **Customer Insights**: Lifetime value and purchase patterns

## 🚀 Setup & Usage

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Database setup:**
   ```bash
   npm run db:generate
   npm run db:push
   ```

3. **Environment configuration:**
   - Copy `.env.example` to `.env`
   - Configure your database URL and Shopify webhook secret

4. **Run the server:**
   ```bash
   npm run dev  # Development
   npm start    # Production
   ```

## 📊 API Endpoints

### Statistics
- `GET /api/stats/daily` - Daily order statistics
- `GET /api/stats/overall` - Overall business metrics

### Orders
- `GET /api/orders` - Paginated order list with full details
- `GET /api/orders/:id` - Single order with relationships

### Analytics
- `GET /api/products/analytics` - Product performance metrics
- `GET /api/customers/analytics` - Customer lifetime value analysis

### Webhooks
- `POST /webhooks/orders/create` - Shopify order webhook processor

## 🔧 Architecture Benefits

- **Maintainability**: Clear separation of concerns
- **Scalability**: Easy to add new features and managers
- **Testability**: Isolated business logic in manager classes
- **Reusability**: Shared utilities and middleware
- **Performance**: Optimized database queries with proper indexing

## 💡 Manager Pattern

Each manager handles a specific domain:
- **OrderManager**: Order processing, customer management, line items
- **StatsManager**: Daily statistics, revenue calculations
- **AnalyticsManager**: Business intelligence and reporting

This pattern makes the codebase more maintainable and allows for easy unit testing of business logic.