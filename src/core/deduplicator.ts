/**
 * 消息去重管理器
 * 
 * 防止重复消息的处理，提高系统可靠性
 * 
 * 去重策略：
 * - 基于消息 ID 的精确去重
 * - 基于内容哈希的去重
 * - 时间窗口去重（只在指定时间内去重）
 * - 布隆过滤器优化（大规模去重）
 * 
 * 应用场景：
 * - 防止网络波动导致的重复消息
 * - 防止重连后的消息重放
 * - 幂等性保证
 * - 提高系统可靠性
 * 
 * @example
 * ```typescript
 * const dedup = new MessageDeduplicator({
 *   windowSize: 60000,  // 60 秒内去重
 *   maxSize: 1000       // 最多记录 1000 条
 * })
 * 
 * // 检查消息是否重复
 * if (!dedup.isDuplicate(message)) {
 *   processMessage(message)
 *   dedup.markProcessed(message)
 * }
 * ```
 */

/**
 * 去重配置
 */
export interface DeduplicatorConfig {
  /** 是否启用去重 */
  enabled?: boolean
  /** 去重时间窗口（毫秒） */
  windowSize?: number
  /** 最大记录数 */
  maxSize?: number
  /** 去重策略：'id'（基于 ID）或 'content'（基于内容哈希） */
  strategy?: 'id' | 'content' | 'both'
  /** 消息 ID 字段名 */
  idField?: string
}

/**
 * 消息记录
 */
interface MessageRecord {
  /** 消息 ID 或哈希 */
  key: string
  /** 记录时间戳 */
  timestamp: number
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<DeduplicatorConfig> = {
  enabled: true,
  windowSize: 60000,  // 60 秒
  maxSize: 10000,     // 最多记录 10000 条
  strategy: 'both',   // 同时使用 ID 和内容去重
  idField: 'id',
}

/**
 * 消息去重管理器类
 * 
 * 跟踪已处理的消息，防止重复处理
 */
export class MessageDeduplicator {
  /** 去重配置 */
  private config: Required<DeduplicatorConfig>

  /** 已处理消息的记录集合 */
  private processedMessages: Map<string, MessageRecord> = new Map()

  /** 清理定时器 */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  /** 统计信息 */
  private stats = {
    totalChecked: 0,
    duplicateCount: 0,
    uniqueCount: 0,
  }

  /**
   * 创建消息去重管理器
   * 
   * @param config - 去重配置选项
   */
  constructor(config?: DeduplicatorConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }

    // 启动定期清理
    if (this.config.enabled) {
      this.startCleanup()
    }
  }

  /**
   * 是否启用去重
   */
  get isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * 获取已记录的消息数量
   */
  get recordCount(): number {
    return this.processedMessages.size
  }

  /**
   * 检查消息是否重复
   * 
   * @param data - 消息数据
   * @returns 如果是重复消息返回 true，否则返回 false
   * 
   * @example
   * ```typescript
   * const message = { id: '12345', type: 'chat', content: 'Hello' }
   * 
   * if (deduplicator.isDuplicate(message)) {
   *   console.log('重复消息，已忽略')
   * } else {
   *   processMessage(message)
   *   deduplicator.markProcessed(message)
   * }
   * ```
   */
  isDuplicate(data: unknown): boolean {
    if (!this.config.enabled) {
      return false
    }

    this.stats.totalChecked++

    const keys = this.extractKeys(data)

    // 检查任意一个 key 是否已存在
    for (const key of keys) {
      if (this.processedMessages.has(key)) {
        this.stats.duplicateCount++
        return true
      }
    }

    this.stats.uniqueCount++
    return false
  }

  /**
   * 标记消息已处理
   * 
   * 将消息添加到已处理记录中
   * 
   * @param data - 消息数据
   */
  markProcessed(data: unknown): void {
    if (!this.config.enabled) {
      return
    }

    const keys = this.extractKeys(data)
    const timestamp = Date.now()

    for (const key of keys) {
      // 检查是否已达到最大记录数
      if (this.processedMessages.size >= this.config.maxSize) {
        // 移除最旧的记录
        this.removeOldest()
      }

      this.processedMessages.set(key, { key, timestamp })
    }
  }

