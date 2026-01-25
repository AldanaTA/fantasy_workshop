# syntax=docker/dockerfile:1.6

# ---- deps stage ----
FROM node:20-alpine AS deps
WORKDIR /app

# Copy only dependency files from app/
COPY app/package.json app/package-lock.json ./

# Reproducible install
RUN npm ci

# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Reuse installed dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY app/ ./

# Vite build-time env vars
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Build output -> /app/dist
RUN npm run build

# ---- runtime stage ----
FROM nginx:1.27-alpine AS runtime

# Custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
