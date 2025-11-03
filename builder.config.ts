import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  entry: 'src/index.ts',
  
  output: {
    formats: ['esm', 'cjs', 'dts'],
    esm: {
      dir: 'es',
      minify: false
    },
    cjs: {
      dir: 'lib',
      minify: false
    },
    dts: {
      dir: 'es',
      only: false
    }
  },

  bundler: 'rollup',

  sourcemap: true
})
