module.exports = {
  apps: [
    {
      name: "vea-2025-portal",
      script: "npm",
      args: "start",
      cwd: __dirname,
      interpreter: "none",
      exec_mode: "fork",
      instances: 1,
      watch: false,
      autorestart: true,
      env: {
        NODE_ENV: process.env.NODE_ENV || "production",
        PORT: process.env.PORT || 3000,
        HOST: process.env.HOST || "0.0.0.0"
      }
    }
  ]
}