  /**
   * 提取消息的去重键
   * 
   * 根据配置的策略提取 ID 或生成内容哈希
   */
  private extractKeys(data: unknown): string[] {
    const keys: string[] = []

    // 基于 ID 的去重
    if (this.config.strategy === 'id' || this.config.strategy === 'both') {
      const id = this.extractId(data)
      if (id) {
        keys.push(`id:${id}`)
      }
    }

    // 基于内容的去重
    if (this.config.strategy === 'content' || this.config.strategy === 'both') {
      const hash = this.hashContent(data)
      keys.push(`hash:${hash}`)
    }

    return keys
  }

  /**
   * 提取消息 ID
   */
  private extractId(data: unknown): string | null {
    if (typeof data !== 'object' || data === null) {
      return null
    }

    const obj = data as Record<string, unknown>
    const id = obj[this.config.idField]

    return typeof id === 'string' || typeof id === 'number' ? String(id) : null
  }

  /**
   * 计算内容哈希
   * 
   * 使用简单的字符串哈希算法（DJB2）
   * 对于生产环境，建议使用更强的哈希算法如 SHA-256
   */
  private hashContent(data: unknown): string {
    try {
      const str = JSON.stringify(data)
      let hash = 5381

      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i) // hash * 33 + c
        hash = hash & hash // 转换为 32 位整数
      }

      return hash.toString(36)
    }
    catch {
      return 'unknown'
    }
  }

  /**
   * 移除最旧的记录
   */
  private removeOldest(): void {
    if (this.processedMessages.size === 0) {
      return
    }

    // 找到时间戳最小的记录
    let oldestKey: string | null = null
    let oldestTimestamp = Number.MAX_SAFE_INTEGER

    for (const [key, record] of this.processedMessages.entries()) {
      if (record.timestamp < oldestTimestamp) {
        oldestTimestamp = record.timestamp
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.processedMessages.delete(oldestKey)
    }
  }

  /**
   * 启动定期清理
   * 
   * 定期清理超出时间窗口的记录
   */
  private startCleanup(): void {
    // 每隔窗口大小的一半执行一次清理
    const cleanupInterval = this.config.windowSize / 2

    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, cleanupInterval)
  }

  /**
   * 清理过期记录
   * 
   * 移除超出时间窗口的记录
   */
  private cleanup(): void {
    const now = Date.now()
    const windowMs = this.config.windowSize

    for (const [key, record] of this.processedMessages.entries()) {
      if (now - record.timestamp > windowMs) {
        this.processedMessages.delete(key)
      }
    }
  }

  /**
   * 手动清理所有记录
   */
  clear(): void {
    this.processedMessages.clear()
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      /** 当前记录数 */
      recordCount: this.processedMessages.size,
      /** 去重率 */
      deduplicationRate: this.stats.totalChecked > 0
        ? this.stats.duplicateCount / this.stats.totalChecked
        : 0,
    }
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalChecked: 0,
      duplicateCount: 0,
      uniqueCount: 0,
    }
  }

  /**
   * 更新配置
   * 
   * @param config - 新的配置项
   */
  updateConfig(config: Partial<DeduplicatorConfig>): void {
    const oldEnabled = this.config.enabled
    this.config = { ...this.config, ...config }

    // 如果启用状态改变，启动或停止清理
    if (this.config.enabled && !oldEnabled) {
      this.startCleanup()
    }
    else if (!this.config.enabled && oldEnabled) {
      this.stopCleanup()
    }
  }

  /**
   * 停止清理定时器
   */
  private stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): Readonly<Required<DeduplicatorConfig>> {
    return { ...this.config }
  }

  /**
   * 销毁去重管理器
   */
  destroy(): void {
    this.stopCleanup()
    this.clear()
  }
}


