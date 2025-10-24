/**
 * @ldesign/websocket - UMD构建配置
 */

import { defineConfig } from 'rollup'
import esbuild from 'rollup-plugin-esbuild'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import terser from '@rollup/plugin-terser'
import json from '@rollup/plugin-json'

const external = [
  'vue',
  'react',
  'react-dom',
  /^@ldesign\//,
  /^lodash/,
]

const globals = {
  'vue': 'Vue',
  'react': 'React',
  'react-dom': 'ReactDOM',
}

const plugins = [
  nodeResolve({ browser: true, extensions: ['.ts', '.tsx', '.js', '.jsx'] }),
  commonjs(),
  json(),
  esbuild({
    target: 'es2020',
    sourceMap: true,
    minify: false,
  }),
]

export default defineConfig([
  // 常规版本
  {
    input: 'src/index-lib.ts',
    output: {
      file: 'dist/index.js',
      format: 'umd',
      name: 'LDesignWebSocket',
      sourcemap: true,
      globals,
      exports: 'named',
    },
    external,
    plugins,
  },
  // 压缩版本
  {
    input: 'src/index-lib.ts',
    output: {
      file: 'dist/index.min.js',
      format: 'umd',
      name: 'LDesignWebSocket',
      sourcemap: true,
      globals,
      exports: 'named',
    },
    external,
    plugins: [
      ...plugins,
      terser({
        compress: {
          drop_console: false,
        },
        format: {
          comments: false,
        },
      }),
    ],
  },
])

