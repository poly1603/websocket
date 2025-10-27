/**
 * 批量发送管理器
 * 
 * 将多个小消息合并为一次发送，减少网络开销，提高传输效率
 * 
 * 工作原理：
 * 1. 消息加入发送缓冲区
 * 2. 达到批量大小或超时时间后，批量发送
 * 3. 服务器收到后拆分处理
 * 
 * 优势：
 * - 减少网络往返次数
 * - 降低协议开销
 * - 提高吞吐量
 * - 更好的 CPU 缓存利用
 * 
 * 适用场景：
 * - 高频小消息发送
 * - 游戏状态同步
 * - 实时数据上报
 * - 日志批量上传
 * 
 * @example
 * ```typescript
 * const batcher = new BatchSender({
 *   maxSize: 10,      // 最多 10 条消息批量发送
 *   maxWait: 100,     // 最多等待 100ms
 * })
 * 
 * // 设置实际的发送函数
 * batcher.setSendFunction((messages) => {
 *   websocket.send({ type: 'batch', messages })
 * })
 * 
 * // 添加消息到批处理
 * batcher.add({ type: 'log', message: 'Log 1' })
 * batcher.add({ type: 'log', message: 'Log 2' })
 * // ... 当达到条件时自动批量发送
 * ```
 */

/**
 * 批量发送配置
 */
export interface BatchSenderConfig {
  /** 是否启用批量发送 */
  enabled?: boolean
  /** 批量最大消息数 */
  maxSize?: number
  /** 最大等待时间（毫秒） */
  maxWait?: number
  /** 批量最大字节数 */
  maxBytes?: number
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<BatchSenderConfig> = {
  enabled: true,
  maxSize: 10,        // 最多 10 条消息
  maxWait: 100,       // 最多等待 100ms
  maxBytes: 64 * 1024, // 64KB
}

/**
 * 批量发送管理器类
 * 
 * 管理消息的批量发送，自动合并和调度
 */
export class BatchSender {
  /** 批量发送配置 */
  private config: Required<BatchSenderConfig>

  /** 消息缓冲区 */
  private buffer: unknown[] = []

  /** 缓冲区总字节数 */
  private bufferBytes: number = 0

  /** 批量发送定时器 */
  private flushTimer: ReturnType<typeof setTimeout> | null = null

  /** 实际的发送函数 */
  private sendFn: ((messages: unknown[]) => void) | null = null

  /** 统计信息 */
  private stats = {
    batchesSent: 0,
    messagesSent: 0,
    bytesSent: 0,
  }

  /**
   * 创建批量发送管理器
   * 
   * @param config - 批量发送配置
   */
  constructor(config?: BatchSenderConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 是否启用批量发送
   */
  get isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * 获取缓冲区大小
   */
  get bufferSize(): number {
    return this.buffer.length
  }

  /**
   * 设置发送函数
   * 
   * @param sendFn - 批量发送函数，接收消息数组
   */
  setSendFunction(sendFn: (messages: unknown[]) => void): void {
    this.sendFn = sendFn
  }

  /**
   * 添加消息到批处理缓冲区
   * 
   * 如果达到批量条件（大小、字节数或时间），会自动触发发送
   * 
   * @param message - 要发送的消息
   * 
   * @example
   * ```typescript
   * batcher.add({ type: 'metrics', cpu: 45, memory: 60 })
   * batcher.add({ type: 'metrics', cpu: 46, memory: 61 })
   * // 当达到批量条件时自动发送
   * ```
   */
  add(message: unknown): void {
    if (!this.config.enabled) {
      // 未启用批量发送，立即发送
      this.sendImmediate([message])
      return
    }

    // 估算消息大小
    const messageSize = this.estimateSize(message)

    // 添加到缓冲区
    this.buffer.push(message)
    this.bufferBytes += messageSize

    // 检查是否需要立即发送
    const shouldFlush =
      this.buffer.length >= this.config.maxSize ||  // 达到最大消息数
      this.bufferBytes >= this.config.maxBytes      // 达到最大字节数

    if (shouldFlush) {
      // 立即发送
      this.flush()
    }
    else if (!this.flushTimer) {
      // 设置定时器，在 maxWait 后发送
      this.flushTimer = setTimeout(() => {
        this.flush()
      }, this.config.maxWait)
    }
  }

  /**
   * 立即发送缓冲区中的所有消息
   * 
   * 清空缓冲区并发送所有消息
   * 
   * @example
   * ```typescript
   * // 强制立即发送，不等待批量条件
   * batcher.flush()
   * ```
   */
  flush(): void {
    // 清除定时器
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }

    // 如果缓冲区为空，直接返回
    if (this.buffer.length === 0) {
      return
    }

    // 发送消息
    this.sendImmediate([...this.buffer])

    // 清空缓冲区
    this.buffer = []
    this.bufferBytes = 0
  }

  /**
   * 立即发送消息（内部方法）
   * 
   * @param messages - 消息数组
   */
  private sendImmediate(messages: unknown[]): void {
    if (!this.sendFn) {
      console.error('[BatchSender] 发送函数未设置')
      return
    }

    try {
      this.sendFn(messages)

      // 更新统计信息
      this.stats.batchesSent++
      this.stats.messagesSent += messages.length
      this.stats.bytesSent += messages.reduce((sum, msg) => sum + this.estimateSize(msg), 0)
    }
    catch (error) {
      console.error('[BatchSender] 批量发送失败:', error)
      throw error
    }
  }

  /**
   * 估算消息大小
   */
  private estimateSize(message: unknown): number {
    try {
      return JSON.stringify(message).length
    }
    catch {
      return 1024 // 默认 1KB
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      /** 当前缓冲区消息数 */
      bufferSize: this.buffer.length,
      /** 当前缓冲区字节数 */
      bufferBytes: this.bufferBytes,
      /** 平均批量大小 */
      averageBatchSize: this.stats.batchesSent > 0
        ? this.stats.messagesSent / this.stats.batchesSent
        : 0,
    }
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      batchesSent: 0,
      messagesSent: 0,
      bytesSent: 0,
    }
  }

  /**
   * 更新配置
   * 
   * @param config - 新的配置项
   */
  updateConfig(config: Partial<BatchSenderConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取当前配置
   */
  getConfig(): Readonly<Required<BatchSenderConfig>> {
    return { ...this.config }
  }

  /**
   * 销毁批量发送器
   * 
   * 发送所有剩余消息并清理资源
   */
  destroy(): void {
    // 发送剩余消息
    this.flush()

    // 清理
    this.sendFn = null
    this.buffer = []
    this.bufferBytes = 0
  }
}


