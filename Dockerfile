# ==========================================
# STAGE 1: Build the React Frontend
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy frontend packages and install
COPY frontend/package*.json ./
RUN npm install

# Copy frontend source and build static assets
COPY frontend/ ./
RUN npm run build

# ==========================================
# STAGE 2: Set up the Flask Production Server
# ==========================================
FROM python:3.11-slim
WORKDIR /app

# Install git (optional, fallback is active in backend)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt gunicorn

# Copy backend application source
COPY backend/ ./backend/

# Copy built frontend assets to the backend static folder
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Set environment variables
ENV FLASK_ENV=production
ENV PORT=5000
EXPOSE 5000

# Start the application using gunicorn on port $PORT
WORKDIR /app/backend
CMD gunicorn --workers 2 --bind 0.0.0.0:$PORT "app:app"
