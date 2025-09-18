#!/bin/bash

# ZimaOS Port Monitor Installation Script
# Usage: ./zimaos-install.sh

echo "🚀 Installing ZimaOS Port Monitor..."

# Set variables
IMAGE_NAME="chicohaager/zimaos-port-monitor:latest"
CONTAINER_NAME="zimaos-port-monitor"
DATA_DIR="/DATA/AppData/port-monitor/data"
HOST_PORT="3000"

# Create data directory
echo "📁 Creating data directory..."
mkdir -p "$DATA_DIR"

# Stop and remove existing container if it exists
echo "🛑 Stopping existing container (if any)..."
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

# Pull latest image
echo "📦 Pulling latest Docker image..."
docker pull "$IMAGE_NAME"

# Run the container
echo "🐳 Starting Port Monitor container..."
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --privileged \
  --network host \
  -e NODE_ENV=production \
  -e PORT="$HOST_PORT" \
  -e LOG_LEVEL=INFO \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v /proc:/host/proc:ro \
  -v /sys:/host/sys:ro \
  -v "$DATA_DIR":/app/data \
  -p "$HOST_PORT:$HOST_PORT" \
  -l "zimaos.enable=true" \
  -l "zimaos.name=Port Monitor" \
  -l "zimaos.icon=network" \
  -l "zimaos.port=$HOST_PORT" \
  "$IMAGE_NAME"

# Check if container is running
if docker ps | grep -q "$CONTAINER_NAME"; then
    echo "✅ Port Monitor installed successfully!"
    echo ""
    echo "🌐 Access the web interface at:"
    echo "   http://$(hostname -I | awk '{print $1}'):$HOST_PORT"
    echo ""
    echo "🔐 Default login credentials:"
    echo "   Username: admin"
    echo "   Password: zimaos2024"
    echo ""
    echo "📋 Container status:"
    docker ps | grep "$CONTAINER_NAME"
    echo ""
    echo "📝 View logs with: docker logs -f $CONTAINER_NAME"
else
    echo "❌ Installation failed. Check Docker logs:"
    docker logs "$CONTAINER_NAME"
    exit 1
fi