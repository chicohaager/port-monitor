class PortMonitorApp {
    constructor() {
        this.ws = null;
        this.ports = [];
        this.alerts = [];
        this.autoRefreshInterval = 10000;
        this.refreshTimer = null;
        this.trafficChart = null;
        this.portTrendsChart = null;
        this.networkGraph = null;
        this.settings = this.loadSettings();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.currentTheme = this.loadTheme();
        this.user = null;

        this.init();
    }

    async init() {
        await this.checkAuthentication();
        this.setupWebSocket();
        this.setupEventListeners();
        this.setupCharts();
        this.loadInitialData();

        if (this.settings.autoRefresh) {
            this.startAutoRefresh();
        }
    }

    async checkAuthentication() {
        try {
            const response = await fetch('/api/auth/check', {
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success && data.authenticated) {
                this.user = data.user;
                this.updateUserInfo();
            } else {
                window.location.href = '/login.html';
                return;
            }
        } catch (error) {
            console.error('Authentication check failed:', error);
            window.location.href = '/login.html';
        }
    }

    updateUserInfo() {
        const usernameEl = document.getElementById('username');
        if (usernameEl && this.user) {
            usernameEl.textContent = this.user.username;
        }
    }

    async logout() {
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                this.showNotification('Erfolgreich abgemeldet', 'success');
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 1000);
            } else {
                this.showNotification('Logout error', 'error');
            }
        } catch (error) {
            console.error('Logout failed:', error);
            this.showNotification('Connection error during logout', 'error');
        }
    }

    sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    createElement(tag, attributes = {}, content = '') {
        const element = document.createElement(tag);

        Object.keys(attributes).forEach(key => {
            if (key === 'className') {
                element.className = attributes[key];
            } else if (key === 'dataset') {
                Object.keys(attributes[key]).forEach(dataKey => {
                    element.dataset[dataKey] = attributes[key][dataKey];
                });
            } else if (key.startsWith('on')) {
                console.warn(`Event handler ${key} ignored for security`);
            } else {
                element.setAttribute(key, attributes[key]);
            }
        });

        if (content) {
            element.textContent = content;
        }

        return element;
    }

    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;

        console.log('Attempting WebSocket connection to:', wsUrl);

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                this.updateConnectionStatus(true);
                this.reconnectAttempts = 0;
                console.log('WebSocket connected successfully to:', wsUrl);
            };

            this.ws.onmessage = (event) => {
                try {
                    console.log('WebSocket message received:', event.data);
                    const message = JSON.parse(event.data);
                    this.handleWebSocketMessage(message);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                    console.error('Raw message:', event.data);
                }
            };

            this.ws.onclose = (event) => {
                console.log('WebSocket closed. Code:', event.code, 'Reason:', event.reason);
                this.updateConnectionStatus(false);
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error occurred:', error);
                console.error('WebSocket readyState:', this.ws.readyState);
                this.updateConnectionStatus(false);
            };
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            this.updateConnectionStatus(false);
            this.attemptReconnect();
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
            setTimeout(() => this.setupWebSocket(), delay);
        } else {
            console.error('Max reconnection attempts reached');
            this.showError('Connection lost. Please refresh the page.');
        }
    }

    handleWebSocketMessage(message) {
        if (!message || !message.type) return;

        switch (message.type) {
            case 'port-update':
                if (message.data) {
                    this.updatePortsData(message.data.ports || []);
                    this.updateSecurityAlerts(message.data.alerts || []);
                    this.updateTrafficData(message.data.traffic || {});
                }
                break;
            case 'initial-data':
                if (message.data) {
                    this.updatePortsData(message.data.ports || []);
                    this.updateSecurityAlerts(message.data.alerts || []);
                }
                break;
            default:
                console.warn('Unknown message type:', message.type);
        }
    }

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.nav-tab')) {
                const tab = e.target.closest('.nav-tab');
                this.switchTab(tab.dataset.tab);
            }

            if (e.target.closest('#refreshBtn')) {
                this.refresh();
            }

            if (e.target.closest('#settingsBtn')) {
                this.openSettings();
            }

            if (e.target.closest('#themeToggle')) {
                this.toggleTheme();
            }

            if (e.target.closest('#logoutBtn')) {
                this.logout();
            }

            if (e.target.closest('.modal-close')) {
                this.closeSettings();
            }

            if (e.target.closest('#saveSettingsBtn')) {
                this.saveSettings();
            }

            if (e.target.closest('#exportBtn')) {
                this.exportData();
            }

            if (e.target.closest('#addWhitelistBtn')) {
                this.addToWhitelist();
            }

            if (e.target.closest('.port-details-btn')) {
                const port = e.target.closest('.port-details-btn').dataset.port;
                this.viewPortDetails(port);
            }

            if (e.target.closest('.port-whitelist-btn')) {
                const port = e.target.closest('.port-whitelist-btn').dataset.port;
                this.addPortToWhitelist(port);
            }

            if (e.target.closest('.container-start-btn')) {
                const containerId = e.target.closest('.container-start-btn').dataset.containerId;
                this.startContainer(containerId);
            }

            if (e.target.closest('.container-stop-btn')) {
                const containerId = e.target.closest('.container-stop-btn').dataset.containerId;
                this.stopContainer(containerId);
            }

            if (e.target.closest('.container-restart-btn')) {
                const containerId = e.target.closest('.container-restart-btn').dataset.containerId;
                this.restartContainer(containerId);
            }

            if (e.target.closest('.container-logs-btn')) {
                const containerId = e.target.closest('.container-logs-btn').dataset.containerId;
                this.viewContainerLogs(containerId);
            }
        });

        document.getElementById('searchInput')?.addEventListener('input',
            this.debounce((e) => this.filterPorts(e.target.value), 300)
        );

        document.getElementById('protocolFilter')?.addEventListener('change',
            () => this.applyFilters()
        );

        document.getElementById('typeFilter')?.addEventListener('change',
            () => this.applyFilters()
        );

        document.getElementById('autoRefreshToggle')?.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.startAutoRefresh();
            } else {
                this.stopAutoRefresh();
            }
        });
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    updatePortsData(ports) {
        if (!Array.isArray(ports)) return;

        this.ports = ports.filter(port =>
            port && typeof port.port === 'number' && port.port > 0 && port.port <= 65535
        );

        this.renderPortsTable();
        this.updateStatistics();
    }

    renderPortsTable() {
        const tbody = document.getElementById('portsTableBody');
        if (!tbody) return;

        // Clear existing content
        tbody.innerHTML = '';

        const filteredPorts = this.getFilteredPorts();

        filteredPorts.forEach(port => {
            const row = this.createElement('tr');

            // Port number
            const portCell = this.createElement('td');
            const portStrong = this.createElement('strong', {}, String(port.port));
            portCell.appendChild(portStrong);
            row.appendChild(portCell);

            // Protocol
            const protocolCell = this.createElement('td');
            const protocolBadge = this.createElement('span', {
                className: 'protocol-badge'
            }, port.protocol?.toUpperCase() || 'TCP');
            protocolCell.appendChild(protocolBadge);
            row.appendChild(protocolCell);

            // Process
            const processCell = this.createElement('td');
            const processType = this.getProcessType(port);
            const processBadge = this.createElement('span', {
                className: `process-badge process-${processType}`
            }, this.sanitizeHTML(port.process || 'unknown'));
            processCell.appendChild(processBadge);
            row.appendChild(processCell);

            // PID
            const pidCell = this.createElement('td', {}, port.pid ? String(port.pid) : '-');
            row.appendChild(pidCell);

            // Container
            const containerCell = this.createElement('td');
            if (port.container) {
                const containerTag = this.createElement('span', {
                    className: 'container-tag'
                });
                const dockerIcon = this.createElement('i', { className: 'fab fa-docker' });
                const containerText = document.createTextNode(' ' + this.sanitizeHTML(port.container));
                containerTag.appendChild(dockerIcon);
                containerTag.appendChild(containerText);
                containerCell.appendChild(containerTag);
            } else {
                containerCell.textContent = '-';
            }
            row.appendChild(containerCell);

            // Status
            const statusCell = this.createElement('td');
            const statusClass = port.container ? 'running' : 'listening';
            const statusBadge = this.createElement('span', {
                className: `status-badge status-${statusClass}`
            }, statusClass);
            statusCell.appendChild(statusBadge);
            row.appendChild(statusCell);

            // Actions
            const actionsCell = this.createElement('td');
            const actionButtons = this.createElement('div', { className: 'action-buttons' });

            const detailsBtn = this.createElement('button', {
                className: 'action-btn port-details-btn',
                dataset: { port: port.port }
            });
            detailsBtn.innerHTML = '<i class="fas fa-info-circle"></i>';
            actionButtons.appendChild(detailsBtn);

            const whitelistBtn = this.createElement('button', {
                className: 'action-btn port-whitelist-btn',
                dataset: { port: port.port }
            });
            whitelistBtn.innerHTML = '<i class="fas fa-shield-alt"></i>';
            actionButtons.appendChild(whitelistBtn);

            actionsCell.appendChild(actionButtons);
            row.appendChild(actionsCell);

            tbody.appendChild(row);
        });
    }

    getFilteredPorts() {
        let filtered = [...this.ports];

        const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
        const protocolFilter = document.getElementById('protocolFilter')?.value || '';
        const typeFilter = document.getElementById('typeFilter')?.value || '';

        console.log('getFilteredPorts - searchTerm:', searchTerm, 'total ports:', this.ports.length);

        if (searchTerm) {
            filtered = filtered.filter(port =>
                String(port.port).includes(searchTerm) ||
                (port.process && port.process.toLowerCase().includes(searchTerm)) ||
                (port.container && port.container.toLowerCase().includes(searchTerm))
            );
            console.log('After search filter:', filtered.length, 'ports remaining');
        }

        if (protocolFilter) {
            filtered = filtered.filter(port => port.protocol === protocolFilter);
        }

        if (typeFilter) {
            filtered = filtered.filter(port => {
                const processType = this.getProcessType(port);
                return processType === typeFilter;
            });
        }

        return filtered;
    }

    getProcessType(port) {
        if (port.container) return 'docker';
        if (port.port < 1024) return 'system';
        return 'user';
    }

    updateStatistics() {
        const filteredPorts = this.getFilteredPorts();
        const totalPortsEl = document.getElementById('totalPorts');
        const dockerPortsEl = document.getElementById('dockerPorts');
        const totalConnectionsEl = document.getElementById('totalConnections');

        if (totalPortsEl) {
            totalPortsEl.textContent = filteredPorts.length;
        }

        if (dockerPortsEl) {
            dockerPortsEl.textContent = filteredPorts.filter(p => p.container).length;
        }

        if (totalConnectionsEl) {
            totalConnectionsEl.textContent = filteredPorts.reduce((sum, p) => sum + (p.connections || 1), 0);
        }
    }

    updateSecurityAlerts(alerts) {
        if (!Array.isArray(alerts)) return;

        this.alerts = alerts;
        this.renderSecurityAlerts();
        this.updateAlertCount();
    }

    renderSecurityAlerts() {
        const alertsList = document.getElementById('alertsList');
        if (!alertsList) return;

        alertsList.innerHTML = '';


        const alertsByType = {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0
        };

        this.alerts.forEach((alert, index) => {
            if (!alert || !alert.severity) return;

            alertsByType[alert.severity]++;

            const alertItem = this.createElement('div', {
                className: `alert-item ${alert.severity}`
            });

            const alertContent = this.createElement('div', { className: 'alert-content' });

            // Main alert header
            const alertHeader = this.createElement('div', { className: 'alert-header' });

            const alertTitle = this.createElement('div', { className: 'alert-title' },
                this.sanitizeHTML((alert.type || '').replace(/_/g, ' ').toUpperCase())
            );

            const alertTimestamp = this.createElement('div', { className: 'alert-timestamp' },
                alert.timestamp ? new Date(alert.timestamp).toLocaleString('de-DE') : ''
            );

            alertHeader.appendChild(alertTitle);
            alertHeader.appendChild(alertTimestamp);

            // Main message
            const alertMessage = this.createElement('div', { className: 'alert-message' },
                this.sanitizeHTML(alert.message || '')
            );

            // Enhanced details section
            const alertDetails = this.createElement('div', { className: 'alert-details' });

            // Port and service information
            if (alert.service && alert.service !== 'Unknown') {
                const serviceInfo = this.createElement('div', { className: 'alert-service-info' });
                serviceInfo.innerHTML = `
                    <div class="service-badge ${alert.details?.risk || 'unknown'}-risk">
                        ${this.sanitizeHTML(alert.service)}
                        ${alert.details?.category ? `(${this.sanitizeHTML(alert.details.category)})` : ''}
                    </div>
                    <div class="port-details">
                        Port ${alert.port} - ${this.sanitizeHTML(alert.process || 'Unknown process')}
                    </div>
                `;
                alertDetails.appendChild(serviceInfo);
            }

            // Description
            if (alert.details?.description) {
                const description = this.createElement('div', { className: 'alert-description' },
                    `📋 ${this.sanitizeHTML(alert.details.description)}`
                );
                alertDetails.appendChild(description);
            }

            // Process matching information
            if (alert.details?.processMatch !== undefined) {
                const processMatch = this.createElement('div', {
                    className: `process-match ${alert.details.processMatch ? 'match' : 'mismatch'}`
                });
                processMatch.innerHTML = alert.details.processMatch ?
                    '✅ Process matches expected service' :
                    '⚠️ Unexpected process for this port';
                alertDetails.appendChild(processMatch);
            }

            // Recommendations section
            if (alert.recommendations && alert.recommendations.length > 0) {
                const recommendationsTitle = this.createElement('div', { className: 'recommendations-title' },
                    '🛡️ Security Recommendations:'
                );
                alertDetails.appendChild(recommendationsTitle);

                const recommendationsList = this.createElement('ul', { className: 'recommendations-list' });
                alert.recommendations.forEach(rec => {
                    const listItem = this.createElement('li', { className: 'recommendation-item' },
                        this.sanitizeHTML(rec)
                    );
                    recommendationsList.appendChild(listItem);
                });
                alertDetails.appendChild(recommendationsList);
            }

            // Risk indicators
            if (alert.details) {
                const riskIndicators = this.createElement('div', { className: 'risk-indicators' });

                if (alert.details.isDangerous) {
                    const dangerBadge = this.createElement('span', { className: 'risk-badge dangerous' }, '🚨 Dangerous');
                    riskIndicators.appendChild(dangerBadge);
                }

                if (alert.details.isDevelopment) {
                    const devBadge = this.createElement('span', { className: 'risk-badge development' }, '🔧 Development');
                    riskIndicators.appendChild(devBadge);
                }

                if (alert.details.isDatabase) {
                    const dbBadge = this.createElement('span', { className: 'risk-badge database' }, '🗃️ Database');
                    riskIndicators.appendChild(dbBadge);
                }

                if (riskIndicators.children.length > 0) {
                    alertDetails.appendChild(riskIndicators);
                }
            }

            // Address information
            if (alert.address && alert.address !== 'unknown') {
                const addressInfo = this.createElement('div', { className: 'alert-address' },
                    `📍 Adresse: ${this.sanitizeHTML(alert.address)}`
                );
                alertDetails.appendChild(addressInfo);
            }

            alertContent.appendChild(alertHeader);
            alertContent.appendChild(alertMessage);
            alertContent.appendChild(alertDetails);
            alertItem.appendChild(alertContent);

            alertsList.appendChild(alertItem);
        });

        // Update counts
        Object.keys(alertsByType).forEach(severity => {
            const countEl = document.getElementById(`${severity}Count`);
            if (countEl) {
                countEl.textContent = alertsByType[severity];
            }
        });

        // Load geographic data for security tab
        this.loadGeographicData();
    }

    async loadGeographicData() {
        try {
            const response = await fetch('/api/security/geo-stats', {
                credentials: 'include'
            });
            if (response.ok) {
                const result = await response.json();
                this.renderGeographicVisualization(result.data);
            } else {
                // Fallback to demo data if no real data available
                console.log('Using demo geographic data');
                this.renderGeographicVisualization(this.getDemoGeoData());
            }
        } catch (error) {
            console.error('Failed to load geographic data:', error);
            // Show demo data as fallback
            this.renderGeographicVisualization(this.getDemoGeoData());
        }
    }

    getDemoGeoData() {
        return {
            riskLevels: {
                high: 2,
                medium: 5,
                low: 15
            },
            topCountries: [
                { country: 'United States', count: 8 },
                { country: 'Germany', count: 6 },
                { country: 'United Kingdom', count: 4 },
                { country: 'France', count: 3 },
                { country: 'Canada', count: 1 }
            ],
            topCities: [
                { city: 'San Francisco', count: 4 },
                { city: 'Berlin', count: 3 },
                { city: 'London', count: 3 },
                { city: 'Paris', count: 2 },
                { city: 'Toronto', count: 1 }
            ]
        };
    }

    renderGeographicVisualization(geoStats) {
        const geoContainer = document.getElementById('geoVisualization');
        if (!geoContainer) return;

        geoContainer.innerHTML = `
            <div class="geo-stats">
                <div class="geo-card">
                    <h3>🌍 Risk Level Distribution</h3>
                    <div class="risk-indicators">
                        <div class="risk-indicator risk-high">
                            <div>High Risk</div>
                            <div>${geoStats.riskLevels.high}</div>
                        </div>
                        <div class="risk-indicator risk-medium">
                            <div>Medium Risk</div>
                            <div>${geoStats.riskLevels.medium}</div>
                        </div>
                        <div class="risk-indicator risk-low">
                            <div>Low Risk</div>
                            <div>${geoStats.riskLevels.low}</div>
                        </div>
                    </div>
                </div>

                <div class="geo-card">
                    <h3>🏆 Top Countries</h3>
                    <ul class="country-list">
                        ${geoStats.topCountries.map(country => `
                            <li>
                                <span>${this.sanitizeHTML(country.country)}</span>
                                <span class="country-count">${country.count}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>

                <div class="geo-card">
                    <h3>🏙️ Top Cities</h3>
                    <ul class="country-list">
                        ${geoStats.topCities.map(city => `
                            <li>
                                <span>${this.sanitizeHTML(city.city)}</span>
                                <span class="country-count">${city.count}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        `;
    }

    updateAlertCount() {
        const count = this.alerts.length;
        const badge = document.getElementById('alertCount');

        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-block' : 'none';
        }
    }

    updateTrafficData(traffic) {
        if (!traffic) return;

        if (traffic.interfaces && Array.isArray(traffic.interfaces)) {
            const totalRate = traffic.interfaces.reduce((sum, iface) =>
                sum + (iface.rxRate || 0) + (iface.txRate || 0), 0
            );

            const trafficRateEl = document.getElementById('trafficRate');
            if (trafficRateEl) {
                trafficRateEl.textContent = this.formatBytes(totalRate) + '/s';
            }
        }

        if (traffic.ports && this.trafficChart) {
            this.updateTrafficChart(traffic.ports);
        }

        this.renderTopPorts(traffic.ports);
    }

    showError(message) {
        console.error(message);
        // Implement user-friendly error display
    }

    formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Additional secure methods...
    async loadInitialData() {
        try {
            const response = await fetch('/api/ports');
            const data = await response.json();

            if (data.success && data.data) {
                this.updatePortsData(data.data);
            }

            const alertsResponse = await fetch('/api/security/alerts');
            const alertsData = await alertsResponse.json();

            if (alertsData.success && alertsData.data) {
                this.updateSecurityAlerts(alertsData.data);
            }
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showError('Failed to load data');
        }
    }

    setupCharts() {
        // Setup main traffic chart
        const ctx = document.getElementById('trafficChart');
        if (ctx) {
            this.trafficChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Incoming',
                        data: [],
                        borderColor: '#2dce89',
                        backgroundColor: 'rgba(45, 206, 137, 0.1)',
                        tension: 0.4
                    }, {
                        label: 'Outgoing',
                        data: [],
                        borderColor: '#5e72e4',
                        backgroundColor: 'rgba(94, 114, 228, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#8898aa'
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                color: '#8898aa',
                                callback: function(value) {
                                    const k = 1024;
                                    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                                    if (!value || value === 0) return '0 B';
                                    const i = Math.floor(Math.log(value) / Math.log(k));
                                    return parseFloat((value / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                                }
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)'
                            }
                        },
                        x: {
                            ticks: {
                                color: '#8898aa'
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)'
                            }
                        }
                    }
                }
            });
        }

        // Setup port trends chart
        const trendsCtx = document.getElementById('portTrendsChart');
        if (trendsCtx) {
            this.portTrendsChart = new Chart(trendsCtx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Activity %',
                        data: [],
                        backgroundColor: 'rgba(94, 114, 228, 0.8)',
                        borderColor: '#5e72e4',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#8898aa'
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                color: '#8898aa',
                                callback: function(value) {
                                    return value + '%';
                                }
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)'
                            }
                        },
                        x: {
                            ticks: {
                                color: '#8898aa'
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)'
                            }
                        }
                    }
                }
            });
        }

        // Setup analytics controls
        this.setupAnalyticsControls();
    }

    setupAnalyticsControls() {
        const refreshBtn = document.getElementById('refreshAnalytics');
        const periodSelect = document.getElementById('analyticsPeriod');

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadAnalytics();
            });
        }

        if (periodSelect) {
            periodSelect.addEventListener('change', () => {
                this.loadAnalytics();
            });
        }

        // Load initial analytics
        this.loadAnalytics();
    }

    async loadAnalytics() {
        const period = document.getElementById('analyticsPeriod')?.value || '24h';

        try {
            const [analyticsResponse, trendsResponse] = await Promise.all([
                fetch(`/api/analytics/overview?period=${period}`),
                fetch(`/api/analytics/port-trends?period=${period}`)
            ]);

            if (analyticsResponse.ok && trendsResponse.ok) {
                const { data: analytics } = await analyticsResponse.json();
                const { data: trends } = await trendsResponse.json();

                this.updateAnalyticsSummary(analytics.summary);
                this.updateTrafficTimeline(analytics.timeline);
                this.updatePortTrends(trends);
            }
        } catch (error) {
            console.error('Failed to load analytics:', error);
        }
    }

    updateAnalyticsSummary(summary) {
        const totalInEl = document.getElementById('totalTrafficIn');
        const totalOutEl = document.getElementById('totalTrafficOut');
        const avgPortsEl = document.getElementById('avgActivePorts');
        const peakActivityEl = document.getElementById('peakActivity');

        if (totalInEl) totalInEl.textContent = this.formatBytes(summary.totalTrafficIn);
        if (totalOutEl) totalOutEl.textContent = this.formatBytes(summary.totalTrafficOut);
        if (avgPortsEl) avgPortsEl.textContent = summary.avgActivePorts;
        if (peakActivityEl) peakActivityEl.textContent = summary.period;
    }

    updateTrafficTimeline(timeline) {
        if (!this.trafficChart || !timeline.length) return;

        const labels = timeline.map(item => new Date(item.time).toLocaleTimeString());
        const incomingData = timeline.map(item => item.total_in || 0);
        const outgoingData = timeline.map(item => item.total_out || 0);

        this.trafficChart.data.labels = labels;
        this.trafficChart.data.datasets[0].data = incomingData;
        this.trafficChart.data.datasets[1].data = outgoingData;
        this.trafficChart.update();
    }

    updatePortTrends(trends) {
        if (!this.portTrendsChart || !trends.length) return;

        const labels = trends.slice(0, 10).map(trend => `${trend.port}`);
        const activityData = trends.slice(0, 10).map(trend => trend.activity_ratio);

        this.portTrendsChart.data.labels = labels;
        this.portTrendsChart.data.datasets[0].data = activityData;
        this.portTrendsChart.update();

        // Update top ports list
        this.updateTopPortsList(trends);
    }

    updateTopPortsList(trends) {
        const listContainer = document.getElementById('topPortsList');
        if (!listContainer) return;

        listContainer.innerHTML = trends.slice(0, 10).map(trend => `
            <div class="port-trend-item">
                <div class="port-trend-info">
                    <div class="port-trend-port">Port ${trend.port}</div>
                    <div class="port-trend-process">${this.sanitizeHTML(trend.process || 'Unknown')}</div>
                </div>
                <div class="port-trend-stats">
                    <div class="port-trend-frequency">${trend.frequency}</div>
                    <div class="port-trend-activity">${trend.activity_ratio}% active</div>
                </div>
            </div>
        `).join('');
    }

    initTrafficTab() {
        // Reinitialize charts if they don't exist
        if (!this.trafficChart || !this.portTrendsChart) {
            this.setupCharts();
        }

        // Load analytics data
        this.loadAnalytics();

        // Set up a refresh interval for the traffic tab
        this.refreshTrafficData();
    }

    async refreshTrafficData() {
        try {
            const response = await fetch('/api/traffic/current');
            if (response.ok) {
                const { data } = await response.json();
                this.updateTrafficChart(data.ports || []);
            }
        } catch (error) {
            console.error('Failed to refresh traffic data:', error);
        }
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('portMonitorTheme');
        const theme = savedTheme || 'dark';
        this.applyTheme(theme);
        return theme;
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const themeButton = document.getElementById('themeToggle');
        const themeIcon = themeButton?.querySelector('i');

        if (themeIcon) {
            if (theme === 'light') {
                themeIcon.className = 'fas fa-sun';
                themeButton.title = 'Switch to Dark Mode';
            } else {
                themeIcon.className = 'fas fa-moon';
                themeButton.title = 'Switch to Light Mode';
            }
        }
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(this.currentTheme);
        localStorage.setItem('portMonitorTheme', this.currentTheme);

        // Trigger chart updates for theme change
        if (this.trafficChart) {
            this.trafficChart.update();
        }
        if (this.portTrendsChart) {
            this.portTrendsChart.update();
        }
    }

    updateConnectionStatus(connected) {
        const indicator = document.getElementById('connectionStatus');
        if (indicator) {
            if (connected) {
                indicator.classList.remove('disconnected');
                indicator.querySelector('.status-text').textContent = 'Connected';
            } else {
                indicator.classList.add('disconnected');
                indicator.querySelector('.status-text').textContent = 'Connecting...';
            }
        }
    }

    switchTab(tabName) {
        if (!tabName) return;

        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        const navTab = document.querySelector(`[data-tab="${tabName}"]`);
        const tabContent = document.getElementById(`${tabName}-tab`);

        if (navTab) navTab.classList.add('active');
        if (tabContent) tabContent.classList.add('active');

        // Initialize specific tab content
        if (tabName === 'topology') {
            this.initNetworkTopology();
        } else if (tabName === 'docker') {
            this.loadDockerContainers();
        } else if (tabName === 'traffic') {
            this.initTrafficTab();
        }
    }

    async initNetworkTopology() {
        try {
            console.log('Initializing network topology...');

            const response = await fetch('/api/topology');

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            let data;
            try {
                data = await response.json();
            } catch (jsonError) {
                const text = await response.text();
                console.error('Failed to parse topology response as JSON:', text);
                throw new Error(`Invalid JSON response: ${text.substring(0, 100)}...`);
            }

            console.log('Topology data received:', data);
            console.log('vis.js available:', !!window.vis);

            if (!data.success) {
                console.error('Topology API returned error:', data);
                return;
            }

            if (!window.vis) {
                console.error('vis.js library not available. Check if script is loaded.');
                // Fallback: create a simple HTML-based topology visualization
                this.renderSimpleTopology(data.data);
                return;
            }

            const container = document.getElementById('networkTopology');
            if (!container) {
                console.error('Network topology container not found');
                return;
            }

            console.log('Creating nodes and edges...');

            // Prepare nodes and edges for vis.js
            const nodes = new vis.DataSet(data.data.nodes.map(node => ({
                id: node.id,
                label: node.label,
                color: this.getNodeColor(node.type, node.container),
                size: 30,
                font: { color: '#ffffff', size: 12 }
            })));

            const edges = new vis.DataSet(data.data.edges.map(edge => ({
                from: edge.from,
                to: edge.to,
                label: edge.label,
                color: { color: '#8898aa' },
                arrows: 'to'
            })));

            console.log('Nodes:', nodes.get());
            console.log('Edges:', edges.get());

            const networkData = { nodes, edges };

            const options = {
                nodes: {
                    shape: 'dot',
                    size: 25,
                    font: { color: '#ffffff', size: 14 },
                    borderWidth: 2,
                    shadow: true
                },
                edges: {
                    color: { color: '#8898aa', highlight: '#11cdef' },
                    width: 2,
                    smooth: { type: 'continuous' },
                    arrows: { to: { enabled: true, scaleFactor: 1 } }
                },
                physics: {
                    enabled: true,
                    barnesHut: {
                        gravitationalConstant: -2000,
                        centralGravity: 0.3,
                        springLength: 95,
                        springConstant: 0.04,
                        damping: 0.09
                    },
                    stabilization: { iterations: 200 }
                },
                interaction: {
                    hover: true,
                    tooltipDelay: 200,
                    hideEdgesOnDrag: false
                },
                layout: {
                    improvedLayout: true
                }
            };

            // Create or update network
            if (this.networkGraph) {
                console.log('Destroying existing network...');
                this.networkGraph.destroy();
            }

            console.log('Creating new vis.Network...');
            console.log('Container:', container);
            console.log('NetworkData:', networkData);

            this.networkGraph = new vis.Network(container, networkData, options);

            console.log('Network created successfully:', this.networkGraph);

            // Add event listeners
            this.networkGraph.on('click', (params) => {
                if (params.nodes.length > 0) {
                    const nodeId = params.nodes[0];
                    this.showNodeDetails(nodeId);
                }
            });

            this.networkGraph.on('stabilizationIterationsDone', () => {
                console.log('Network stabilization completed');
            });

            this.networkGraph.on('afterDrawing', () => {
                console.log('Network drawing completed');
            });

            // Setup topology controls
            this.setupTopologyControls();

            console.log('Network topology initialization completed');

        } catch (error) {
            console.error('Failed to initialize network topology:', error);
            // Show error in the container
            const container = document.getElementById('networkTopology');
            if (container) {
                container.innerHTML = `
                    <div style="padding: 20px; color: red; text-align: center;">
                        <h3>Topology Error</h3>
                        <p>Failed to initialize network visualization:</p>
                        <pre style="color: red; text-align: left;">${error.message}</pre>
                    </div>
                `;
            }
        }
    }

    renderSimpleTopology(topologyData) {
        const container = document.getElementById('networkTopology');
        if (!container) return;

        console.log('Rendering simple topology fallback');

        // Create a simple HTML-based visualization
        const nodesHTML = topologyData.nodes.map(node => {
            const color = this.getNodeColor(node.type, node.container);
            return `
                <div class="simple-node" style="
                    display: inline-block;
                    margin: 10px;
                    padding: 10px 15px;
                    background: ${color};
                    color: white;
                    border-radius: 20px;
                    font-size: 12px;
                    text-align: center;
                    min-width: 80px;
                ">
                    ${this.sanitizeHTML(node.label)}
                </div>
            `;
        }).join('');

        const connectionsHTML = topologyData.edges.slice(0, 10).map(edge => `
            <div style="
                padding: 5px 10px;
                margin: 2px 0;
                background: rgba(255,255,255,0.1);
                border-radius: 4px;
                font-size: 12px;
                color: #8898aa;
            ">
                ${edge.from} → ${edge.to} (${edge.label})
            </div>
        `).join('');

        container.innerHTML = `
            <div style="padding: 20px; color: white; height: 100%; overflow-y: auto;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h3 style="margin: 0 0 10px 0;">Network Topology</h3>
                    <p style="margin: 0; color: #8898aa; font-size: 14px;">Simple fallback visualization</p>
                </div>

                <div style="margin-bottom: 30px;">
                    <h4 style="margin: 0 0 15px 0; color: #ffffff;">Active Ports (${topologyData.nodes.length})</h4>
                    <div style="text-align: center; line-height: 1.2;">
                        ${nodesHTML}
                    </div>
                </div>

                <div>
                    <h4 style="margin: 0 0 15px 0; color: #ffffff;">Active Connections (${topologyData.edges.length})</h4>
                    <div style="max-height: 300px; overflow-y: auto;">
                        ${connectionsHTML}
                        ${topologyData.edges.length > 10 ? `
                            <div style="text-align: center; margin-top: 10px; color: #8898aa; font-size: 12px;">
                                ... and ${topologyData.edges.length - 10} more connections
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    getNodeColor(protocol, container) {
        if (container) return '#11cdef'; // Docker containers - cyan
        if (protocol === 'tcp') return '#5e72e4'; // TCP - purple
        if (protocol === 'udp') return '#2dce89'; // UDP - green
        return '#8898aa'; // Default - gray
    }

    setupTopologyControls() {
        document.getElementById('zoomInBtn')?.addEventListener('click', () => {
            if (this.networkGraph) {
                const scale = this.networkGraph.getScale() * 1.2;
                this.networkGraph.moveTo({ scale });
            }
        });

        document.getElementById('zoomOutBtn')?.addEventListener('click', () => {
            if (this.networkGraph) {
                const scale = this.networkGraph.getScale() * 0.8;
                this.networkGraph.moveTo({ scale });
            }
        });

        document.getElementById('fitBtn')?.addEventListener('click', () => {
            if (this.networkGraph) {
                this.networkGraph.fit();
            }
        });
    }

    showNodeDetails(nodeId) {
        const port = this.ports.find(p => String(p.port) === String(nodeId));
        if (port) {
            // Show port details in a modal or panel
            this.displayPortDetailsModal(port);
        }
    }

    displayPortDetailsModal(port) {
        // Create a modal for port details
        const modal = this.createElement('div', {
            className: 'modal port-details-modal active'
        });

        const modalContent = this.createElement('div', { className: 'modal-content' });

        const header = this.createElement('div', { className: 'modal-header' });
        header.innerHTML = `<h2>Port ${port.port} Details</h2><button class="modal-close">&times;</button>`;

        const body = this.createElement('div', { className: 'modal-body' });
        body.innerHTML = `
            <div class="port-detail-grid">
                <div class="detail-item">
                    <strong>Port:</strong> ${port.port}
                </div>
                <div class="detail-item">
                    <strong>Protocol:</strong> ${port.protocol.toUpperCase()}
                </div>
                <div class="detail-item">
                    <strong>Process:</strong> ${this.sanitizeHTML(port.process)}
                </div>
                <div class="detail-item">
                    <strong>PID:</strong> ${port.pid || 'N/A'}
                </div>
                <div class="detail-item">
                    <strong>Container:</strong> ${port.container ? this.sanitizeHTML(port.container) : 'None'}
                </div>
                <div class="detail-item">
                    <strong>Address:</strong> ${this.sanitizeHTML(port.address || '0.0.0.0')}
                </div>
            </div>
        `;

        modalContent.appendChild(header);
        modalContent.appendChild(body);
        modal.appendChild(modalContent);

        document.body.appendChild(modal);

        // Close modal functionality
        modal.querySelector('.modal-close').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    viewPortDetails(portNumber) {
        console.log('View details for port:', portNumber);

        // Find the port data
        const portData = this.ports.find(p => p.port == portNumber);
        if (!portData) {
            this.showNotification(`No information available for port ${portNumber}`, 'warning');
            return;
        }

        // Find security alert for this port if any
        const portAlert = this.alerts.find(a => a.port == portNumber);

        // Create and show a modal with port information
        this.showPortDetailsModal(portData, portAlert);
    }

    showPortDetailsModal(portData, alert) {
        // Remove any existing modal
        const existingModal = document.getElementById('portDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal HTML
        const modalHtml = `
            <div class="modal" id="portDetailsModal" style="display: block;">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2>Port ${portData.port} Details</h2>
                        <button class="modal-close" onclick="document.getElementById('portDetailsModal').remove()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="port-detail-section">
                            <h3>📊 Basic Information</h3>
                            <table class="details-table">
                                <tr><td><strong>Port:</strong></td><td>${portData.port}</td></tr>
                                <tr><td><strong>Protocol:</strong></td><td>${portData.protocol?.toUpperCase() || 'TCP'}</td></tr>
                                <tr><td><strong>Process:</strong></td><td>${this.sanitizeHTML(portData.process || 'Unknown')}</td></tr>
                                <tr><td><strong>PID:</strong></td><td>${portData.pid || 'N/A'}</td></tr>
                                <tr><td><strong>Address:</strong></td><td>${portData.address || '0.0.0.0'}</td></tr>
                                <tr><td><strong>State:</strong></td><td>${portData.state || 'LISTEN'}</td></tr>
                                <tr><td><strong>Type:</strong></td><td>${portData.type || 'Unknown'}</td></tr>
                            </table>
                        </div>

                        ${alert ? `
                        <div class="port-detail-section">
                            <h3>🔒 Security Information</h3>
                            <div class="alert-badge ${alert.severity}">${alert.severity.toUpperCase()}</div>
                            <p>${alert.message}</p>
                            ${alert.recommendations && alert.recommendations.length > 0 ? `
                                <h4>Recommendations:</h4>
                                <ul>
                                    ${alert.recommendations.map(rec => `<li>${this.sanitizeHTML(rec)}</li>`).join('')}
                                </ul>
                            ` : ''}
                        </div>
                        ` : `
                        <div class="port-detail-section">
                            <h3>🔒 Security Information</h3>
                            <p class="safe-status">✅ No security alerts for this port</p>
                        </div>
                        `}

                        ${portData.container ? `
                        <div class="port-detail-section">
                            <h3>🐳 Container Information</h3>
                            <table class="details-table">
                                <tr><td><strong>Container:</strong></td><td>${this.sanitizeHTML(portData.container)}</td></tr>
                                ${portData.containerId ? `<tr><td><strong>Container ID:</strong></td><td>${this.sanitizeHTML(portData.containerId)}</td></tr>` : ''}
                            </table>
                        </div>
                        ` : ''}

                        <div class="port-detail-section">
                            <h3>⏰ Last Seen</h3>
                            <p>${new Date(portData.timestamp || Date.now()).toLocaleString()}</p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="document.getElementById('portDetailsModal').remove()">Close</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Add click outside to close
        const modal = document.getElementById('portDetailsModal');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    addPortToWhitelist(port) {
        document.getElementById('whitelistPort').value = port;
        this.switchTab('security');
    }

    async addToWhitelist() {
        const port = document.getElementById('whitelistPort')?.value;
        const process = document.getElementById('whitelistProcess')?.value;

        if (!port) return;

        try {
            const response = await fetch('/api/security/whitelist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ port: parseInt(port), process })
            });

            if (response.ok) {
                document.getElementById('whitelistPort').value = '';
                document.getElementById('whitelistProcess').value = '';
                this.refresh();
            }
        } catch (error) {
            console.error('Failed to add to whitelist:', error);
        }
    }

    refresh() {
        this.loadInitialData();
    }

    filterPorts(searchTerm) {
        console.log('filterPorts called with searchTerm:', searchTerm);
        this.renderPortsTable();
        this.updateStatistics();
    }

    applyFilters() {
        console.log('applyFilters called');
        this.renderPortsTable();
        this.updateStatistics();
    }

    startAutoRefresh() {
        this.stopAutoRefresh();
        const interval = parseInt(document.getElementById('refreshInterval')?.value || 10) * 1000;
        this.refreshTimer = setInterval(() => this.refresh(), interval);
    }

    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    openSettings() {
        const modal = document.getElementById('settingsModal');
        if (modal) modal.classList.add('active');
    }

    closeSettings() {
        const modal = document.getElementById('settingsModal');
        if (modal) modal.classList.remove('active');
    }

    saveSettings() {
        this.settings = {
            autoRefresh: document.getElementById('autoRefreshToggle')?.checked || false,
            refreshInterval: parseInt(document.getElementById('refreshInterval')?.value || 10),
            notifications: document.getElementById('notificationsToggle')?.checked || false,
            dataRetention: parseInt(document.getElementById('dataRetention')?.value || 30)
        };

        localStorage.setItem('portMonitorSettings', JSON.stringify(this.settings));
        this.closeSettings();

        if (this.settings.autoRefresh) {
            this.startAutoRefresh();
        } else {
            this.stopAutoRefresh();
        }
    }

    loadSettings() {
        const saved = localStorage.getItem('portMonitorSettings');
        return saved ? JSON.parse(saved) : {
            autoRefresh: true,
            refreshInterval: 10,
            notifications: false,
            dataRetention: 30
        };
    }

    async exportData() {
        try {
            const data = {
                ports: this.ports,
                alerts: this.alerts,
                exported_at: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `port-monitor-export-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed:', error);
        }
    }

    updateTrafficChart(portTraffic) {
        if (!this.trafficChart) return;

        const now = new Date().toLocaleTimeString();
        const totalIn = portTraffic.reduce((sum, p) => sum + (p.bytesReceived || 0), 0);
        const totalOut = portTraffic.reduce((sum, p) => sum + (p.bytesSent || 0), 0);

        if (this.trafficChart.data.labels.length > 20) {
            this.trafficChart.data.labels.shift();
            this.trafficChart.data.datasets[0].data.shift();
            this.trafficChart.data.datasets[1].data.shift();
        }

        this.trafficChart.data.labels.push(now);
        this.trafficChart.data.datasets[0].data.push(totalIn);
        this.trafficChart.data.datasets[1].data.push(totalOut);
        this.trafficChart.update();
    }

    renderTopPorts(portTraffic) {
        const topPortsList = document.getElementById('topPortsList');
        if (!topPortsList || !portTraffic) return;

        topPortsList.innerHTML = '';

        const sorted = portTraffic
            .sort((a, b) => (b.bytesReceived + b.bytesSent) - (a.bytesReceived + a.bytesSent))
            .slice(0, 5);

        sorted.forEach(port => {
            const total = port.bytesReceived + port.bytesSent;
            const maxTotal = sorted[0] ? (sorted[0].bytesReceived + sorted[0].bytesSent) : 1;
            const percentage = (total / maxTotal) * 100;

            const item = this.createElement('div', { className: 'port-traffic-item' });
            item.innerHTML = `
                <div>
                    <div>Port ${port.port}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">
                        ${this.formatBytes(total)}
                    </div>
                </div>
                <div style="width: 100px;">
                    <div class="port-traffic-bar" style="width: ${percentage}%"></div>
                </div>
            `;
            topPortsList.appendChild(item);
        });
    }

    async loadDockerContainers() {
        try {
            const response = await fetch('/api/docker/containers');
            const data = await response.json();

            if (!data.success) {
                console.error('Failed to load Docker containers');
                return;
            }

            this.renderDockerContainers(data.data);
        } catch (error) {
            console.error('Error loading Docker containers:', error);
            this.renderDockerContainers([]);
        }
    }

    renderDockerContainers(containers) {
        const containersList = document.getElementById('dockerContainers');
        if (!containersList) return;

        containersList.innerHTML = '';

        if (containers.length === 0) {
            containersList.innerHTML = `
                <div class="no-containers">
                    <i class="fab fa-docker" style="font-size: 48px; color: var(--text-secondary);"></i>
                    <p>No Docker containers found</p>
                </div>
            `;
            return;
        }

        containers.forEach(container => {
            const card = this.createElement('div', { className: 'container-card' });

            const statusClass = container.status === 'running' ? 'running' : 'stopped';
            const ports = container.ports && container.ports.length > 0
                ? container.ports.join(', ')
                : 'No exposed ports';

            card.innerHTML = `
                <div class="container-header">
                    <span class="container-name">${this.sanitizeHTML(container.name)}</span>
                    <span class="container-status ${statusClass}">${container.status}</span>
                </div>
                <div class="container-info">
                    <div class="container-info-item">
                        <span class="container-info-label">Container ID:</span>
                        <span>${this.sanitizeHTML(container.id.substring(0, 12))}</span>
                    </div>
                    <div class="container-info-item">
                        <span class="container-info-label">Image:</span>
                        <span>${this.sanitizeHTML(container.image || 'Unknown')}</span>
                    </div>
                    <div class="container-info-item">
                        <span class="container-info-label">Exposed Ports:</span>
                        <span>${this.sanitizeHTML(ports)}</span>
                    </div>
                    <div class="container-info-item">
                        <span class="container-info-label">Created:</span>
                        <span>${container.created ? new Date(container.created).toLocaleString() : 'Unknown'}</span>
                    </div>
                </div>
                <div class="container-actions">
                    <button class="btn btn-sm container-logs-btn" data-container-id="${container.id}">
                        <i class="fas fa-file-alt"></i> Logs
                    </button>
                    ${container.status === 'running'
                        ? `<button class="btn btn-sm btn-danger container-stop-btn" data-container-id="${container.id}">
                             <i class="fas fa-stop"></i> Stop
                           </button>
                           <button class="btn btn-sm container-restart-btn" data-container-id="${container.id}">
                             <i class="fas fa-redo"></i> Restart
                           </button>`
                        : `<button class="btn btn-sm btn-primary container-start-btn" data-container-id="${container.id}">
                             <i class="fas fa-play"></i> Start
                           </button>`
                    }
                </div>
            `;

            containersList.appendChild(card);
        });
    }

    async viewContainerLogs(containerId) {
        try {
            const response = await fetch(`/api/docker/containers/${containerId}/logs`);
            const data = await response.json();

            if (data.success) {
                this.showLogsModal(containerId, data.data);
            } else {
                this.showError('Failed to fetch container logs');
            }
        } catch (error) {
            console.error('Error fetching container logs:', error);
            this.showError('Failed to fetch container logs');
        }
    }

    showLogsModal(containerId, logs) {
        const modal = this.createElement('div', {
            className: 'modal logs-modal active'
        });

        const modalContent = this.createElement('div', { className: 'modal-content large' });

        const header = this.createElement('div', { className: 'modal-header' });
        header.innerHTML = `
            <h2>Container Logs - ${containerId.substring(0, 12)}</h2>
            <button class="modal-close">&times;</button>
        `;

        const body = this.createElement('div', { className: 'modal-body' });
        const logsContainer = this.createElement('pre', { className: 'logs-container' });
        logsContainer.textContent = logs || 'No logs available';

        body.appendChild(logsContainer);

        const footer = this.createElement('div', { className: 'modal-footer' });
        footer.innerHTML = `
            <button class="btn btn-sm" onclick="app.refreshContainerLogs('${containerId}')">
                <i class="fas fa-sync-alt"></i> Refresh
            </button>
        `;

        modalContent.appendChild(header);
        modalContent.appendChild(body);
        modalContent.appendChild(footer);
        modal.appendChild(modalContent);

        document.body.appendChild(modal);

        // Close modal functionality
        modal.querySelector('.modal-close').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    async stopContainer(containerId) {
        console.log('stopContainer called with ID:', containerId);

        if (!confirm('Are you sure you want to stop this container?')) {
            console.log('User cancelled stop operation');
            return;
        }

        try {
            console.log('Sending stop request...');
            const response = await fetch(`/api/docker/containers/${containerId}/stop`, {
                method: 'POST'
            });

            console.log('Stop response status:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Stop response data:', data);

            if (data.success) {
                this.showNotification('Container stopped successfully', 'success');
                this.loadDockerContainers(); // Refresh the list
            } else {
                this.showError(data.error || 'Failed to stop container');
            }
        } catch (error) {
            console.error('Error stopping container:', error);
            this.showError(`Failed to stop container: ${error.message}`);
        }
    }

    async startContainer(containerId) {
        console.log('startContainer called with ID:', containerId);

        try {
            console.log('Sending start request...');
            const response = await fetch(`/api/docker/containers/${containerId}/start`, {
                method: 'POST'
            });

            console.log('Start response status:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Start response data:', data);

            if (data.success) {
                this.showNotification('Container started successfully', 'success');
                this.loadDockerContainers(); // Refresh the list
            } else {
                this.showError(data.error || 'Failed to start container');
            }
        } catch (error) {
            console.error('Error starting container:', error);
            this.showError(`Failed to start container: ${error.message}`);
        }
    }

    async restartContainer(containerId) {
        if (!confirm('Are you sure you want to restart this container?')) return;

        try {
            const response = await fetch(`/api/docker/containers/${containerId}/restart`, {
                method: 'POST'
            });

            const data = await response.json();
            if (data.success) {
                this.showNotification('Container restarted successfully', 'success');
                this.loadDockerContainers(); // Refresh the list
            } else {
                this.showError('Failed to restart container');
            }
        } catch (error) {
            console.error('Error restarting container:', error);
            this.showError('Failed to restart container');
        }
    }

    async refreshContainerLogs(containerId) {
        try {
            const response = await fetch(`/api/docker/containers/${containerId}/logs?lines=200`);
            const data = await response.json();

            if (data.success) {
                // Update logs in existing modal
                const logsContainer = document.querySelector('.logs-modal .logs-container');
                if (logsContainer) {
                    logsContainer.textContent = data.data || 'No logs available';
                }
            } else {
                this.showError('Failed to refresh container logs');
            }
        } catch (error) {
            console.error('Error refreshing container logs:', error);
            this.showError('Failed to refresh container logs');
        }
    }

    refreshTrafficCharts() {
        // Refresh traffic charts when switching to traffic tab
        if (this.trafficChart) {
            this.trafficChart.update();
        }
    }

    showNotification(message, type = 'info') {
        // Check if notifications are enabled
        if (!this.settings.notifications) return;

        // Browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Port Monitor', {
                body: message,
                icon: '/favicon.ico'
            });
        }

        // In-app notification
        const notification = this.createElement('div', {
            className: `notification notification-${type}`
        });

        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${this.sanitizeHTML(message)}</span>
            <button class="notification-close">&times;</button>
        `;

        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 5000);

        // Manual close
        notification.querySelector('.notification-close').addEventListener('click', () => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        });
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new PortMonitorApp();
});