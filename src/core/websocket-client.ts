/**
 * WebSocket 客户端主类
 * 
 * 整合所有功能模块，提供完整的 WebSocket 客户端功能
 * 这是整个 WebSocket 库的核心入口，协调各个管理器协同工作
 * 
 * 主要职责：
 * - 管理 WebSocket 连接生命周期
 * - 协调各个功能模块（重连、心跳、队列等）
 * - 提供统一的对外 API
 * - 处理事件分发和状态同步
 * 
 * 架构设计：
 * - 使用组合模式，将功能分散到各个管理器
 * - 通过适配器模式支持不同的 WebSocket 实现
 * - 使用事件驱动模型进行组件间通信
 */

import type {
  ConnectionMetrics,
  ConnectionState,
  IWebSocketAdapter,
  SendOptions,
  WebSocketClientConfig,
  WebSocketEventType,
} from '../types'
import { AdapterFactory } from '../adapters'
import { ConnectionManager } from './connection-manager'
import { EventEmitter } from './event-emitter'
import { HeartbeatManager } from './heartbeat-manager'
import { MessageQueue } from './message-queue'
import { ReconnectManager } from './reconnect-manager'

/**
 * 默认客户端配置
 * 
 * 提供合理的默认值，确保开箱即用
 */
const DEFAULT_CONFIG: Partial<WebSocketClientConfig> = {
  adapter: 'native',           // 使用原生 WebSocket 适配器
  connectionTimeout: 10000,     // 10 秒连接超时
  debug: false,                 // 默认不开启调试模式

  // 重连配置：启用自动重连，最多重连 10 次
  reconnect: {
    enabled: true,
    delay: 1000,        // 首次重连延迟 1 秒
    maxDelay: 30000,    // 最大延迟 30 秒
    maxAttempts: 10,    // 最多尝试 10 次
    factor: 2,          // 指数退避因子
    jitter: 0.1,        // 10% 随机抖动
  },

  // 心跳配置：启用心跳检测，30 秒一次
  heartbeat: {
    enabled: true,
    interval: 30000,    // 30 秒发送一次 ping
    timeout: 5000,      // 5 秒无响应则超时
    message: { type: 'ping' },
    pongType: 'pong',
  },

  // 队列配置：启用消息队列，支持持久化
  queue: {
    enabled: true,
    maxSize: 1000,      // 最多缓存 1000 条消息
    persistent: true,   // 持久化到 localStorage
  },
}

/**
 * WebSocket 客户端类
 * 
 * 这是整个库的核心类，整合了所有功能模块：
 * - 连接管理：管理连接状态和生命周期
 * - 重连管理：自动重连，指数退避算法
 * - 心跳管理：保持连接活性，检测断线
 * - 消息队列：离线消息缓存和持久化
 * - 事件系统：基于观察者模式的事件通知
 * 
 * @example
 * ```typescript
 * const client = new WebSocketClient({
 *   url: 'ws://localhost:8080',
 *   reconnect: { enabled: true },
 *   heartbeat: { enabled: true },
 * })
 * 
 * await client.connect()
 * client.send({ type: 'message', text: 'Hello' })
 * ```
 */
export class WebSocketClient {
  /** 客户端配置（合并后的完整配置） */
  private config: Required<WebSocketClientConfig>

  /** WebSocket 适配器实例 */
  private adapter: IWebSocketAdapter | null = null

  /** 事件发射器，用于事件通知 */
  private eventEmitter: EventEmitter

  /** 连接管理器，管理连接状态和指标 */
  private connectionManager: ConnectionManager

  /** 重连管理器，处理自动重连逻辑 */
  private reconnectManager: ReconnectManager

  /** 心跳管理器，维持连接活性 */
  private heartbeatManager: HeartbeatManager

  /** 消息队列，缓存离线消息 */
  private messageQueue: MessageQueue

  /** 客户端是否已被销毁 */
  private isDestroyed = false

