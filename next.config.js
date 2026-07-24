/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // puppeteer-core y @sparticuz/chromium se resuelven en runtime de Node,
    // no deben pasar por el bundler de Next
    serverComponentsExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],
  },
};

module.exports = nextConfig;
