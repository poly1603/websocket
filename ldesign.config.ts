import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  input: 'src/index.ts',

  output: {
    format: ['esm', 'cjs', ],
    esm: {
      dir: 'es',
      preserveStructure: true,
    },
    cjs: {
      dir: 'lib',
      preserveStructure: true,
    },
    umd: {
      enabled: false,
      dir: 'dist',
      name: 'LDesignWebSocket',
      entry: 'src/index-lib.ts',
    },
  },

  dts: true,
  sourcemap: true,
  minify: false,
  clean: true,

  external: [
    'vue',
    'react',
    'react-dom',
    /^@ldesign\//,
    /^lodash/,
  ],
})