  /**
   * 创建 WebSocket 客户端实例
   * 
   * 初始化所有功能模块并合并配置
   * 
   * @param config - 客户端配置选项
   * 
   * @example
   * ```typescript
   * const client = new WebSocketClient({
   *   url: 'ws://localhost:8080',
   *   reconnect: { enabled: true, maxAttempts: 5 },
   *   heartbeat: { enabled: true, interval: 30000 },
   *   queue: { enabled: true, persistent: true },
   *   debug: true,
   * })
   * ```
   */
  constructor(config: WebSocketClientConfig) {
    // 合并用户配置和默认配置
    // 深度合并嵌套的配置对象（reconnect、heartbeat、queue）
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      reconnect: { ...DEFAULT_CONFIG.reconnect, ...config.reconnect },
      heartbeat: { ...DEFAULT_CONFIG.heartbeat, ...config.heartbeat },
      queue: { ...DEFAULT_CONFIG.queue, ...config.queue },
    } as Required<WebSocketClientConfig>

    // 初始化各个功能模块
    this.eventEmitter = new EventEmitter()
    this.connectionManager = new ConnectionManager(this.eventEmitter)
    this.reconnectManager = new ReconnectManager(this.config.reconnect)
    this.heartbeatManager = new HeartbeatManager(this.config.heartbeat)
    this.messageQueue = new MessageQueue(this.config.queue)

