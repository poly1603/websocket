/**
 * 消息队列管理器
 * 
 * 实现消息队列、优先级排序和持久化功能
 * 用于在 WebSocket 断开连接时缓存待发送的消息，连接恢复后自动发送
 * 
 * 特性：
 * - 优先级队列：支持高、中、低三种优先级
 * - 持久化：可选将队列保存到 localStorage
 * - 容量限制：防止内存占用过大
 * - 自动过期：清理超时的旧消息
 */

import type { QueueConfig, QueueItem } from '../types'
import { generateId } from '../utils/id-generator'

/**
 * 默认队列配置
 */
const DEFAULT_CONFIG: Required<QueueConfig> = {
  enabled: true,
  maxSize: 1000,
  persistent: true,
  storageKey: 'ldesign_websocket_queue',
}

/**
 * 优先级权重映射
 * 用于排序时比较优先级，数值越大优先级越高
 */
const PRIORITY_WEIGHTS = {
  high: 3,
  normal: 2,
  low: 1,
} as const

/**
 * 单个消息的最大字节数（1MB）
 * 超过此大小的消息会被拒绝，防止内存占用过大
 */
const MAX_MESSAGE_SIZE = 1 * 1024 * 1024

/**
 * 消息过期时间（24小时）
 * 超过此时间的消息会在恢复时被清理
 */
const MESSAGE_EXPIRY_MS = 24 * 60 * 60 * 1000

/**
 * 消息队列管理器类
 * 
 * 管理待发送消息的队列，支持优先级、持久化和内存管理
 */
export class MessageQueue {
  /** 队列配置 */
  private config: Required<QueueConfig>

  /** 消息队列数组，按优先级和时间排序 */
  private queue: QueueItem[] = []

  /** 队列是否已排序的标记，用于优化性能 */
  private isSorted: boolean = true

  /** 队列总字节数，用于内存管理 */
  private totalBytes: number = 0

  /**
   * 创建消息队列管理器
   * 
   * @param config - 队列配置选项
   */
  constructor(config?: QueueConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    if (this.config.persistent) {
      this.restore()
    }
  }

  /**
   * 将消息加入队列
   * 
   * 将消息添加到队列末尾，并标记队列为未排序状态（延迟排序优化）
   * 如果队列已满，会先移除最低优先级的最旧消息
   * 检查消息大小，拒绝过大的消息
   * 
   * @param data - 消息数据，可以是任意可序列化的对象
   * @param priority - 消息优先级：high（高）、normal（中）、low（低），默认为 normal
   * @param retries - 已重试次数，用于跟踪消息的发送尝试次数
   * @returns 返回生成的唯一消息 ID
   * @throws 如果队列被禁用或消息过大，会抛出错误
   * 
   * @example
   * ```typescript
   * const messageId = queue.enqueue({ type: 'text', content: 'Hello' }, 'high')
   * console.log('消息ID:', messageId)
   * ```
   */
  enqueue(data: unknown, priority: 'high' | 'normal' | 'low' = 'normal', retries: number = 0): string {
    if (!this.config.enabled) {
      throw new Error('消息队列已被禁用')
    }

    // 检查消息大小，防止单个消息过大
    const messageSize = this.estimateSize(data)
    if (messageSize > MAX_MESSAGE_SIZE) {
      throw new Error(`消息大小 (${messageSize} 字节) 超过限制 (${MAX_MESSAGE_SIZE} 字节)`)
    }

    // 队列已满时，移除最低优先级的最旧消息
    if (this.queue.length >= this.config.maxSize) {
      this.removeLowPriorityOldest()
    }

    const item: QueueItem = {
      id: generateId('msg'),
      data,
      priority,
      timestamp: Date.now(),
      retries,
    }

    this.queue.push(item)
    this.totalBytes += messageSize
    this.isSorted = false // 标记为未排序，延迟排序以提高性能

    // 持久化到存储
    if (this.config.persistent) {
      this.persist()
    }

    return item.id
  }

  /**
   * 从队列中取出消息
   * 
   * 取出队列中优先级最高、时间最早的消息
   * 在取出前会确保队列已排序
   * 
   * @returns 返回队首消息项，如果队列为空则返回 null
   * 
   * @example
   * ```typescript
   * const item = queue.dequeue()
   * if (item) {
   *   console.log('取出消息:', item.data)
   * }
   * ```
   */
  dequeue(): QueueItem | null {
    if (this.queue.length === 0) {
      return null
    }

    // 确保队列已排序
    this.ensureSorted()

    const item = this.queue.shift()!
    this.totalBytes -= this.estimateSize(item.data)

    // 更新持久化存储
    if (this.config.persistent) {
      this.persist()
    }

    return item
  }

