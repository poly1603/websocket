/**
 * 消息加密管理器
 * 
 * 提供 WebSocket 消息的端到端加密功能
 * 支持 AES-256-GCM 加密算法，确保消息的机密性和完整性
 * 
 * 注意：此模块需要 @ldesign/crypto 包的支持
 */

import type { EncryptionConfig } from '../types'
import { EncryptionError } from './errors'

/**
 * 默认加密配置
 */
const DEFAULT_CONFIG: Required<EncryptionConfig> = {
  enabled: false,
  algorithm: 'aes-256-gcm',
  key: '',
  iv: '',
}

/**
 * 加密管理器类
 * 
 * 负责消息的加密和解密操作
 */
export class EncryptionManager {
  /** 加密配置 */
  private config: Required<EncryptionConfig>

  /** 加密密钥（二进制） */
  private cryptoKey: CryptoKey | null = null

  /** 是否已初始化 */
  private initialized: boolean = false

  /**
   * 创建加密管理器
   * 
   * @param config - 加密配置选项
   */
  constructor(config?: EncryptionConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 是否启用加密
   */
  get isEnabled(): boolean {
    return this.config.enabled && this.initialized
  }

  /**
   * 初始化加密管理器
   * 
   * 验证配置并导入加密密钥
   * 必须在使用加密功能前调用
   * 
   * @throws {EncryptionError} 如果配置无效或密钥导入失败
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      return
    }

    // 检查浏览器是否支持 Web Crypto API
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      throw new EncryptionError(
        '当前环境不支持 Web Crypto API，无法启用加密功能',
        'encrypt'
      )
    }

    // 验证密钥
    if (!this.config.key) {
      throw new EncryptionError('加密密钥未配置', 'encrypt')
    }

    try {
      // 将密钥字符串转换为 CryptoKey 对象
      const keyBuffer = this.base64ToBuffer(this.config.key)

      this.cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      )

      this.initialized = true
    }
    catch (error) {
      throw new EncryptionError(
        `加密管理器初始化失败: ${error instanceof Error ? error.message : '未知错误'}`,
        'encrypt',
        { originalError: error as Error }
      )
    }
  }

  /**
   * 加密消息
   * 
   * 使用 AES-256-GCM 算法加密消息数据
   * 
   * @param data - 要加密的数据（任意可序列化对象）
   * @returns 加密后的数据（base64 编码的字符串）
   * @throws {EncryptionError} 如果加密失败
   * 
   * @example
   * ```typescript
   * const encrypted = await encryptionManager.encrypt({ message: 'Hello' })
   * // 返回: "base64编码的加密数据..."
   * ```
   */
  async encrypt(data: unknown): Promise<string> {
    if (!this.config.enabled) {
      // 未启用加密，返回原始数据的 JSON 字符串
      return JSON.stringify(data)
    }

    if (!this.initialized || !this.cryptoKey) {
      throw new EncryptionError('加密管理器未初始化', 'encrypt')
    }

    try {
      // 序列化数据
      const jsonString = JSON.stringify(data)
      const dataBuffer = new TextEncoder().encode(jsonString)

      // 生成或使用配置的 IV（初始化向量）
      const iv = this.config.iv
        ? this.base64ToBuffer(this.config.iv)
        : crypto.getRandomValues(new Uint8Array(12))

      // 执行加密
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv,
        },
        this.cryptoKey,
        dataBuffer
      )

      // 将 IV 和加密数据组合在一起
      const resultBuffer = new Uint8Array(iv.byteLength + encryptedBuffer.byteLength)
      resultBuffer.set(new Uint8Array(iv), 0)
      resultBuffer.set(new Uint8Array(encryptedBuffer), iv.byteLength)

      // 转换为 base64
      return this.bufferToBase64(resultBuffer)
    }
    catch (error) {
      throw new EncryptionError(
        `消息加密失败: ${error instanceof Error ? error.message : '未知错误'}`,
        'encrypt',
        { originalError: error as Error }
      )
    }
  }

  /**
   * 解密消息
   * 
   * 解密使用 AES-256-GCM 加密的消息
   * 
   * @param encryptedData - 加密的数据（base64 编码的字符串）
   * @returns 解密后的原始数据
   * @throws {EncryptionError} 如果解密失败
   * 
   * @example
   * ```typescript
   * const decrypted = await encryptionManager.decrypt(encryptedString)
   * console.log(decrypted) // { message: 'Hello' }
   * ```
   */
  async decrypt<T = unknown>(encryptedData: string): Promise<T> {
    if (!this.config.enabled) {
      // 未启用加密，直接解析 JSON
      return JSON.parse(encryptedData) as T
    }

    if (!this.initialized || !this.cryptoKey) {
      throw new EncryptionError('加密管理器未初始化', 'decrypt')
    }

    try {
      // 将 base64 转换为 buffer
      const combinedBuffer = this.base64ToBuffer(encryptedData)

      // 提取 IV 和加密数据
      const iv = combinedBuffer.slice(0, 12)
      const encryptedBuffer = combinedBuffer.slice(12)

      // 执行解密
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv,
        },
        this.cryptoKey,
        encryptedBuffer
      )

      // 转换为字符串并解析 JSON
      const jsonString = new TextDecoder().decode(decryptedBuffer)
      return JSON.parse(jsonString) as T
    }
    catch (error) {
      throw new EncryptionError(
        `消息解密失败: ${error instanceof Error ? error.message : '未知错误'}`,
        'decrypt',
        { originalError: error as Error }
      )
    }
  }

  /**
   * 更新加密配置
   * 
   * @param config - 新的加密配置
   */
  async updateConfig(config: Partial<EncryptionConfig>): Promise<void> {
    this.config = { ...this.config, ...config }

    // 如果密钥改变，需要重新初始化
    if (config.key || config.enabled) {
      this.initialized = false
      this.cryptoKey = null

      if (this.config.enabled) {
        await this.initialize()
      }
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): Readonly<Required<EncryptionConfig>> {
    return { ...this.config }
  }

  /**
   * 销毁加密管理器
   * 
   * 清除密钥和敏感数据
   */
  destroy(): void {
    this.cryptoKey = null
    this.initialized = false
    this.config.key = ''
    this.config.iv = ''
  }

  /**
   * Base64 字符串转 ArrayBuffer
   */
  private base64ToBuffer(base64: string): Uint8Array {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  }

  /**
   * ArrayBuffer 转 Base64 字符串
   */
  private bufferToBase64(buffer: Uint8Array | ArrayBuffer): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  /**
   * 生成随机加密密钥
   * 
   * 生成一个 256 位（32 字节）的随机密钥，用于 AES-256-GCM 加密
   * 
   * @returns Base64 编码的密钥字符串
   * 
   * @example
   * ```typescript
   * const key = EncryptionManager.generateKey()
   * console.log('生成的密钥:', key)
   * ```
   */
  static generateKey(): string {
    const keyBuffer = crypto.getRandomValues(new Uint8Array(32))
    const manager = new EncryptionManager()
    return manager.bufferToBase64(keyBuffer)
  }

  /**
   * 生成随机 IV（初始化向量）
   * 
   * 生成一个 96 位（12 字节）的随机 IV，用于 AES-GCM 加密
   * 
   * @returns Base64 编码的 IV 字符串
   */
  static generateIV(): string {
    const ivBuffer = crypto.getRandomValues(new Uint8Array(12))
    const manager = new EncryptionManager()
    return manager.bufferToBase64(ivBuffer)
  }
}



