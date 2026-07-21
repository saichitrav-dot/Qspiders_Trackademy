# ---- Build stage ----
FROM node:22-alpine AS builder


WORKDIR /app

# Install deps first for better layer caching
COPY package*.json ./
RUN npm ci

# Copy the source
COPY . .

# Vite bakes VITE_* vars into the client bundle at BUILD time.
# Jenkins passes these via --build-arg; the defaults keep the build
# working (and pointing at your self-hosted Supabase) if none are passed.
ARG VITE_SUPABASE_URL=http://trackademy.onqtrack.com
ARG VITE_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgyNzMxNTc3LCJleHAiOjIwOTgwOTE1Nzd9.swdgyQ7-b9nCyCc3Pbo8S7ivmD_4FqvAaKMjczgLwBQ
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

# ---- Runtime stage ----
FROM nginx:1.28-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
