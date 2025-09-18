# ZimaOS Docker Socket Permission Fix

## Problem
```
Docker integration error: Error: connect EACCES /var/run/docker.sock
```

## Solutions for ZimaOS

### Solution 1: Update Container Configuration (Recommended)

**In ZimaOS App Store Manual Installation:**

1. **Add User/Group Configuration:**
   ```
   User: root
   ```

2. **Update Volume Mounts:**
   ```
   Host Path: /var/run/docker.sock
   Container Path: /var/run/docker.sock
   Access: Read-write (not read-only)
   ```

3. **Ensure Privileged Mode:**
   ```
   Privileged: Yes (enabled)
   ```

### Solution 2: Docker Run Command Fix

**Stop and recreate container with correct permissions:**

```bash
# Stop existing container
docker stop zimaos-port-monitor
docker rm zimaos-port-monitor

# Create data directory
mkdir -p /DATA/AppData/port-monitor

# Run with corrected permissions
docker run -d \
  --name zimaos-port-monitor \
  --restart unless-stopped \
  --privileged \
  --user root \
  --network host \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e LOG_LEVEL=INFO \
  -v /var/run/docker.sock:/var/run/docker.sock:rw \
  -v /proc:/host/proc:ro \
  -v /sys:/host/sys:ro \
  -v /DATA/AppData/port-monitor:/app/data \
  -p 3000:3000 \
  chicohaager/zimaos-port-monitor:latest
```

### Solution 3: Docker Compose Fix

**Update docker-compose.yml:**

```yaml
version: '3.8'

services:
  port-monitor:
    image: chicohaager/zimaos-port-monitor:latest
    container_name: zimaos-port-monitor
    restart: unless-stopped
    privileged: true
    user: root
    network_mode: host
    environment:
      - NODE_ENV=production
      - PORT=3000
      - LOG_LEVEL=INFO
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:rw
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /DATA/AppData/port-monitor:/app/data
    ports:
      - "3000:3000"
    labels:
      - "zimaos.enable=true"
      - "zimaos.name=Port Monitor"
      - "zimaos.icon=network"
      - "zimaos.port=3000"
```

### Solution 4: Quick Fix Script

```bash
#!/bin/bash
# ZimaOS Port Monitor Docker Fix

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
  -v /var/run/docker.sock:/var/run/docker.sock:rw \
  -v /proc:/host/proc:ro \
  -v /sys:/host/sys:ro \
  -v $DATA_DIR:/app/data \
  -p 3000:3000 \
  $IMAGE_NAME

# Check status
if docker ps | grep -q $CONTAINER_NAME; then
    echo "✅ Port Monitor fixed and running!"
    echo "🌐 Access: http://$(hostname -I | awk '{print $1}'):3000"
    echo "📋 Status:"
    docker ps | grep $CONTAINER_NAME
else
    echo "❌ Fix failed. Check logs:"
    docker logs $CONTAINER_NAME
fi
```

## Manual ZimaOS App Store Configuration

**For the ZimaOS App Store manual installation interface:**

### Basic Configuration:
```
Docker Image: chicohaager/zimaos-port-monitor:latest
Tag: latest
Title: Port Monitor
Web UI: http://$HOST_IP:3000
Network: host
```

### Advanced Configuration:
```
User: root
Privileged: Yes
Restart Policy: unless-stopped
```

### Volume Mappings:
```
1. Docker Socket:
   Host Path: /var/run/docker.sock
   Container Path: /var/run/docker.sock
   Access: Read-write

2. Process Info:
   Host Path: /proc
   Container Path: /host/proc
   Access: Read-only

3. System Info:
   Host Path: /sys
   Container Path: /host/sys
   Access: Read-only

4. Data Storage:
   Host Path: /DATA/AppData/port-monitor
   Container Path: /app/data
   Access: Read-write
```

### Environment Variables:
```
NODE_ENV = production
PORT = 3000
LOG_LEVEL = INFO
DOCKER_SOCKET = /var/run/docker.sock
```

## Verification

After applying the fix, check the logs:

```bash
# Check container status
docker ps | grep port-monitor

# Check logs for Docker connection
docker logs zimaos-port-monitor | grep -i docker

# Expected success message:
# "Docker connected via: /var/run/docker.sock"
```

## Troubleshooting

### If still getting EACCES error:

1. **Check Docker socket permissions:**
   ```bash
   ls -la /var/run/docker.sock
   ```

2. **Verify container is running as root:**
   ```bash
   docker exec zimaos-port-monitor whoami
   ```

3. **Check Docker group membership:**
   ```bash
   # On ZimaOS host
   groups $(whoami)
   ```

4. **Alternative: Use Docker API via TCP (if available):**
   ```bash
   # Add environment variable
   -e DOCKER_HOST=tcp://localhost:2376
   ```

## Expected Behavior After Fix

- ✅ Docker integration should work without errors
- ✅ Container list should be visible in the web interface
- ✅ Docker tab should show running containers
- ✅ Container management buttons should be functional

The application will now gracefully handle Docker availability and provide fallback functionality if Docker is not accessible.