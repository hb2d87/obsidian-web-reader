FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    nginx \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Configure nginx
RUN echo ' \
server { \
    listen 3000; \
    location / { \
        root /app/app/static; \
        index index.html; \
        try_files $uri $uri/ /index.html; \
    } \
    location /api/ { \
        proxy_pass http://127.0.0.1:8000; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
    } \
} ' > /etc/nginx/sites-available/default

# Expose port
EXPOSE 3000

# Start both nginx and FastAPI
CMD nginx -g "daemon off;" & uvicorn main:app --host 0.0.0.0 --port 8000