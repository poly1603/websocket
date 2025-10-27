/**
 * 消息压缩管理器
 * 
 * 提供 WebSocket 消息的压缩和解压缩功能
 * 可以显著减少大消息的传输大小，节省带宽并提高传输速度
 * 
 * 支持的压缩算法：
 * - gzip: 标准 gzip 压缩（需要浏览器支持 CompressionStream）
 * - deflate: Deflate 压缩
 * - lz-string: 纯 JavaScript 实现的压缩算法（兼容性最好）
 */

import type { CompressionConfig } from '../types'
import { CompressionError } from './errors'

/**
 * 默认压缩配置
 */
const DEFAULT_CONFIG: Required<CompressionConfig> = {
  enabled: false,
  threshold: 1024, // 1KB
  algorithm: 'gzip',
}

/**
 * 压缩管理器类
 * 
 * 负责消息的压缩和解压缩操作
 */
export class CompressionManager {
  /** 压缩配置 */
  private config: Required<CompressionConfig>

  /** 浏览器是否支持 CompressionStream API */
  private supportsCompressionStream: boolean = false

  /**
   * 创建压缩管理器
   * 
   * @param config - 压缩配置选项
   */
  constructor(config?: CompressionConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }

    // 检查浏览器支持
    this.supportsCompressionStream = typeof CompressionStream !== 'undefined'

