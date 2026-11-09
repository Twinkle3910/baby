FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json ./
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN npm install
COPY server ./server
COPY web ./web
COPY templates ./templates
WORKDIR /app/server
RUN npx prisma generate && npm run build
WORKDIR /app/web
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
ENV DATABASE_URL=file:/app/data/baby.db
ENV UPLOAD_DIR=data/uploads
ENV CORS_ORIGIN=*
# PDF Chinese glyphs
RUN apt-get update \
  && apt-get install -y --no-install-recommends fonts-droid-fallback \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server ./server
COPY --from=build /app/web/dist ./web/dist
COPY --from=build /app/templates ./templates
RUN mkdir -p /app/data/uploads
EXPOSE 8787
WORKDIR /app/server
CMD ["sh", "-c", "npx prisma db push && npx tsx prisma/seed.ts && node dist/index.js"]
