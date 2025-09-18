const Docker = require('dockerode');

class DockerIntegration {
    constructor() {
        this.dockerAvailable = false;
        this.initDocker();
    }

    async initDocker() {
        try {
            // Try different socket paths for different environments
            const socketPaths = [
                '/var/run/docker.sock',
                '/host/var/run/docker.sock',
                process.env.DOCKER_SOCKET || '/var/run/docker.sock'
            ];

            for (const socketPath of socketPaths) {
                try {
                    this.docker = new Docker({ socketPath });
                    // Test connection
                    await this.docker.ping();
                    this.dockerAvailable = true;
                    console.log(`Docker connected via: ${socketPath}`);
                    break;
                } catch (err) {
                    console.log(`Failed to connect to Docker via ${socketPath}: ${err.message}`);
                }
            }

            if (!this.dockerAvailable) {
                console.warn('Docker integration disabled: No accessible Docker socket found');
                console.warn('Make sure Docker socket is mounted and container has proper permissions');
            }
        } catch (error) {
            console.error('Docker initialization error:', error.message);
            this.dockerAvailable = false;
        }
    }

    async getContainerPorts() {
        if (!this.dockerAvailable) {
            return [];
        }

        try {
            const containers = await this.docker.listContainers();
            const containerPorts = [];

            for (const containerInfo of containers) {
                const container = this.docker.getContainer(containerInfo.Id);
                const details = await container.inspect();

                if (details.NetworkSettings && details.NetworkSettings.Ports) {
                    Object.entries(details.NetworkSettings.Ports).forEach(([containerPort, hostBindings]) => {
                        if (hostBindings) {
                            hostBindings.forEach(binding => {
                                if (binding.HostPort) {
                                    containerPorts.push({
                                        id: containerInfo.Id.substring(0, 12),
                                        name: containerInfo.Names[0].replace('/', ''),
                                        image: containerInfo.Image,
                                        port: parseInt(binding.HostPort),
                                        containerPort: parseInt(containerPort.split('/')[0]),
                                        protocol: containerPort.split('/')[1] || 'tcp',
                                        status: containerInfo.State,
                                        created: new Date(containerInfo.Created * 1000).toISOString()
                                    });
                                }
                            });
                        }
                    });
                }
            }

            return containerPorts;
        } catch (error) {
            console.error('Docker integration error:', error);
            return [];
        }
    }

    async getContainerLogs(containerId, lines = 100) {
        if (!this.dockerAvailable) {
            throw new Error('Docker not available');
        }

        try {
            const container = this.docker.getContainer(containerId);
            const stream = await container.logs({
                stdout: true,
                stderr: true,
                tail: lines,
                timestamps: true
            });

            return stream.toString('utf-8');
        } catch (error) {
            console.error('Error getting container logs:', error);
            return null;
        }
    }

    async getContainerStats(containerId) {
        if (!this.dockerAvailable) {
            return null;
        }

        try {
            const container = this.docker.getContainer(containerId);
            const statsStream = await container.stats({ stream: false });

            const cpuPercent = this.calculateCPUPercent(statsStream);
            const memoryUsage = this.calculateMemoryUsage(statsStream);
            const networkIO = this.calculateNetworkIO(statsStream);

            return {
                cpu: cpuPercent,
                memory: memoryUsage,
                network: networkIO
            };
        } catch (error) {
            console.error('Error getting container stats:', error);
            return null;
        }
    }

    calculateCPUPercent(stats) {
        const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
        const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
        const cpuCount = stats.cpu_stats.online_cpus || 1;

        if (systemDelta > 0 && cpuDelta > 0) {
            return ((cpuDelta / systemDelta) * cpuCount * 100).toFixed(2);
        }
        return 0;
    }

    calculateMemoryUsage(stats) {
        const usedMemory = stats.memory_stats.usage - (stats.memory_stats.stats.cache || 0);
        const limit = stats.memory_stats.limit;

        return {
            used: usedMemory,
            limit: limit,
            percent: ((usedMemory / limit) * 100).toFixed(2)
        };
    }

    calculateNetworkIO(stats) {
        const networks = stats.networks || {};
        let rx = 0, tx = 0;

        Object.values(networks).forEach(net => {
            rx += net.rx_bytes || 0;
            tx += net.tx_bytes || 0;
        });

        return { rx, tx };
    }

    async restartContainer(containerId) {
        if (!this.dockerAvailable) {
            throw new Error('Docker not available');
        }

        try {
            const container = this.docker.getContainer(containerId);
            await container.restart();
            return true;
        } catch (error) {
            console.error('Error restarting container:', error);
            return false;
        }
    }

    async stopContainer(containerId) {
        if (!this.dockerAvailable) {
            throw new Error('Docker not available');
        }

        try {
            const container = this.docker.getContainer(containerId);
            await container.stop();
            return true;
        } catch (error) {
            console.error('Error stopping container:', error);
            return false;
        }
    }

    async startContainer(containerId) {
        if (!this.dockerAvailable) {
            throw new Error('Docker not available');
        }

        try {
            const container = this.docker.getContainer(containerId);
            await container.start();
            return true;
        } catch (error) {
            console.error('Error starting container:', error);
            return false;
        }
    }

    async getAllContainers() {
        if (!this.dockerAvailable) {
            return [];
        }

        try {
            const containers = await this.docker.listContainers({ all: true });
            const detailedContainers = [];

            for (const containerInfo of containers) {
                const container = this.docker.getContainer(containerInfo.Id);
                const details = await container.inspect();

                const ports = [];
                if (details.NetworkSettings && details.NetworkSettings.Ports) {
                    Object.entries(details.NetworkSettings.Ports).forEach(([containerPort, hostBindings]) => {
                        if (hostBindings) {
                            hostBindings.forEach(binding => {
                                if (binding.HostPort) {
                                    ports.push(parseInt(binding.HostPort));
                                }
                            });
                        }
                    });
                }

                detailedContainers.push({
                    id: containerInfo.Id,
                    name: containerInfo.Names[0].replace('/', ''),
                    image: containerInfo.Image,
                    status: containerInfo.State,
                    created: new Date(containerInfo.Created * 1000).toISOString(),
                    ports: ports
                });
            }

            return detailedContainers;
        } catch (error) {
            console.error('Docker integration error:', error);
            return [];
        }
    }
}

module.exports = DockerIntegration;