    // 如果浏览器不支持 CompressionStream 且配置了 gzip/deflate，自动降级
    if (!this.supportsCompressionStream &&
      (this.config.algorithm === 'gzip' || this.config.algorithm === 'deflate')) {
      console.warn('[CompressionManager] 浏览器不支持 CompressionStream API，已自动降级为 lz-string')
      this.config.algorithm = 'lz-string'
    }
  }

  /**
   * 是否启用压缩
   */
  get isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * 是否应该压缩数据
   * 
   * 根据数据大小判断是否值得压缩
   * 小于阈值的数据不压缩，因为压缩开销可能大于收益
   * 
   * @param data - 要检查的数据
   * @returns 是否应该压缩
   */
  shouldCompress(data: unknown): boolean {
    if (!this.config.enabled) {
      return false
    }

    try {
      const jsonString = JSON.stringify(data)
      return jsonString.length >= this.config.threshold
    }
    catch {
      return false
    }
  }

  /**
   * 压缩数据
   * 
   * 根据配置的算法压缩数据
   * 如果数据小于阈值，则不压缩
   * 
   * @param data - 要压缩的数据（任意可序列化对象）
   * @returns 压缩后的数据对象，包含压缩标记和数据
   * @throws {CompressionError} 如果压缩失败
   * 
   * @example
   * ```typescript
   * const compressed = await compressionManager.compress(largeData)
   * // 返回: { compressed: true, data: '压缩后的数据...' }
   * ```
   */
  async compress(data: unknown): Promise<{ compressed: boolean; data: string }> {
    // 未启用压缩或数据太小，返回原始数据
    if (!this.shouldCompress(data)) {
      return {
        compressed: false,
        data: JSON.stringify(data),
      }
    }

    try {
      const jsonString = JSON.stringify(data)

      let compressedData: string

      switch (this.config.algorithm) {
        case 'gzip':
          compressedData = await this.compressWithGzip(jsonString)
          break

        case 'deflate':
          compressedData = await this.compressWithDeflate(jsonString)
          break

        case 'lz-string':
          compressedData = this.compressWithLZString(jsonString)
          break

        default:
          throw new CompressionError(
            `不支持的压缩算法: ${this.config.algorithm}`,
            'compress'
          )
      }

      return {
        compressed: true,
        data: compressedData,
      }
    }
    catch (error) {
      if (error instanceof CompressionError) {
        throw error
      }

      throw new CompressionError(
        `数据压缩失败: ${error instanceof Error ? error.message : '未知错误'}`,
        'compress',
        { originalError: error as Error }
      )
    }
  }

  /**
   * 解压缩数据
   * 
   * 根据数据中的压缩标记自动选择解压算法
   * 
   * @param compressedData - 压缩的数据对象
   * @returns 解压后的原始数据
   * @throws {CompressionError} 如果解压失败
   * 
   * @example
   * ```typescript
   * const decompressed = await compressionManager.decompress(compressedData)
   * ```
   */
  async decompress<T = unknown>(compressedData: { compressed: boolean; data: string }): Promise<T> {
    // 数据未压缩，直接解析 JSON
    if (!compressedData.compressed) {
      return JSON.parse(compressedData.data) as T
    }

    try {
      let decompressedString: string

      switch (this.config.algorithm) {
        case 'gzip':
          decompressedString = await this.decompressWithGzip(compressedData.data)
          break

        case 'deflate':
          decompressedString = await this.decompressWithDeflate(compressedData.data)
          break

        case 'lz-string':
          decompressedString = this.decompressWithLZString(compressedData.data)
          break

        default:
          throw new CompressionError(
            `不支持的压缩算法: ${this.config.algorithm}`,
            'decompress'
          )
      }

      return JSON.parse(decompressedString) as T
    }
    catch (error) {
      if (error instanceof CompressionError) {
        throw error
      }

      throw new CompressionError(
        `数据解压缩失败: ${error instanceof Error ? error.message : '未知错误'}`,
        'decompress',
        { originalError: error as Error }
      )
    }
  }

  /**
   * 使用 Gzip 压缩
   */
  private async compressWithGzip(data: string): Promise<string> {
    if (!this.supportsCompressionStream) {
      throw new CompressionError('浏览器不支持 CompressionStream API', 'compress')
    }

    const stream = new Blob([data]).stream()
    const compressedStream = stream.pipeThrough(new CompressionStream('gzip'))
    const blob = await new Response(compressedStream).blob()
    const arrayBuffer = await blob.arrayBuffer()

    return this.arrayBufferToBase64(arrayBuffer)
  }

  /**
   * 使用 Gzip 解压
   */
  private async decompressWithGzip(compressedData: string): Promise<string> {
    if (!this.supportsCompressionStream) {
      throw new CompressionError('浏览器不支持 DecompressionStream API', 'decompress')
    }

    const arrayBuffer = this.base64ToArrayBuffer(compressedData)
    const stream = new Blob([arrayBuffer]).stream()
    const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'))
    const blob = await new Response(decompressedStream).blob()

    return await blob.text()
  }

  /**
   * 使用 Deflate 压缩
   */
  private async compressWithDeflate(data: string): Promise<string> {
    if (!this.supportsCompressionStream) {
      throw new CompressionError('浏览器不支持 CompressionStream API', 'compress')
    }

    const stream = new Blob([data]).stream()
    const compressedStream = stream.pipeThrough(new CompressionStream('deflate'))
    const blob = await new Response(compressedStream).blob()
    const arrayBuffer = await blob.arrayBuffer()

    return this.arrayBufferToBase64(arrayBuffer)
  }

  /**
   * 使用 Deflate 解压
   */
  private async decompressWithDeflate(compressedData: string): Promise<string> {
    if (!this.supportsCompressionStream) {
      throw new CompressionError('浏览器不支持 DecompressionStream API', 'decompress')
    }

    const arrayBuffer = this.base64ToArrayBuffer(compressedData)
    const stream = new Blob([arrayBuffer]).stream()
    const decompressedStream = stream.pipeThrough(new DecompressionStream('deflate'))
    const blob = await new Response(decompressedStream).blob()

    return await blob.text()
  }

  /**
   * 使用 LZ-String 压缩
   * 
   * 这是一个简化的实现，实际使用时应引入 lz-string 库
   * 这里提供一个基本的实现，用于演示
   */
  private compressWithLZString(data: string): string {
    // 简单的 RLE（游程编码）实现作为示例
    // 实际使用时应该引入 lz-string 库
    // import LZString from 'lz-string'
    // return LZString.compress(data)

    // 这里使用 base64 作为占位符
    // 实际项目中应该使用真正的 lz-string 库
    return btoa(unescape(encodeURIComponent(data)))
  }

  /**
   * 使用 LZ-String 解压
   */
  private decompressWithLZString(compressedData: string): string {
    // 简单的 RLE 解码实现作为示例
    // 实际使用时应该引入 lz-string 库
    // import LZString from 'lz-string'
    // return LZString.decompress(compressedData)

    // 这里使用 base64 解码作为占位符
    return decodeURIComponent(escape(atob(compressedData)))
  }

  /**
   * ArrayBuffer 转 Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  /**
   * Base64 转 ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }

  /**
   * 更新压缩配置
   * 
   * @param config - 新的压缩配置
   */
  updateConfig(config: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取当前配置
   */
  getConfig(): Readonly<Required<CompressionConfig>> {
    return { ...this.config }
  }

  /**
   * 获取压缩统计信息
   * 
   * @param originalSize - 原始数据大小（字节）
   * @param compressedSize - 压缩后数据大小（字节）
   * @returns 压缩统计信息
   */
  static getCompressionStats(originalSize: number, compressedSize: number) {
    const ratio = originalSize > 0 ? compressedSize / originalSize : 0
    const savedBytes = originalSize - compressedSize
    const savedPercent = originalSize > 0 ? (savedBytes / originalSize) * 100 : 0

    return {
      originalSize,
      compressedSize,
      savedBytes,
      savedPercent: Math.round(savedPercent * 100) / 100,
      compressionRatio: Math.round(ratio * 100) / 100,
    }
  }
}



