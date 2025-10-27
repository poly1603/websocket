/**
 * 消息确认（ACK）管理器
 * 
 * 实现可靠的消息传输机制，确保消息被服务器成功接收
 * 
 * 工作原理：
 * 1. 发送消息时分配唯一 ID 并记录
 * 2. 等待服务器返回确认（ACK）消息
 * 3. 如果超时未收到确认，可选择重传
 * 4. 收到确认后触发回调并清理记录
 * 
 * 应用场景：
 * - 关键消息的可靠传输
 * - 需要确认送达的场景
 * - 消息顺序保证
 * - 防止消息丢失
 */

import type { SendOptions } from '../types'
import { generateId } from '../utils/id-generator'
import { TimeoutError } from './errors'

/**
 * ACK 配置选项
 */
export interface AckConfig {
  /** 是否启用 ACK 机制 */
  enabled?: boolean
  /** 默认超时时间（毫秒） */
  defaultTimeout?: number
  /** 默认重试次数 */
  defaultRetries?: number
  /** ACK 消息类型标识 */
  ackType?: string
}

/**
 * 待确认的消息项
 */
interface PendingMessage {
  /** 消息 ID */
  id: string
  /** 原始消息数据 */
  data: unknown
  /** 发送选项 */
  options: SendOptions
  /** 发送时间戳 */
  timestamp: number
  /** 已重试次数 */
  retries: number
  /** 超时定时器 */
  timer: ReturnType<typeof setTimeout> | null
  /** 成功回调 */
  onAck?: (ackData?: unknown) => void
  /** 失败回调 */
  onTimeout?: (error: TimeoutError) => void
}

/**
 * 默认 ACK 配置
 */
const DEFAULT_CONFIG: Required<AckConfig> = {
  enabled: true,
  defaultTimeout: 5000,  // 5 秒超时
  defaultRetries: 3,     // 最多重试 3 次
  ackType: 'ack',        // ACK 消息类型
}

/**
 * 消息确认管理器类
 * 
 * 管理需要确认的消息，跟踪确认状态，处理超时和重传
 */
export class AckManager {
  /** ACK 配置 */
  private config: Required<AckConfig>
  
  /** 待确认消息映射表，key 为消息 ID */
  private pendingMessages: Map<string, PendingMessage> = new Map()
  
  /** 消息发送函数，由外部提供 */
  private sendFn: ((data: unknown) => void) | null = null

