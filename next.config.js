/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.E2E_RUN === "1" ? ".next-e2e" : ".next",
};

module.exports = nextConfig;