  /**
   * 查看队首元素（不移除）
   * 
   * 返回队列中优先级最高的消息，但不将其从队列中移除
   * 
   * @returns 返回队首消息项，如果队列为空则返回 null
   * 
   * @example
   * ```typescript
   * const next = queue.peek()
   * if (next) {
   *   console.log('下一条消息:', next.data)
   * }
   * ```
   */
  peek(): QueueItem | null {
    if (this.queue.length === 0) {
      return null
    }

    // 确保队列已排序
    this.ensureSorted()

    return this.queue[0]
  }

  /**
   * 批量出队
   * 
   * @param count - 出队数量
   * @returns 队列项数组
   */
  dequeueBatch(count: number): QueueItem[] {
    const items: QueueItem[] = []
    const actualCount = Math.min(count, this.queue.length)

    for (let i = 0; i < actualCount; i++) {
      const item = this.dequeue()
      if (item) {
        items.push(item)
      }
    }

    return items
  }

  /**
   * 刷新队列（发送所有消息）
   * 
   * @param sendFn - 发送函数
   * @returns 成功发送的消息数
   */
  async flush(sendFn: (item: QueueItem) => Promise<void> | void): Promise<number> {
    let sentCount = 0

    while (this.queue.length > 0) {
      const item = this.dequeue()
      if (!item) break

      try {
        await sendFn(item)
        sentCount++
      }
      catch (error) {
        // 发送失败，重新入队
        this.enqueue(item.data, item.priority, (item.retries || 0) + 1)
        break
      }
    }

    return sentCount
  }

  /**
   * 确保队列已排序
   * 
   * 使用延迟排序策略：只在需要时才排序，避免每次入队都排序
   * 这样可以提高批量入队的性能
   */
  private ensureSorted(): void {
    if (!this.isSorted) {
      this.sortByPriority()
      this.isSorted = true
    }
  }

