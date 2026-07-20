# ============================
# Stage 1 - Build React App
# ============================
FROM node:22-alpine AS builder

WORKDIR /app

# Hardcoded Vite environment variables
ENV VITE_SUPABASE_URL=http://trackademy.onqtrack.com
ENV VITE_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgyNzMxNTc3LCJleHAiOjIwOTgwOTE1Nzd9.swdgyQ7-b9nCyCc3Pbo8S7ivmD_4FqvAaKMjczgLwBQ

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy application source
COPY . .

# Build the Vite application
RUN npm run build

# ============================
# Stage 2 - Nginx
# ============================
FROM nginx:1.28-alpine

# Remove default config
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]