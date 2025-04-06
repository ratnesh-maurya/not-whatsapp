# NotWhatsApp

A sarcastically named, on-premises WhatsApp clone with end-to-end encryption.

## Features

- End-to-end encryption
- Google OAuth authentication
- Real-time messaging
- Media sharing
- Group chats (coming in V2)
- Self-hosted object storage
- Swagger API documentation

## Tech Stack

### Backend

- Go (Golang)
- PostgreSQL
- Redis
- MinIO (S3-compatible storage)
- Swagger/OpenAPI

### Frontend

- Next.js
- TypeScript
- Tailwind CSS
- Material-UI

## Development Setup

1. Clone the repository:

```bash
git clone https://github.com/your-org/not-whatsapp.git
cd not-whatsapp
```

2. Start the development environment:

```bash
docker-compose up -d
```

3. Set up the backend:

```bash
cd apps/backend
go mod download
go run main.go
```

4. Set up the frontend:

```bash
cd apps/frontend
npm install
npm run dev
```

## API Documentation

- Swagger UI: http://localhost:8080/swagger/index.html
- ReDoc: http://localhost:8080/redoc

## Environment Variables

### Backend

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=notwhatsapp
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_SECRET=your-google-secret
SERVER_PORT=8080
JWT_SECRET=your-jwt-secret
```

### Frontend

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

## License

MIT
