import esbuild from 'esbuild';

const config = {
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: 'dist',
  packages: 'external',
  // Explicitly mark Node.js built-in modules as external
  external: [
    'crypto',
    'fs',
    'path',
    'http',
    'https', 
    'url',
    'os',
    'util',
    'stream',
    'zlib',
    'querystring',
    'events',
    'buffer',
    'net',
    'dns',
    'tls',
    'child_process',
    'cluster',
    'worker_threads',
    'readline',
    'perf_hooks',
    'async_hooks'
  ]
};

try {
  await esbuild.build(config);
  console.log('✅ Server build completed successfully');
} catch (error) {
  console.error('❌ Server build failed:', error);
  process.exit(1);
}