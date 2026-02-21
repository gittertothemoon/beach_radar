/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/landing",
        destination: "/",
        permanent: true,
      },
      {
        source: "/landing/index.html",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
