import type { NextConfig } from 'next';
import path from 'node:path';
const config: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['exceljs'],
  poweredByHeader: false,
  turbopack: { root: path.resolve('.') },
  outputFileTracingIncludes: { '/*': ['./src/data/sheet-snapshot.json'] },
};
export default config;
