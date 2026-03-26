import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    transpilePackages: ["cqrs", "replicache-sync"],
    serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
