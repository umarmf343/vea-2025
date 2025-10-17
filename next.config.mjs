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

    config.output = {
      ...config.output,
      // Allow slower environments (e.g. shared hosting) more time to prepare
      // on-demand chunks before the client gives up trying to load them.
      // The default timeout (120s) was causing ChunkLoadError failures for
      // the large home page bundle during the initial build step.
      chunkLoadTimeout: 300000,
    }

    return config
  },
}

export default nextConfig
