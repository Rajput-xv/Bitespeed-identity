# Bitespeed Identity Service

A service to track customer identities across multiple purchases.

## Features

- Identity consolidation across email and phone number
- Primary/secondary contact linking
- RESTful API with `/identify` endpoint
- MongoDB with Mongoose ODM
- Express.js backend

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables in `.env`:
```
MONGO_URI=mongodb://localhost:27017/bitespeed
PORT=3000
```

3. Start the server:
```bash
npm run dev
```

## API Endpoint

### POST /identify

Request body:
```json
{
  "email": "user@example.com",
  "phoneNumber": "1234567890"
}
```

Response:
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["user@example.com"],
    "phoneNumbers": ["1234567890"],
    "secondaryContactIds": []
  }
}
```

## Hosting
The API is hosted on [Render]()