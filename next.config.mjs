/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // مخرجات مستقلة لحاوية Docker (خادم خاص) — لا تؤثر على نشر Vercel
  output: "standalone",
};

export default nextConfig;
