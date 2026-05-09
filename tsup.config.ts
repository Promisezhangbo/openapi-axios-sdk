import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    runtime: 'src/runtime.ts',
    config: 'src/config.ts',
  },
  format: ['esm'],
  target: 'node18',
  dts: true,
  clean: true,
  sourcemap: false,
  splitting: false,
  treeshake: true,
  minify: false,
  shims: false,
  external: ['axios', 'jiti', '@apidevtools/swagger-parser', '@hey-api/client-axios', '@hey-api/openapi-ts'],
});
