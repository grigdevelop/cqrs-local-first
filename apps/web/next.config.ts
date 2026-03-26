import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    transpilePackages: ["cqrs", "features", "replicache-sync"],
    serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
