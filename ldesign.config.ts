import { defineConfig } from '@ldesign/builder'

export default defineConfig({
  input: 'src/index.ts',

  output: {
    format: ['esm', 'cjs', 'umd'],

    // ESM输出 - 保留目录结构
    esm: {
      dir: 'es',
      preserveStructure: true,
    },

    // CJS输出 - 保留目录结构
    cjs: {
      dir: 'lib',
      preserveStructure: true,
    },

    // UMD输出 - 打包为单文件
    umd: {
      dir: 'dist',
      name: 'LDesignWebSocket',
    },
  },

  // 生成TypeScript声明文件
  dts: true,

  // 生成sourcemap
  sourcemap: true,

  // 不压缩(由builder自动处理压缩版本)
  minify: false,

  // 构建前清理
  clean: true,

  // 外部依赖(不打包)
  external: [
    'vue',
    'react',
    'react-dom',
    /^@ldesign\//,
    /^lodash/,
  ],

  // TypeScript配置
  typescript: {
    declaration: true,
    declarationMap: true,
  },
})
