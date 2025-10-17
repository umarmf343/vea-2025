module.exports = {
  apps: [
    {
      name: "vea-2025-portal",
      cwd: __dirname,
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      env: {
        NODE_ENV: "production",
        HOST: "0.0.0.0",
        PORT: String(process.env.PORT || 3100),
        PUBLIC_URL:
          process.env.PUBLIC_URL || "https://portal.victoryeducationalacademy.com.ng",
      },
    },
  ],
}
