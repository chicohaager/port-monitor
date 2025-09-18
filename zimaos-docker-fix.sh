#!/bin/bash
# ZimaOS Port Monitor Docker Socket Permission Fix

echo "🔧 Fixing Docker socket permissions for Port Monitor..."

CONTAINER_NAME="zimaos-port-monitor"
IMAGE_NAME="chicohaager/zimaos-port-monitor:latest"
DATA_DIR="/DATA/AppData/port-monitor"

# Stop existing container
echo "🛑 Stopping existing container..."
docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME 2>/dev/null || true

# Create data directory
echo "📁 Creating data directory..."
mkdir -p $DATA_DIR

# Pull latest image
echo "📦 Pulling latest image..."
docker pull $IMAGE_NAME

# Run with correct permissions
echo "🚀 Starting container with correct Docker socket permissions..."
docker run -d \
  --name $CONTAINER_NAME \
  --restart unless-stopped \
  --privileged \
  --user root \
  --network host \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e LOG_LEVEL=INFO \
  -e DOCKER_SOCKET=/var/run/docker.sock \
  -v /var/run/docker.sock:/var/run/docker.sock:rw \
  -v /proc:/host/proc:ro \
  -v /sys:/host/sys:ro \
  -v $DATA_DIR:/app/data \
  -p 3000:3000 \
  -l "zimaos.enable=true" \
  -l "zimaos.name=Port Monitor" \
  -l "zimaos.icon=network" \
  -l "zimaos.port=3000" \
  $IMAGE_NAME

# Wait a moment for container to start
sleep 3

# Check status
if docker ps | grep -q $CONTAINER_NAME; then
    echo "✅ Port Monitor fixed and running!"
    echo ""
    echo "🌐 Access the web interface at:"
    echo "   http://$(hostname -I | awk '{print $1}'):3000"
    echo ""
    echo "🔐 Default login credentials:"
    echo "   Username: admin"
    echo "   Password: zimaos2024"
    echo ""
    echo "📋 Container status:"
    docker ps | grep $CONTAINER_NAME
    echo ""
    echo "📊 Checking Docker integration..."
    sleep 2
    docker logs $CONTAINER_NAME | grep -i docker | tail -3
    echo ""
    echo "📝 View full logs with: docker logs -f $CONTAINER_NAME"
else
    echo "❌ Fix failed. Container not running."
    echo "📋 Checking what went wrong..."
    docker logs $CONTAINER_NAME
    exit 1
fi