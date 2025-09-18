# ZimaOS Port Monitor 🔧

Advanced Port Monitoring and Security Analysis App for ZimaOS with real-time monitoring, security alerts, and Docker integration.

## ✨ Features

### 🚨 Security Alert System
- **Port Anomaly Detection** - Instant notifications for new/unknown ports
- **Suspicious Process Detection** - Security warnings for malicious processes
- **Port Scanning Detection** - Intrusion alerts for scanning attempts
- **Whitelist Management** - Manage known safe services

### 📊 Real-time Traffic Monitoring
- **Live Traffic Graphs** - Real-time bandwidth monitoring per port
- **Top Traffic Ports Dashboard** - Identify high-usage services
- **Historical Data** - 24h/7d/30d traffic analytics
- **Network Utilization Charts** - Visual bandwidth tracking

### 🐳 Smart Docker Integration
- **Automatic Container Detection** - Map containers to ports
- **Service Health Status** - Monitor container states
- **Container Logs Integration** - Direct access to logs
- **One-click Management** - Start/stop/restart containers

### 🔗 Network Topology Visualizer
- **Interactive Network Map** - Visual connection mapping
- **Service Dependency Graph** - Understand service relationships
- **External Connections Tracking** - Monitor outside connections
- **Geographic IP Location** - Map external connection origins

### ⚡ Advanced Filtering & Search
- **Smart Filters** - Filter by protocol, process, port range
- **Intelligent Search** - Search by service name
- **Group Management** - Group by application, system, user services
- **Favorites System** - Bookmark important ports

## 🏗️ Architecture

- **Backend**: Node.js/Express with netstat/ss integration
- **Frontend**: Modern HTML/CSS/JS with responsive design
- **Database**: SQLite for historical data
- **Containerization**: Docker with optimized Alpine Linux base
- **API**: RESTful endpoints for port data

## 🚀 Installation

### Option 1: ZimaOS App Store (Recommended)
1. Open ZimaOS App Store
2. Search for "Port Monitor"
3. Click Install
4. Access via web UI at `http://your-zima-ip:3000`

### Option 2: Docker Compose
```bash
git clone https://github.com/zimaos/port-monitor
cd port-monitor
docker-compose up -d
```

### Option 3: Manual Docker
```bash
docker build -t zimaos-port-monitor .
docker run -d \
  --name port-monitor \
  --network host \
  --pid host \
  --privileged \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v /proc:/host/proc:ro \
  -v /sys:/host/sys:ro \
  -v ./data:/app/data \
  -p 3000:3000 \
  zimaos-port-monitor
```

## 📖 Usage

### Main Dashboard
- View all active ports with real-time updates
- Filter by protocol (TCP/UDP) or service type
- Search for specific ports or processes
- Monitor Docker container ports

### Security Tab
- Review security alerts by severity
- Manage port whitelist
- Investigate suspicious activities
- Resolve or dismiss alerts

### Traffic Tab
- Monitor network traffic in real-time
- View top traffic-generating ports
- Analyze historical bandwidth usage
- Export traffic reports

### Topology Tab
- Visualize network connections
- Understand service dependencies
- Interactive network graph
- Zoom and navigation controls

### Docker Tab
- Monitor all container ports
- View container status and health
- Access container logs
- Start/stop/restart containers

## ⚙️ Configuration

### Environment Variables
```bash
NODE_ENV=production
PORT=3000
```

### Settings (via Web UI)
- Auto-refresh interval (5-60 seconds)
- Notification preferences
- Data retention period (1-365 days)
- Export/import configurations

## 🔒 Security Features

### Alert Types
- **Critical**: Crypto miners, backdoors, intrusions
- **High**: Privilege violations, suspicious countries
- **Medium**: Unknown services, insecure protocols
- **Low**: P2P activity, non-standard ports

### Whitelisting
- Add trusted ports to whitelist
- Whitelist by process name
- Import/export whitelist configurations
- Automatic learning mode

## 📊 API Endpoints

```
GET  /api/ports                 - Get active ports
GET  /api/security/alerts       - Get security alerts
GET  /api/traffic/:port         - Get port traffic data
GET  /api/topology             - Get network topology
GET  /api/history              - Get historical data
POST /api/security/whitelist   - Add to whitelist
```

## 🛠️ Development

### Prerequisites
- Node.js 18+
- Docker
- Access to Docker socket

### Setup
```bash
npm install
npm run dev
```

### Build
```bash
docker build -t zimaos-port-monitor .
```

### Testing
```bash
npm test
```

## 📋 Requirements

- **Memory**: 256MB minimum, 512MB recommended
- **Disk**: 100MB minimum
- **ZimaOS**: Version 1.0.0 or higher
- **Permissions**: Docker access, network monitoring

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔗 Links

- **Documentation**: [Wiki](https://github.com/zimaos/port-monitor/wiki)
- **Issues**: [GitHub Issues](https://github.com/zimaos/port-monitor/issues)
- **Releases**: [GitHub Releases](https://github.com/zimaos/port-monitor/releases)
- **ZimaOS**: [Official Website](https://www.zimaos.com)

## 📸 Screenshots

![Dashboard](screenshots/dashboard.png)
*Main dashboard with real-time port monitoring*

![Security](screenshots/security.png)
*Security alerts and threat detection*

![Topology](screenshots/topology.png)
*Interactive network topology visualization*

---

Made with ❤️ for the ZimaOS community