  /**
   * 根据优先级和时间戳对队列排序
   * 
   * 排序规则：
   * 1. 优先级高的排在前面（high > normal > low）
   * 2. 相同优先级的按时间戳排序（先进先出，FIFO）
   * 
   * 使用原地排序以节省内存
   */
  private sortByPriority(): void {
    this.queue.sort((a, b) => {
      const priorityDiff = PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority]
      if (priorityDiff !== 0) {
        return priorityDiff
      }
      // 相同优先级按时间排序（FIFO）
      return a.timestamp - b.timestamp
    })
  }

  /**
   * 估算消息的字节大小
   * 
   * 通过 JSON 序列化来粗略估算消息占用的内存大小
   * 这不是精确的内存占用，但足以进行容量控制
   * 
   * @param data - 要估算的数据
   * @returns 估算的字节数
   */
  private estimateSize(data: unknown): number {
    try {
      // 使用 JSON 字符串长度作为大小估算
      // 实际内存占用可能更大，但这个估算足够用于限制
      return JSON.stringify(data).length
    }
    catch {
      // 如果无法序列化，返回一个保守的估算值
      return 1024 // 默认 1KB
    }
  }

  /**
   * 移除最低优先级的最旧消息
   * 
   * 当队列满时调用此方法腾出空间
   * 优先移除 low 级别消息，其次 normal，最后才是 high
   * 同优先级中移除最旧的（时间戳最早的）
   */
  private removeLowPriorityOldest(): void {
    if (this.queue.length === 0) {
      return
    }

    // 确保队列已排序，这样最低优先级的消息在队尾
    this.ensureSorted()

    // 从队尾开始查找（队尾是最低优先级）
    const removedItem = this.queue.pop()
    if (removedItem) {
      this.totalBytes -= this.estimateSize(removedItem.data)
    }
  }

  /**
   * 清空队列
   * 
   * 移除队列中的所有消息并重置统计信息
   * 如果启用了持久化，也会清空存储
   * 
   * @example
   * ```typescript
   * queue.clear()
   * console.log('队列已清空，大小:', queue.size) // 0
   * ```
   */
  clear(): void {
    this.queue = []
    this.totalBytes = 0
    this.isSorted = true

    if (this.config.persistent) {
      this.persist()
    }
  }

  /**
   * 获取队列大小
   */
  get size(): number {
    return this.queue.length
  }

  /**
   * 检查队列是否为空
   */
  get isEmpty(): boolean {
    return this.queue.length === 0
  }

  /**
   * 检查队列是否已满
   */
  get isFull(): boolean {
    return this.queue.length >= this.config.maxSize
  }

  /**
   * 获取所有队列项（副本）
   */
  getAll(): QueueItem[] {
    return [...this.queue]
  }

  /**
   * 根据 ID 查找队列项
   * 
   * @param id - 消息 ID
   * @returns 队列项或 undefined
   */
  findById(id: string): QueueItem | undefined {
    return this.queue.find(item => item.id === id)
  }

  /**
   * 根据 ID 移除队列项
   * 
   * @param id - 消息 ID
   * @returns 是否成功移除
   */
  removeById(id: string): boolean {
    const index = this.queue.findIndex(item => item.id === id)
    if (index !== -1) {
      this.queue.splice(index, 1)
      if (this.config.persistent) {
        this.persist()
      }
      return true
    }
    return false
  }

  /**
   * 持久化队列到 localStorage
   * 
   * 将队列数据序列化并保存到浏览器本地存储
   * 这样在页面刷新或意外关闭后，队列中的消息不会丢失
   * 
   * 注意：localStorage 有大小限制（通常 5-10MB），大队列可能无法完全保存
   */
  private persist(): void {
    // 检查是否支持 localStorage
    if (typeof localStorage === 'undefined') {
      return
    }

    try {
      const data = JSON.stringify(this.queue)
      localStorage.setItem(this.config.storageKey, data)
    }
    catch (error) {
      // 可能的错误：QuotaExceededError（超出存储限制）、序列化错误等
      console.error('[MessageQueue] 持久化队列失败:', error)

      // 如果是存储空间不足，尝试清理队列
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('[MessageQueue] localStorage 空间不足，尝试减少队列大小')
        // 移除一半的低优先级消息
        const halfSize = Math.floor(this.queue.length / 2)
        for (let i = 0; i < halfSize; i++) {
          this.removeLowPriorityOldest()
        }
        // 再次尝试保存
        try {
          localStorage.setItem(this.config.storageKey, JSON.stringify(this.queue))
        }
        catch {
          // 如果还是失败，放弃持久化
          console.error('[MessageQueue] 无法持久化队列，已放弃')
        }
      }
    }
  }

  /**
   * 从 localStorage 恢复队列
   * 
   * 在创建队列实例时从本地存储恢复之前保存的消息
   * 会自动清理过期的消息（超过 24 小时）
   */
  private restore(): void {
    // 检查是否支持 localStorage
    if (typeof localStorage === 'undefined') {
      return
    }

    try {
      const stored = localStorage.getItem(this.config.storageKey)
      if (!stored) {
        return
      }

      const restoredQueue: QueueItem[] = JSON.parse(stored)

      // 清理过期消息
      const now = Date.now()
      this.queue = restoredQueue.filter(item => {
        const age = now - item.timestamp
        return age < MESSAGE_EXPIRY_MS
      })

      // 重新计算总字节数
      this.totalBytes = this.queue.reduce((sum, item) => {
        return sum + this.estimateSize(item.data)
      }, 0)

      // 标记为未排序，下次使用时会重新排序
      this.isSorted = false

      console.log(`[MessageQueue] 从存储恢复了 ${this.queue.length} 条消息`)
    }
    catch (error) {
      console.error('[MessageQueue] 恢复队列失败:', error)
      this.queue = []
      this.totalBytes = 0

      // 清除损坏的存储数据
      try {
        localStorage.removeItem(this.config.storageKey)
      }
      catch {
        // 忽略清除错误
      }
    }
  }

  /**
   * 获取队列统计信息
   */
  getStats() {
    const stats = {
      total: this.queue.length,
      high: 0,
      normal: 0,
      low: 0,
      oldestTimestamp: 0,
      newestTimestamp: 0,
    }

    if (this.queue.length > 0) {
      stats.oldestTimestamp = Math.min(...this.queue.map(item => item.timestamp))
      stats.newestTimestamp = Math.max(...this.queue.map(item => item.timestamp))
    }

    for (const item of this.queue) {
      stats[item.priority]++
    }

    return stats
  }

  /**
   * 更新配置
   * 
   * @param config - 新的配置
   */
  updateConfig(config: Partial<QueueConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取当前配置
   */
  getConfig(): Readonly<Required<QueueConfig>> {
    return { ...this.config }
  }
}


