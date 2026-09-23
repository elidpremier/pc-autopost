/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Ces packages sont utilisés côté serveur uniquement — Next.js ne les bundle pas
    serverComponentsExternalPackages: [
      'sharp',
      'better-sqlite3',
      'tesseract.js',
      'onnxruntime-node',
      '@huggingface/transformers',
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Côté serveur : empêcher webpack de tenter de bundler les fichiers
      // WASM et MJS d'onnxruntime — ils sont gérés par onnxruntime-node directement
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        '@huggingface/transformers',
        'onnxruntime-node',
      ];
    } else {
      // Côté client : ces modules Node.js ne doivent pas être bundlés dans le navigateur
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        perf_hooks: false,
        'onnxruntime-node': false,
      };
    }
    return config;
  },
};

export default nextConfig;
