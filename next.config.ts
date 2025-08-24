import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // ❗ Ignora problemas de ESLint apenas durante o build de produção
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
