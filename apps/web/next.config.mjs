/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@clickup/contracts'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
}

export default nextConfig