    this.log('WebSocket 客户端已初始化', this.config)
  }

  /**
   * 连接到 WebSocket 服务器
   * 
   * 执行完整的连接流程：
   * 1. 检查客户端状态（是否已销毁、是否已连接）
   * 2. 创建适配器并设置事件监听
   * 3. 建立 WebSocket 连接
   * 4. 启动心跳检测
   * 5. 发送队列中的消息
   * 6. 如果失败且启用重连，则自动重连
   * 
   * @throws 如果客户端已被销毁
   * @throws 如果连接失败且未启用重连
   * 
   * @example
   * ```typescript
   * try {
   *   await client.connect()
   *   console.log('连接成功')
   * } catch (error) {
   *   console.error('连接失败:', error)
   * }
   * ```
   */
  async connect(): Promise<void> {
    // 检查客户端是否已被销毁
    if (this.isDestroyed) {
      throw new Error('客户端已被销毁，无法连接')
    }

    // 如果已连接或正在连接，直接返回
    if (this.connectionManager.isConnected() || this.connectionManager.isConnecting()) {
      this.log('已经连接或正在连接中')
      return
    }

    // 设置状态为连接中
    this.connectionManager.setState('connecting')

    try {
      // 创建 WebSocket 适配器（如果还未创建）
      if (!this.adapter) {
        this.adapter = await AdapterFactory.create(this.config.adapter, {
          url: this.config.url,
          protocols: this.config.protocols,
          connectionTimeout: this.config.connectionTimeout,
          headers: this.config.headers,
          debug: this.config.debug,
        })

        // 注册适配器的事件监听器
        this.setupAdapterListeners()
      }

      // 执行实际的连接操作
      await this.adapter.connect()

      // 连接成功后的处理
      this.connectionManager.setState('connected')
      this.eventEmitter.emit('open', { timestamp: Date.now() })

      // 启动心跳检测
      if (this.heartbeatManager.isEnabled) {
        this.startHeartbeat()
      }

      // 发送队列中缓存的消息
      await this.flushQueue()

      this.log('连接成功')
    }
    catch (error) {
      this.connectionManager.setState('disconnected')
      this.log('连接失败:', error)

      // 如果启用了自动重连，尝试重连
      if (this.reconnectManager.isEnabled) {
        await this.handleReconnect()
      }
      else {
        // 未启用重连，抛出错误
        throw error
      }
    }
  }

  /**
   * 断开与服务器的连接
   * 
   * 执行完整的断开流程：
   * 1. 停止心跳检测
   * 2. 取消自动重连
   * 3. 关闭 WebSocket 连接
   * 4. 更新连接状态
   * 
   * @param code - WebSocket 关闭代码（可选），默认 1000（正常关闭）
   * @param reason - 关闭原因描述（可选）
   * 
   * @example
   * ```typescript
   * // 正常关闭
   * client.disconnect()
   * 
   * // 自定义关闭代码和原因
   * client.disconnect(4000, '用户主动断开')
   * ```
   */
  disconnect(code?: number, reason?: string): void {
    if (this.isDestroyed) {
      return
    }

    this.log('正在断开连接...', { code, reason })

    // 停止心跳检测
    this.heartbeatManager.stop()

    // 取消自动重连（如果正在重连）
    this.reconnectManager.cancel()

    // 关闭 WebSocket 连接
    if (this.adapter) {
      this.adapter.disconnect(code, reason)
    }

    // 更新连接状态
    this.connectionManager.setState('disconnected')
  }

  /**
   * 发送消息到服务器
   * 
   * 根据连接状态选择立即发送或加入队列：
   * - 已连接：立即发送
   * - 未连接且启用队列：加入队列，连接后自动发送
   * - 未连接且未启用队列：抛出错误
   * 
   * @param data - 要发送的消息数据，可以是任意可序列化的对象
   * @param options - 发送选项，包括优先级、是否需要确认等
   * @throws 如果客户端已被销毁
   * @throws 如果未连接且队列被禁用
   * 
   * @example
   * ```typescript
   * // 发送普通消息
   * client.send({ type: 'chat', message: 'Hello' })
   * 
   * // 发送高优先级消息
   * client.send(urgentData, { priority: 'high' })
   * 
   * // 发送需要确认的消息
   * client.send(importantData, { requireAck: true, timeout: 5000 })
   * ```
   */
  send<T = unknown>(data: T, options?: SendOptions): void {
    if (this.isDestroyed) {
      throw new Error('客户端已被销毁，无法发送消息')
    }

    // 如果未连接，根据队列配置决定处理方式
    if (!this.connectionManager.isConnected()) {
      if (this.messageQueue.getConfig().enabled) {
        // 加入队列，连接恢复后自动发送
        this.messageQueue.enqueue(data, options?.priority)
        this.log('消息已加入队列（未连接）', data)
        return
      }
      throw new Error('WebSocket 未连接且消息队列已禁用')
    }

    try {
      // 通过适配器发送消息
      this.adapter!.send(data)

      // 更新统计信息
      this.connectionManager.incrementMessagesSent()
      this.connectionManager.updateQueuedMessages(this.messageQueue.size)

      this.log('消息已发送', data)
    }
    catch (error) {
      this.log('发送消息失败:', error)

      // 发送失败，如果启用队列则加入队列
      if (this.messageQueue.getConfig().enabled) {
        this.messageQueue.enqueue(data, options?.priority)
        this.log('消息发送失败，已加入队列')
      }

      throw error
    }
  }

  /**
   * 发送二进制数据到服务器
   * 
   * 发送 ArrayBuffer 或 Blob 格式的二进制数据
   * 注意：二进制数据不会被加入队列，必须在连接状态下发送
   * 
   * @param data - 二进制数据（ArrayBuffer 或 Blob）
   * @throws 如果客户端已被销毁或未连接
   * 
   * @example
   * ```typescript
   * // 发送 ArrayBuffer
   * const buffer = new Uint8Array([1, 2, 3, 4]).buffer
   * client.sendBinary(buffer)
   * 
   * // 发送 Blob
   * const blob = new Blob(['binary data'], { type: 'application/octet-stream' })
   * client.sendBinary(blob)
   * ```
   */
  sendBinary(data: ArrayBuffer | Blob): void {
    if (this.isDestroyed) {
      throw new Error('客户端已被销毁，无法发送数据')
    }

    if (!this.connectionManager.isConnected()) {
      throw new Error('WebSocket 未连接，无法发送二进制数据')
    }

    this.adapter!.sendBinary(data)
    this.connectionManager.incrementMessagesSent()
  }

  /**
   * 注册事件监听器
   * 
   * @param event - 事件名称（如 'open', 'close', 'message', 'error' 等）
   * @param handler - 事件处理函数
   * 
   * @example
   * ```typescript
   * client.on('open', () => console.log('连接已建立'))
   * client.on('message', (data) => console.log('收到消息:', data))
   * client.on('error', (error) => console.error('错误:', error))
   * ```
   */
  on<T = unknown>(event: WebSocketEventType | string, handler: (data?: T) => void): void {
    this.eventEmitter.on(event, handler)
  }

  /**
   * 注册一次性事件监听器
   * 
   * 监听器在首次触发后自动移除
   * 
   * @param event - 事件名称
   * @param handler - 事件处理函数
   * 
   * @example
   * ```typescript
   * client.once('open', () => {
   *   console.log('首次连接建立（只会打印一次）')
   * })
   * ```
   */
  once<T = unknown>(event: WebSocketEventType | string, handler: (data?: T) => void): void {
    this.eventEmitter.once(event, handler)
  }

  /**
   * 移除事件监听器
   * 
   * @param event - 事件名称
   * @param handler - 要移除的事件处理函数（可选，不传则移除所有）
   * 
   * @example
   * ```typescript
   * // 移除特定监听器
   * client.off('message', myHandler)
   * 
   * // 移除所有 message 监听器
   * client.off('message')
   * ```
   */
  off(event: WebSocketEventType | string, handler?: Function): void {
    this.eventEmitter.off(event, handler)
  }

  /**
   * 获取当前连接状态
   * 
   * @returns 连接状态：'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'reconnecting'
   */
  get state(): ConnectionState {
    return this.connectionManager.getState()
  }

  /**
   * 检查是否已连接
   * 
   * @returns 如果已连接返回 true，否则返回 false
   */
  get isConnected(): boolean {
    return this.connectionManager.isConnected()
  }

  /**
   * 获取连接指标
   * 
   * 包括消息数、重连次数、延迟等统计信息
   * 
   * @returns 连接指标对象
   * 
   * @example
   * ```typescript
   * const metrics = client.metrics
   * console.log('已发送:', metrics.messagesSent)
   * console.log('已接收:', metrics.messagesReceived)
   * console.log('平均延迟:', metrics.averageLatency, 'ms')
   * ```
   */
  get metrics(): ConnectionMetrics {
    return this.connectionManager.getMetrics()
  }

  /**
   * 获取消息队列大小
   * 
   * @returns 队列中待发送的消息数量
   */
  get queueSize(): number {
    return this.messageQueue.size
  }

  /**
   * 清空消息队列
   * 
   * 移除队列中所有待发送的消息
   * 
   * @example
   * ```typescript
   * console.log('队列大小:', client.queueSize)  // 10
   * client.clearQueue()
   * console.log('队列大小:', client.queueSize)  // 0
   * ```
   */
  clearQueue(): void {
    this.messageQueue.clear()
    this.connectionManager.updateQueuedMessages(0)
  }

  /**
   * 销毁客户端并释放所有资源
   * 
   * 执行完整的清理流程：
   * 1. 断开连接
   * 2. 停止心跳检测
   * 3. 取消重连
   * 4. 清空消息队列
   * 5. 移除所有事件监听器
   * 6. 销毁适配器
   * 
   * 注意：销毁后的客户端不能再使用
   * 
   * @example
   * ```typescript
   * // 不再需要客户端时，销毁它
   * client.destroy()
   * ```
   */
  destroy(): void {
    if (this.isDestroyed) {
      return
    }

    this.log('正在销毁客户端')

    // 断开连接
    this.disconnect()

    // 重置所有管理器
    this.heartbeatManager.reset()
    this.reconnectManager.reset()
    this.messageQueue.clear()
    this.eventEmitter.removeAllListeners()

    // 销毁适配器
    if (this.adapter) {
      this.adapter.destroy()
      this.adapter = null
    }

    // 标记为已销毁
    this.isDestroyed = true
  }

  /**
   * 设置适配器事件监听器（私有方法）
   * 
   * 为适配器注册所有必要的事件监听器，将适配器事件转换为客户端事件
   * 
   * 事件处理：
   * - open: 连接打开，更新状态并触发 'open' 事件
   * - close: 连接关闭，停止心跳并决定是否重连
   * - error: 发生错误，转发 'error' 事件
   * - message: 收到消息，区分普通消息和 pong 响应
   */
  private setupAdapterListeners(): void {
    if (!this.adapter) return

    // 监听连接打开事件
    this.adapter.on('open', (event) => {
      this.connectionManager.setState('connected')
      this.eventEmitter.emit('open', event)
    })

    // 监听连接关闭事件
    this.adapter.on('close', (event) => {
      // 停止心跳检测
      this.heartbeatManager.stop()

      // 记录之前是否已连接
      const wasConnected = this.connectionManager.isConnected()

      // 更新状态为已断开
      this.connectionManager.setState('disconnected')

      // 触发关闭事件
      this.eventEmitter.emit('close', event)

      // 如果是非正常关闭（wasClean = false）且启用了重连，则尝试重连
      // wasConnected 确保只在已连接状态下才重连（避免连接失败时重连）
      if (wasConnected && !event.wasClean && this.reconnectManager.isEnabled) {
        this.handleReconnect()
      }
    })

    // 监听错误事件
    this.adapter.on('error', (error) => {
      this.eventEmitter.emit('error', { error, timestamp: Date.now() })
    })

    // 监听消息接收事件
    this.adapter.on('message', (data) => {
      // 增加接收消息计数
      this.connectionManager.incrementMessagesReceived()

      // 检查是否是心跳 pong 响应
      if (this.isPongMessage(data)) {
        // 处理心跳响应，计算延迟
        this.heartbeatManager.handlePong((latency) => {
          // 更新平均延迟统计
          this.connectionManager.updateAverageLatency(latency)
          // 触发 pong 事件
          this.eventEmitter.emit('pong', { timestamp: Date.now() })
        })
      }
      else {
        // 普通消息，触发 message 事件
        this.eventEmitter.emit('message', {
          data,
          timestamp: Date.now(),
        })
      }
    })
  }

  /**
   * 检查消息是否是心跳 pong 响应（私有方法）
   * 
   * 根据配置的 pongType 判断消息是否是 pong 响应
   * 
   * @param data - 接收到的消息数据
   * @returns 如果是 pong 响应返回 true，否则返回 false
   */
  private isPongMessage(data: unknown): boolean {
    if (typeof data === 'object' && data !== null) {
      const pongType = this.heartbeatManager.getConfig().pongType
      const obj = data as Record<string, unknown>
      return obj.type === pongType
    }
    return false
  }

  /**
   * 启动心跳检测（私有方法）
   * 
   * 设置定期发送 ping 消息和超时处理
   * 
   * 心跳流程：
   * 1. 定期发送 ping 消息
   * 2. 等待服务器返回 pong
   * 3. 如果超时未收到 pong，认为连接已断开
   * 4. 触发重连流程
   */
  private startHeartbeat(): void {
    this.heartbeatManager.start(
      () => {
        // 发送 ping 消息
        if (this.connectionManager.isConnected()) {
          try {
            const message = this.heartbeatManager.getConfig().message
            this.adapter!.send(message)
            this.connectionManager.setLastHeartbeat(Date.now())
            this.eventEmitter.emit('ping', { message, timestamp: Date.now() })
          }
          catch (error) {
            this.log('发送心跳失败:', error)
          }
        }
      },
      () => {
        // 心跳超时处理
        this.log('心跳超时，连接可能已断开')
        this.disconnect(4001, '心跳超时')

        // 尝试自动重连
        if (this.reconnectManager.isEnabled) {
          this.handleReconnect()
        }
      },
    )
  }

  /**
   * 处理重连流程（私有方法）
   * 
   * 执行自动重连逻辑，使用指数退避算法
   * 
   * 重连流程：
   * 1. 设置状态为重连中
   * 2. 增加重连计数
   * 3. 调用重连管理器执行重连
   * 4. 触发相应的事件（reconnecting、reconnected、reconnect-failed）
   */
  private async handleReconnect(): Promise<void> {
    // 检查客户端状态
    if (this.isDestroyed || !this.reconnectManager.isEnabled) {
      return
    }

    // 设置状态为重连中
    this.connectionManager.setState('reconnecting')
    this.connectionManager.incrementReconnectCount()

    // 执行重连
    const success = await this.reconnectManager.reconnect(
      // 重连函数：调用 connect 方法
      () => this.connect(),

      // 重连开始回调
      (attempt, delay) => {
        this.connectionManager.setCurrentReconnectAttempt(attempt)
        this.eventEmitter.emit('reconnecting', {
          attempt,
          maxAttempts: this.reconnectManager.maxAttempts,
          delay,
          timestamp: Date.now(),
        })
        this.log(`正在重连... 第 ${attempt} 次尝试，延迟 ${delay}ms`)
      },

      // 重连成功回调
      (attempts, duration) => {
        this.eventEmitter.emit('reconnected', {
          attempts,
          duration,
          timestamp: Date.now(),
        })
        this.log(`重连成功！尝试了 ${attempts} 次，耗时 ${duration}ms`)
      },

      // 重连失败回调（达到最大次数）
      (attempts, reason) => {
        this.connectionManager.setState('disconnected')
        this.eventEmitter.emit('reconnect-failed', {
          attempts,
          reason,
          timestamp: Date.now(),
        })
        this.log(`重连失败，已尝试 ${attempts} 次: ${reason}`)
      },
    )

    // 如果重连失败，确保状态为已断开
    if (!success) {
      this.connectionManager.setState('disconnected')
    }
  }

  /**
   * 刷新消息队列（私有方法）
   * 
   * 发送队列中所有待发送的消息
   * 通常在连接建立后调用
   */
  private async flushQueue(): Promise<void> {
    // 检查队列是否启用且有消息
    if (!this.messageQueue.getConfig().enabled || this.messageQueue.isEmpty) {
      return
    }

    this.log(`正在发送队列中的 ${this.messageQueue.size} 条消息`)

    // 刷新队列，逐条发送
    const sentCount = await this.messageQueue.flush((item) => {
      this.send(item.data, { priority: item.priority })
    })

    // 更新队列统计
    this.connectionManager.updateQueuedMessages(this.messageQueue.size)
    this.log(`已发送 ${sentCount} 条队列消息`)
  }

  /**
   * 调试日志（私有方法）
   * 
   * 如果启用了 debug 模式，输出调试信息
   * 
   * @param message - 日志消息
   * @param args - 附加参数
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.config.debug) {
      console.log(`[WebSocketClient] ${message}`, ...args)
    }
  }
}

/**
 * 创建 WebSocket 客户端实例（工厂函数）
 * 
 * 这是创建客户端的推荐方式，提供更简洁的 API
 * 
 * @param config - 客户端配置选项
 * @returns WebSocket 客户端实例
 * 
 * @example
 * ```typescript
 * import { createWebSocketClient } from '@ldesign/websocket'
 * 
 * const client = createWebSocketClient({
 *   url: 'ws://localhost:8080',
 *   reconnect: { enabled: true },
 *   heartbeat: { enabled: true },
 *   queue: { enabled: true },
 *   debug: true,
 * })
 * 
 * // 监听事件
 * client.on('open', () => console.log('连接成功'))
 * client.on('message', (data) => console.log('收到消息:', data))
 * 
 * // 连接到服务器
 * await client.connect()
 * 
 * // 发送消息
 * client.send({ type: 'greeting', message: 'Hello, Server!' })
 * ```
 */
export function createWebSocketClient(config: WebSocketClientConfig): WebSocketClient {
  return new WebSocketClient(config)
}


