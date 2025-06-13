import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable Turbopack for worker development as per documentation
  ...(process.env.NODE_ENV === 'development' && {
    turbo: false
  }),
  
  // Optimize for production builds
  experimental: {
    // Enable optimized package imports
    optimizePackageImports: ['lucide-react'],
  },

  webpack: (config, { isServer, dev }) => {
    // Client-side only configurations
    if (!isServer) {
      // Ensure proper fallbacks for Node.js modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };

      // Optimize worker loading
      config.module.rules.push({
        test: /\.worker\.(js|ts)$/,
        use: {
          loader: 'worker-loader',
          options: {
            name: 'static/[hash].worker.js',
            publicPath: '/_next/',
          },
        },
      });

      // Production optimizations
      if (!dev) {
        // Enable additional optimizations for large datasets
        config.optimization = {
          ...config.optimization,
          splitChunks: {
            ...config.optimization.splitChunks,
            cacheGroups: {
              ...config.optimization.splitChunks?.cacheGroups,
              worker: {
                test: /[\\/]workers[\\/]/,
                name: 'workers',
                chunks: 'all',
                priority: 10,
              },
              vendor: {
                test: /[\\/]node_modules[\\/]/,
                name: 'vendors',
                chunks: 'all',
                priority: 5,
              },
            },
          },
        };
      }
    }

    // Enable detailed webpack stats for debugging worker issues
    if (dev) {
      config.stats = {
        ...config.stats,
        errorDetails: true,
        warnings: true,
      };
    }

    return config;
  },

  // Headers for SharedArrayBuffer support (if needed in future)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
    ];
  },

  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;