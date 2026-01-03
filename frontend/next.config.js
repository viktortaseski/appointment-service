/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
};

if (process.env.DEBUG_BUILD === 'true') {
  // eslint-disable-next-line no-console
  console.log('[build] next.config', {
    output: nextConfig.output,
    nodeEnv: process.env.NODE_ENV,
  });
}

module.exports = nextConfig;
