/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@clickup/contracts'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
}

export default nextConfig
