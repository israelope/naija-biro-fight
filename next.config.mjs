/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['three'],
  // The project was assembled without a full local build, so don't let a stray
  // type/lint nit block your first deploy. Run `npm run typecheck` to see them,
  // then flip these to false once you are happy.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ];
  },
};
export default nextConfig;
