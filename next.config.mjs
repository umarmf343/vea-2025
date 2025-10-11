/** @type {import('next').NextConfig} */
import path from "node:path"

const buildTarget = process.env.NEXT_BUILD_TARGET === "export" ? "export" : "standalone"

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  output: buildTarget,
  experimental: {
    serverComponentsExternalPackages: ['mysql2'],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(process.cwd()),
    }

    return config
  },
}

export default nextConfig