  /**
   * 创建 ACK 管理器
   * 
   * @param config - ACK 配置选项
   */
  constructor(config?: AckConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 是否启用 ACK 机制
   */
  get isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * 获取待确认消息数量
   */
  get pendingCount(): number {
    return this.pendingMessages.size
  }

  /**
   * 设置消息发送函数
   * 
   * 用于重传消息时调用
   * 
   * @param sendFn - 消息发送函数
   */
  setSendFunction(sendFn: (data: unknown) => void): void {
    this.sendFn = sendFn
  }

  /**
   * 发送需要确认的消息
   * 
   * 为消息分配唯一 ID，记录到待确认列表，并设置超时定时器
   * 
   * @param data - 要发送的消息数据
   * @param options - 发送选项
   * @param onAck - 收到确认时的回调
   * @param onTimeout - 超时时的回调
   * @returns 消息 ID
   * 
   * @example
   * ```typescript
   * const messageId = ackManager.send(
   *   { type: 'order', orderId: '12345' },
   *   { timeout: 10000, retries: 5 },
   *   (ackData) => console.log('消息已确认:', ackData),
   *   (error) => console.error('消息发送失败:', error)
   * )
   * ```
   */
  send(
    data: unknown,
    options: SendOptions = {},
    onAck?: (ackData?: unknown) => void,
    onTimeout?: (error: TimeoutError) => void,
  ): string {
    if (!this.config.enabled) {
      throw new Error('ACK 机制未启用')
    }

    // 生成唯一消息 ID
    const messageId = generateId('ack')
    
    // 获取超时时间和重试次数
    const timeout = options.timeout ?? this.config.defaultTimeout
    const maxRetries = options.retries ?? this.config.defaultRetries

    // 构造待确认消息项
    const pending: PendingMessage = {
      id: messageId,
      data,
      options,
      timestamp: Date.now(),
      retries: 0,
      timer: null,
      onAck,
      onTimeout,
    }

    // 设置超时定时器
    pending.timer = setTimeout(() => {
      this.handleTimeout(messageId, maxRetries)
    }, timeout)

    // 记录到待确认列表
    this.pendingMessages.set(messageId, pending)

    return messageId
  }

  /**
   * 处理消息确认
   * 
   * 当收到服务器的 ACK 响应时调用
   * 
   * @param messageId - 消息 ID
   * @param ackData - 确认数据（可选）
   * @returns 是否成功处理确认
   * 
   * @example
   * ```typescript
   * // 在收到服务器 ACK 消息时
   * ackManager.handleAck('msg_12345_abc', { status: 'received' })
   * ```
   */
  handleAck(messageId: string, ackData?: unknown): boolean {
    const pending = this.pendingMessages.get(messageId)
    
    if (!pending) {
      // 可能是重复的 ACK 或未知的消息 ID
      return false
    }

    // 清除超时定时器
    if (pending.timer) {
      clearTimeout(pending.timer)
      pending.timer = null
    }

    // 从待确认列表中移除
    this.pendingMessages.delete(messageId)

    // 调用成功回调
    pending.onAck?.(ackData)

    return true
  }

  /**
   * 处理超时
   * 
   * 当消息在规定时间内未收到确认时调用
   * 
   * @param messageId - 消息 ID
   * @param maxRetries - 最大重试次数
   */
  private handleTimeout(messageId: string, maxRetries: number): void {
    const pending = this.pendingMessages.get(messageId)
    
    if (!pending) {
      return
    }

    pending.retries++

    // 检查是否还可以重试
    if (pending.retries <= maxRetries && this.sendFn) {
      // 重新发送消息
      try {
        this.sendFn(pending.data)
        
        // 重新设置超时定时器
        const timeout = pending.options.timeout ?? this.config.defaultTimeout
        pending.timer = setTimeout(() => {
          this.handleTimeout(messageId, maxRetries)
        }, timeout)
        
        console.log(`[AckManager] 消息 ${messageId} 重传（第 ${pending.retries} 次）`)
      }
      catch (error) {
        // 重传失败
        this.handleFinalTimeout(messageId, pending)
      }
    }
    else {
      // 达到最大重试次数或没有发送函数，认为发送失败
      this.handleFinalTimeout(messageId, pending)
    }
  }

  /**
   * 处理最终超时（不再重试）
   * 
   * @param messageId - 消息 ID
   * @param pending - 待确认消息项
   */
  private handleFinalTimeout(messageId: string, pending: PendingMessage): void {
    // 清除定时器
    if (pending.timer) {
      clearTimeout(pending.timer)
      pending.timer = null
    }

    // 从待确认列表中移除
    this.pendingMessages.delete(messageId)

    // 创建超时错误
    const error = new TimeoutError(
      `消息 ${messageId} 确认超时（已重试 ${pending.retries} 次）`,
      pending.options.timeout ?? this.config.defaultTimeout
    )

    // 调用失败回调
    pending.onTimeout?.(error)
  }

  /**
   * 取消等待确认
   * 
   * 取消指定消息的 ACK 等待，清除定时器
   * 
   * @param messageId - 消息 ID
   * @returns 是否成功取消
   * 
   * @example
   * ```typescript
   * const messageId = ackManager.send(data, options)
   * // 稍后决定不等待确认了
   * ackManager.cancel(messageId)
   * ```
   */
  cancel(messageId: string): boolean {
    const pending = this.pendingMessages.get(messageId)
    
    if (!pending) {
      return false
    }

    // 清除超时定时器
    if (pending.timer) {
      clearTimeout(pending.timer)
      pending.timer = null
    }

    // 从待确认列表中移除
    this.pendingMessages.delete(messageId)

    return true
  }

  /**
   * 取消所有待确认消息
   * 
   * 清除所有超时定时器并清空待确认列表
   * 通常在断开连接时调用
   */
  cancelAll(): void {
    for (const pending of this.pendingMessages.values()) {
      if (pending.timer) {
        clearTimeout(pending.timer)
        pending.timer = null
      }
    }
    
    this.pendingMessages.clear()
  }

  /**
   * 获取待确认消息列表
   * 
   * @returns 待确认消息 ID 数组
   */
  getPendingMessageIds(): string[] {
    return Array.from(this.pendingMessages.keys())
  }

  /**
   * 获取指定消息的详情
   * 
   * @param messageId - 消息 ID
   * @returns 消息详情或 undefined
   */
  getMessageDetails(messageId: string): {
    id: string
    timestamp: number
    retries: number
    age: number
  } | undefined {
    const pending = this.pendingMessages.get(messageId)
    
    if (!pending) {
      return undefined
    }

    return {
      id: pending.id,
      timestamp: pending.timestamp,
      retries: pending.retries,
      age: Date.now() - pending.timestamp,
    }
  }

  /**
   * 获取统计信息
   * 
   * @returns ACK 统计数据
   */
  getStats() {
    const now = Date.now()
    const messages = Array.from(this.pendingMessages.values())

    return {
      /** 待确认消息总数 */
      pendingCount: this.pendingMessages.size,
      /** 总重试次数 */
      totalRetries: messages.reduce((sum, msg) => sum + msg.retries, 0),
      /** 最旧消息的年龄（毫秒） */
      oldestMessageAge: messages.length > 0 
        ? Math.max(...messages.map(msg => now - msg.timestamp))
        : 0,
      /** 平均重试次数 */
      averageRetries: messages.length > 0
        ? messages.reduce((sum, msg) => sum + msg.retries, 0) / messages.length
        : 0,
    }
  }

  /**
   * 更新配置
   * 
   * @param config - 新的配置项
   */
  updateConfig(config: Partial<AckConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取当前配置
   */
  getConfig(): Readonly<Required<AckConfig>> {
    return { ...this.config }
  }

  /**
   * 重置 ACK 管理器
   * 
   * 取消所有待确认消息并清空状态
   */
  reset(): void {
    this.cancelAll()
  }

  /**
   * 销毁 ACK 管理器
   * 
   * 释放所有资源
   */
  destroy(): void {
    this.cancelAll()
    this.sendFn = null
  }
}



