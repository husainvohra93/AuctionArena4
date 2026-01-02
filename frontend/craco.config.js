const path = require("path");
require("dotenv").config();

// Environment variable overrides
const config = {
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true",
};

// Conditionally load health check modules only if enabled
let WebpackHealthPlugin;
let setupHealthEndpoints;
let healthPluginInstance;

if (config.enableHealthCheck) {
  try {
    WebpackHealthPlugin = require("./plugins/health-check/webpack-health-plugin");
    setupHealthEndpoints = require("./plugins/health-check/health-endpoints");
    healthPluginInstance = new WebpackHealthPlugin();
  } catch (e) {
    console.warn("Health check plugins not found, disabling health check.");
  }
}

const webpackConfig = {
  alias: {
    "@": path.resolve(__dirname, "src"),
  },
  configure: (webpackConfig) => {

    // Add ignored patterns to reduce watched directories
    webpackConfig.watchOptions = {
      ...webpackConfig.watchOptions,
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/build/**',
        '**/dist/**',
        '**/coverage/**',
      ],
    };

    // Add health check plugin if enabled
    if (config.enableHealthCheck && healthPluginInstance) {
      webpackConfig.plugins.push(healthPluginInstance);
    }
    return webpackConfig;
  },
};

webpackConfig.devServer = (devServerConfig) => {
  // Add health check endpoints if enabled
  if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
    const originalSetupMiddlewares = devServerConfig.setupMiddlewares;
    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      setupHealthEndpoints(devServer.app, healthPluginInstance);
      if (originalSetupMiddlewares) {
        return originalSetupMiddlewares(middlewares, devServer);
      }
      return middlewares;
    };
  }
  return devServerConfig;
};

module.exports = {
  webpack: webpackConfig,
};
