#!/bin/bash

# ZimaOS Port Monitor Installation Script
# This script installs the Port Monitor app on ZimaOS

set -e

echo "🔧 ZimaOS Port Monitor Installation"
echo "===================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create installation directory
INSTALL_DIR="/opt/zimaos-port-monitor"
echo "📁 Creating installation directory: $INSTALL_DIR"
mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# Download or copy files
if [ -f "docker-compose.yml" ]; then
    echo "✅ Files already exist in $INSTALL_DIR"
else
    echo "📥 Downloading Port Monitor files..."
    # In a real deployment, this would download from a repository
    echo "Please copy the application files to $INSTALL_DIR"
    exit 1
fi

# Create data directory
mkdir -p data
chmod 755 data

# Create systemd service file
echo "📝 Creating systemd service..."
cat > /etc/systemd/system/zimaos-port-monitor.service << EOF
[Unit]
Description=ZimaOS Port Monitor
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
systemctl daemon-reload
systemctl enable zimaos-port-monitor.service

# Start the service
echo "🚀 Starting Port Monitor..."
systemctl start zimaos-port-monitor.service

# Wait for service to start
sleep 10

# Check if service is running
if systemctl is-active --quiet zimaos-port-monitor.service; then
    echo "✅ Port Monitor installed and started successfully!"
    echo ""
    echo "🌐 Access the web interface at: http://$(hostname -I | awk '{print $1}'):3000"
    echo ""
    echo "📖 Management commands:"
    echo "   Start:   sudo systemctl start zimaos-port-monitor"
    echo "   Stop:    sudo systemctl stop zimaos-port-monitor"
    echo "   Status:  sudo systemctl status zimaos-port-monitor"
    echo "   Logs:    sudo docker-compose logs -f"
    echo ""
else
    echo "❌ Installation failed. Check logs with: sudo journalctl -u zimaos-port-monitor.service"
    exit 1
fi

echo "🎉 Installation complete!"