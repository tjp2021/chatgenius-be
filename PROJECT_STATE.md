# ChatGenius Backend - Current State Documentation

## Project Overview
ChatGenius Backend is a NestJS-based real-time chat application backend featuring AI-powered interactions, WebSocket communication, and robust authentication. The application is built with scalability and maintainability in mind, following NestJS's modular architecture patterns.

## Core Technologies

### Framework & Runtime
- NestJS v10.4.15
- Node.js
- TypeScript

### Database & ORM
- Prisma ORM v6.2.1
- PostgreSQL

### Real-time Communication
- Socket.IO v4.8.1
- @nestjs/websockets
- @nestjs/platform-socket.io

### Authentication & Authorization
- Clerk SDK (@clerk/clerk-sdk-node v5.1.6)
- JWT (@nestjs/jwt)
- Passport (@nestjs/passport)

### Caching & Performance
- Redis (ioredis v5.4.2)
- Cache Manager
- @nestjs/cache-manager

### File Storage & External Services
- AWS SDK
- Supabase Client

### API Documentation
- Swagger/OpenAPI (@nestjs/swagger v8.1.0)

## Project Structure

```
chatgenius-be/
├── src/                          # Source code
│   ├── auth/                     # Authentication related code
│   ├── lib/                      # Shared libraries
│   ├── constants/                # Application constants
│   ├── modules/                  # Feature modules
│   ├── types/                    # TypeScript type definitions
│   ├── components/               # Shared components
│   ├── app.module.ts            # Root application module
│   ├── main.ts                  # Application entry point
│   └── app.controller/service.ts # Root application controller/service
├── docs/                         # Documentation
├── prisma/                       # Database schema and migrations
├── test/                         # Test files
└── implementation/               # Implementation plans and notes
```

## Key Features

### 1. Real-time Communication
- WebSocket integration through Socket.IO
- Event-based messaging system
- Real-time updates and notifications
- Bi-directional communication support

### 2. Authentication & Authorization
- Clerk integration for user management
- JWT-based authentication flow
- Role-based access control
- Secure WebSocket connections

### 3. Database Integration
- Prisma ORM for database operations
- Migration management
- Type-safe database queries
- Relationship management

### 4. API Features
- RESTful endpoints
- WebSocket events
- Rate limiting
- API documentation with Swagger
- Request validation
- Error handling

### 5. Performance & Scalability
- Redis caching layer
- Event-driven architecture
- Scheduled tasks
- Resource optimization

## Development Tools & Environment

### Code Quality
- ESLint for linting
- Prettier for code formatting
- TypeScript for type safety
- Jest for testing

### Development Scripts
```bash
# Development
npm run start:dev     # Start in watch mode
npm run start:debug   # Start with debugging

# Testing
npm run test         # Run unit tests
npm run test:e2e     # Run end-to-end tests
npm run test:cov     # Run test coverage

# Code Quality
npm run lint         # Lint code
npm run format       # Format code

# Production
npm run build        # Build for production
npm run start:prod   # Start production server
```

## Documentation

### Available Documentation
- API specifications
- WebSocket event documentation
- Implementation plans
- Database schema
- Integration guides
- Development workflows

### Key Documentation Files
- `docs/websocket-events.md`
- `docs/message-system-implementation.md`
- `docs/frontend-integration.md`
- `docs/clerk-integration.md`
- `API_DOCUMENTATION.md`

## Dependencies

### Production Dependencies
```json
{
  "@clerk/clerk-sdk-node": "^5.1.6",
  "@nestjs/common": "^10.4.15",
  "@nestjs/core": "^10.4.15",
  "@nestjs/platform-socket.io": "^10.4.15",
  "@nestjs/websockets": "^10.4.15",
  "@prisma/client": "^6.2.1",
  "socket.io": "^4.8.1",
  "cache-manager": "^5.7.6",
  "ioredis": "^5.4.2"
}
```

### Development Dependencies
```json
{
  "@nestjs/cli": "^10.0.0",
  "@types/socket.io": "^3.0.1",
  "prisma": "^6.2.1",
  "typescript": "^5.1.3"
}
```

## Current State & Next Steps

### Current State
The project is in active development with a fresh start, maintaining:
- Core infrastructure setup
- Essential service implementations
- Documentation framework
- Testing environment

### Focus Areas
1. Real-time communication implementation
2. Authentication flow refinement
3. Database schema optimization
4. API endpoint development
5. WebSocket event handling

### Development Guidelines
1. Follow NestJS best practices
2. Maintain comprehensive documentation
3. Write tests for new features
4. Use TypeScript decorators appropriately
5. Implement proper error handling

## Contributing
1. Follow the established code style
2. Update documentation for changes
3. Write tests for new features
4. Use feature branches
5. Submit detailed pull requests

## Environment Setup
Required environment variables (defined in `.env`):
- Database connection strings
- Clerk API keys
- JWT secrets
- Redis configuration
- AWS credentials
- API endpoints

## Testing
- Unit tests with Jest
- E2E tests for API endpoints
- WebSocket testing utilities
- Test coverage reporting 