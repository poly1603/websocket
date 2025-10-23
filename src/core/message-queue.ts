/**
 * 消息队列管理器
 * 
 * 实现消息队列、优先级排序和持久化功能
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
 * 优先级权重
 */
const PRIORITY_WEIGHTS = {
  high: 3,
  normal: 2,
  low: 1,
}

/**
 * 消息队列管理器类
 */
export class MessageQueue {
  private config: Required<QueueConfig>
  private queue: QueueItem[] = []

  constructor(config?: QueueConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    if (this.config.persistent) {
      this.restore()
    }
  }

  /**
   * 入队
   * 
   * @param data - 消息数据
   * @param priority - 优先级
   * @param retries - 重试次数
   * @returns 消息 ID
   */
  enqueue(data: any, priority: 'high' | 'normal' | 'low' = 'normal', retries: number = 0): string {
    if (!this.config.enabled) {
      throw new Error('Message queue is disabled')
    }

    if (this.queue.length >= this.config.maxSize) {
      // 队列已满，移除最低优先级的最旧消息
      this.removeLowPriorityOldest()
    }

    const item: QueueItem = {
      id: generateId(),
      data,
      priority,
      timestamp: Date.now(),
      retries,
    }

    this.queue.push(item)
    this.sortByPriority()

    if (this.config.persistent) {
      this.persist()
    }

    return item.id
  }

  /**
   * 出队
   * 
   * @returns 队列项或 null
   */
  dequeue(): QueueItem | null {
    if (this.queue.length === 0) {
      return null
    }

    const item = this.queue.shift()!

    if (this.config.persistent) {
      this.persist()
    }

    return item
  }

  /**
   * 查看队首元素（不移除）
   * 
   * @returns 队列项或 null
   */
  peek(): QueueItem | null {
    return this.queue.length > 0 ? this.queue[0] : null
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
   * 根据优先级排序
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
   * 移除最低优先级的最旧消息
   */
  private removeLowPriorityOldest(): void {
    // 找到最低优先级
    let lowestPriority: 'high' | 'normal' | 'low' = 'low'
    for (const item of this.queue) {
      if (item.priority === 'low') {
        lowestPriority = 'low'
        break
      }
      else if (item.priority === 'normal' && lowestPriority !== 'low') {
        lowestPriority = 'normal'
      }
    }

    // 找到该优先级的最旧消息
    const indexToRemove = this.queue.findIndex(item => item.priority === lowestPriority)
    if (indexToRemove !== -1) {
      this.queue.splice(indexToRemove, 1)
    }
  }

  /**
   * 清空队列
   */
  clear(): void {
    this.queue = []
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
   * 持久化到 localStorage
   */
  private persist(): void {
    if (typeof localStorage === 'undefined') {
      return
    }

    try {
      localStorage.setItem(this.config.storageKey, JSON.stringify(this.queue))
    }
    catch (error) {
      console.error('Failed to persist message queue:', error)
    }
  }

  /**
   * 从 localStorage 恢复
   */
  private restore(): void {
    if (typeof localStorage === 'undefined') {
      return
    }

    try {
      const stored = localStorage.getItem(this.config.storageKey)
      if (stored) {
        this.queue = JSON.parse(stored)
        // 清理过期消息（超过 24 小时）
        const now = Date.now()
        const oneDayMs = 24 * 60 * 60 * 1000
        this.queue = this.queue.filter(item => now - item.timestamp < oneDayMs)
      }
    }
    catch (error) {
      console.error('Failed to restore message queue:', error)
      this.queue = []
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


