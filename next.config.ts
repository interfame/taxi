import type { NextConfig } from "next";

// En Vercel (serverless) no se usa output standalone: Vercel empaqueta con su
// propio file tracing. En el resto de los entornos se mantiene el standalone.
const isVercel = process.env.VERCEL === "1" || process.env.NEXT_PUBLIC_VERCEL_ENV === "1";

const nextConfig: NextConfig = {
  ...(isVercel ? {} : { output: "standalone" }),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Incluir el motor de Prisma y la base SQLite demo dentro de las funciones
  // serverless, para que /api/* pueda leer la base incluida en el bundle.
  // Se usan varios patrones de ruta para asegurar el match en todos los casos.
  outputFileTracingIncludes: {
    "/**": ["./db/custom.db", "./node_modules/.prisma/client/**"],
    "/**/*": ["./db/custom.db", "./node_modules/.prisma/client/**"],
    "/api/*": ["./db/custom.db", "./node_modules/.prisma/client/**"],
    "/": ["./db/custom.db", "./node_modules/.prisma/client/**"],
  },
};

export default nextConfig;
