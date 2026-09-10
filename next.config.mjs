/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['sharp', 'better-sqlite3', 'tesseract.js'],
  },
};

export default nextConfig;
