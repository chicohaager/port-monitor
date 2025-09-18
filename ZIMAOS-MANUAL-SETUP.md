# ZimaOS Manual App Installation Setup

## Port Monitor - Advanced Port Monitoring and Security Analysis

### Installation Configuration for ZimaOS

#### Basic Information
- **Docker Image**: `chicohaager/zimaos-port-monitor:latest`
- **Tag**: `latest`
- **Title**: `Port Monitor`
- **Icon URL**: `https://raw.githubusercontent.com/chicohaager/port-monitor/main/public/favicon.ico`
- **Web UI**: `http://your-zimaos-ip:3000`

#### Network Configuration
- **Network**: `bridge` (recommended) or `host` (for complete network access)

#### Port Mappings
1. **Main Application Port**
   - **Container Port**: `3000`
   - **Host Port**: `3000` (or custom port)
   - **Protocol**: `TCP`

#### Environment Variables
1. **NODE_ENV**
   - **Variable**: `NODE_ENV`
   - **Value**: `production`

2. **PORT** (optional)
   - **Variable**: `PORT`
   - **Value**: `3000`

3. **LOG_LEVEL** (optional)
   - **Variable**: `LOG_LEVEL`
   - **Value**: `INFO`

#### Volume Mappings
1. **Docker Socket Access**
   - **Container Path**: `/var/run/docker.sock`
   - **Host Path**: `/var/run/docker.sock`
   - **Access**: `Read-only`

2. **Host Proc Access**
   - **Container Path**: `/host/proc`
   - **Host Path**: `/proc`
   - **Access**: `Read-only`

3. **Host Sys Access**
   - **Container Path**: `/host/sys`
   - **Host Path**: `/sys`
   - **Access**: `Read-only`

4. **Data Persistence**
   - **Container Path**: `/app/data`
   - **Host Path**: `/DATA/AppData/port-monitor`
   - **Access**: `Read-write`

#### Device Access
- **Device**: `/dev/net/tun` (if available, for advanced network monitoring)

#### Privileges
- **Privileged**: `Yes` (required for complete network monitoring)
- **CPU Shares**: `Normal`
- **Restart Policy**: `unless-stopped`

#### Container Labels
- **app.name**: `Port Monitor`
- **app.version**: `1.0.0`
- **app.description**: `Advanced Port Monitoring for ZimaOS`

---

## Manual Installation Steps

### Method 1: ZimaOS App Store Interface

1. **Open ZimaOS App Store**
2. **Click "Manual App Installation"**
3. **Fill in the following fields:**

**Basic Setup:**
```
Docker Image: chicohaager/zimaos-port-monitor:latest
Tag: latest
Title: Port Monitor
Icon URL: (leave empty or add custom icon)
Web UI: http://your-zimaos-ip:3000
```

**Network:**
```
Network: bridge
```

**Ports:**
```
Container Port: 3000
Host Port: 3000
Protocol: TCP
```

**Environment Variables:**
```
NODE_ENV = production
PORT = 3000
LOG_LEVEL = INFO
```

**Volume Mappings:**
```
/var/run/docker.sock -> /var/run/docker.sock (ro)
/proc -> /host/proc (ro)
/sys -> /host/sys (ro)
/DATA/AppData/port-monitor -> /app/data (rw)
```

**Advanced Settings:**
```
Privileged: Yes
Restart Policy: unless-stopped
CPU Shares: Normal
```

### Method 2: Docker Compose (Alternative)

Create `docker-compose.yml` in ZimaOS:

```yaml
version: '3.8'

services:
  port-monitor:
    image: chicohaager/zimaos-port-monitor:latest
    container_name: zimaos-port-monitor
    restart: unless-stopped
    privileged: true
    network_mode: host
    environment:
      - NODE_ENV=production
      - PORT=3000
      - LOG_LEVEL=INFO
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
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

### Method 3: CLI Installation

```bash
# Pull the image
docker pull chicohaager/zimaos-port-monitor:latest

# Create data directory
mkdir -p /DATA/AppData/port-monitor

# Run the container
docker run -d \
  --name zimaos-port-monitor \
  --restart unless-stopped \
  --privileged \
  --network host \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e LOG_LEVEL=INFO \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v /proc:/host/proc:ro \
  -v /sys:/host/sys:ro \
  -v /DATA/AppData/port-monitor:/app/data \
  -p 3000:3000 \
  chicohaager/zimaos-port-monitor:latest
```

## Post-Installation

1. **Access the Web Interface:**
   - URL: `http://your-zimaos-ip:3000`
   - Default login: `admin` / `zimaos2024`

2. **First-Time Setup:**
   - Change default password
   - Configure security settings
   - Set up port monitoring preferences

3. **Verify Functionality:**
   - Check if ports are being detected
   - Verify Docker container monitoring
   - Test security alerts

## Troubleshooting

### Common Issues:

1. **Permission Denied Errors:**
   - Ensure privileged mode is enabled
   - Check volume mount permissions

2. **No Port Detection:**
   - Verify host network access
   - Check if running with sufficient privileges

3. **Docker Integration Not Working:**
   - Ensure Docker socket is properly mounted
   - Verify container has access to `/var/run/docker.sock`

4. **Web Interface Not Accessible:**
   - Check port mapping (3000:3000)
   - Verify firewall settings
   - Ensure container is running

### Logs:
```bash
# View container logs
docker logs zimaos-port-monitor

# Follow logs in real-time
docker logs -f zimaos-port-monitor
```

## Security Notes

- **Default Credentials**: Change immediately after installation
- **Network Access**: The app requires privileged access for complete monitoring
- **Data Storage**: All configuration and logs are stored in `/DATA/AppData/port-monitor`
- **Updates**: Pull latest image and restart container for updates

## Features Available

✅ Real-time port monitoring
✅ Security threat analysis
✅ Docker container integration
✅ Network topology visualization
✅ Traffic monitoring
✅ Historical data storage
✅ Web-based dashboard
✅ Authentication system
✅ Automated security alerts
✅ Export capabilities

---

**Repository**: https://github.com/chicohaager/port-monitor
**Docker Hub**: https://hub.docker.com/r/chicohaager/zimaos-port-monitor