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

# Configure nginx with security hardening
RUN echo 'server { \
    listen 0.0.0.0:3000; \
    server_name _; \
    root /app/app/static; \
    index index.html; \
    server_tokens off; \
    client_max_body_size 12M; \
    location / { \
        try_files $uri $uri/ /index.html; \
        add_header X-Content-Type-Options nosniff always; \
        add_header X-Frame-Options DENY always; \
    } \
    location /api/ { \
        proxy_pass http://127.0.0.1:8000; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_read_timeout 30s; \
        proxy_connect_timeout 10s; \
    } \
    location ~ /\. { \
        deny all; \
        return 404; \
    } \
}' > /etc/nginx/sites-available/default && \
    rm -f /etc/nginx/sites-enabled/default && \
    ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# Expose port 3000
EXPOSE 3000

# Start both nginx and FastAPI
CMD ["sh", "-c", "service nginx start && uvicorn main:app --host 0.0.0.0 --port 8000"]
