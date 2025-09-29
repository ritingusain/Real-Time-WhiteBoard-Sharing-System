# Whiteboard (Socket.IO)

Real-time collaborative whiteboard with room keys. Built with Express and Socket.IO.

## Run locally

```bash
npm install
npm start
# open http://localhost:8080
```

Open in two browser tabs, enter the same room key, and draw.

## Deploy

- Render/Railway/Fly.io: set build to `npm install`, start to `npm start`.
- App binds to `process.env.PORT` automatically.
- WebSockets are supported by these platforms by default.

## Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "index.js"]
```

Build and run:

```bash
docker build -t whiteboard .
docker run -p 8080:8080 whiteboard
```

## Notes

- Client loads Socket.IO from `/socket.io/socket.io.js` for version parity.
- Same-origin `io()` avoids CORS or mixed-content issues.
