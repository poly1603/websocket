/**
 * WebSocket 客户端主类
 * 
 * 整合所有功能模块，提供完整的 WebSocket 客户端功能
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
 * 默认配置
 */
const DEFAULT_CONFIG: Partial<WebSocketClientConfig> = {
  adapter: 'native',
  connectionTimeout: 10000,
  debug: false,
  reconnect: {
    enabled: true,
    delay: 1000,
    maxDelay: 30000,
    maxAttempts: 10,
    factor: 2,
    jitter: 0.1,
  },
  heartbeat: {
    enabled: true,
    interval: 30000,
    timeout: 5000,
    message: { type: 'ping' },
    pongType: 'pong',
  },
  queue: {
    enabled: true,
    maxSize: 1000,
    persistent: true,
  },
}

/**
 * WebSocket 客户端类
 */
export class WebSocketClient {
  private config: Required<WebSocketClientConfig>
  private adapter: IWebSocketAdapter | null = null
  private eventEmitter: EventEmitter
  private connectionManager: ConnectionManager
  private reconnectManager: ReconnectManager
  private heartbeatManager: HeartbeatManager
  private messageQueue: MessageQueue
  private isDestroyed = false

  constructor(config: WebSocketClientConfig) {
    // 合并配置
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      reconnect: { ...DEFAULT_CONFIG.reconnect, ...config.reconnect },
      heartbeat: { ...DEFAULT_CONFIG.heartbeat, ...config.heartbeat },
      queue: { ...DEFAULT_CONFIG.queue, ...config.queue },
    } as Required<WebSocketClientConfig>

    // 初始化模块
    this.eventEmitter = new EventEmitter()
    this.connectionManager = new ConnectionManager(this.eventEmitter)
    this.reconnectManager = new ReconnectManager(this.config.reconnect)
    this.heartbeatManager = new HeartbeatManager(this.config.heartbeat)
    this.messageQueue = new MessageQueue(this.config.queue)

    this.log('WebSocket client initialized', this.config)
  }

  /**
   * 连接到服务器
   */
  async connect(): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('Client has been destroyed')
    }

    if (this.connectionManager.isConnected() || this.connectionManager.isConnecting()) {
      this.log('Already connected or connecting')
      return
    }

    this.connectionManager.setState('connecting')

    try {
      // 创建适配器
      if (!this.adapter) {
        this.adapter = await AdapterFactory.create(this.config.adapter, {
          url: this.config.url,
          protocols: this.config.protocols,
          connectionTimeout: this.config.connectionTimeout,
          headers: this.config.headers,
          debug: this.config.debug,
        })

        // 注册适配器事件
        this.setupAdapterListeners()
      }

      // 执行连接
      await this.adapter.connect()

      // 连接成功后的处理
      this.connectionManager.setState('connected')
      this.eventEmitter.emit('open', { timestamp: Date.now() })

      // 启动心跳
      if (this.heartbeatManager.isEnabled) {
        this.startHeartbeat()
      }

      // 发送队列中的消息
      await this.flushQueue()

      this.log('Connected successfully')
    }
    catch (error) {
      this.connectionManager.setState('disconnected')
      this.log('Connection failed:', error)

      // 尝试重连
      if (this.reconnectManager.isEnabled) {
        await this.handleReconnect()
      }
      else {
        throw error
      }
    }
  }

  /**
   * 断开连接
   */
  disconnect(code?: number, reason?: string): void {
    if (this.isDestroyed) {
      return
    }

    this.log('Disconnecting...', { code, reason })

    // 停止心跳
    this.heartbeatManager.stop()

    // 取消重连
    this.reconnectManager.cancel()

    // 断开适配器
    if (this.adapter) {
      this.adapter.disconnect(code, reason)
    }

    this.connectionManager.setState('disconnected')
  }

  /**
   * 发送消息
   */
  send<T = any>(data: T, options?: SendOptions): void {
    if (this.isDestroyed) {
      throw new Error('Client has been destroyed')
    }

    // 如果未连接，加入队列
    if (!this.connectionManager.isConnected()) {
      if (this.messageQueue.getConfig().enabled) {
        this.messageQueue.enqueue(data, options?.priority)
        this.log('Message queued (not connected)', data)
        return
      }
      throw new Error('WebSocket is not connected')
    }

    try {
      this.adapter!.send(data)
      this.connectionManager.incrementMessagesSent()
      this.connectionManager.updateQueuedMessages(this.messageQueue.size)
      this.log('Message sent', data)
    }
    catch (error) {
      this.log('Failed to send message:', error)

      // 发送失败，加入队列
      if (this.messageQueue.getConfig().enabled) {
        this.messageQueue.enqueue(data, options?.priority)
      }

      throw error
    }
  }

  /**
   * 发送二进制数据
   */
  sendBinary(data: ArrayBuffer | Blob): void {
    if (this.isDestroyed) {
      throw new Error('Client has been destroyed')
    }

    if (!this.connectionManager.isConnected()) {
      throw new Error('WebSocket is not connected')
    }

    this.adapter!.sendBinary(data)
    this.connectionManager.incrementMessagesSent()
  }

  /**
   * 注册事件监听器
   */
  on<T = any>(event: WebSocketEventType | string, handler: (data?: T) => void): void {
    this.eventEmitter.on(event, handler)
  }

  /**
   * 注册一次性事件监听器
   */
  once<T = any>(event: WebSocketEventType | string, handler: (data?: T) => void): void {
    this.eventEmitter.once(event, handler)
  }

  /**
   * 移除事件监听器
   */
  off(event: WebSocketEventType | string, handler?: Function): void {
    this.eventEmitter.off(event, handler)
  }

  /**
   * 获取连接状态
   */
  get state(): ConnectionState {
    return this.connectionManager.getState()
  }

  /**
   * 检查是否已连接
   */
  get isConnected(): boolean {
    return this.connectionManager.isConnected()
  }

  /**
   * 获取连接指标
   */
  get metrics(): ConnectionMetrics {
    return this.connectionManager.getMetrics()
  }

  /**
   * 获取队列大小
   */
  get queueSize(): number {
    return this.messageQueue.size
  }

  /**
   * 清空消息队列
   */
  clearQueue(): void {
    this.messageQueue.clear()
    this.connectionManager.updateQueuedMessages(0)
  }

  /**
   * 销毁客户端
   */
  destroy(): void {
    if (this.isDestroyed) {
      return
    }

    this.log('Destroying client')

    this.disconnect()
    this.heartbeatManager.reset()
    this.reconnectManager.reset()
    this.messageQueue.clear()
    this.eventEmitter.removeAllListeners()

    if (this.adapter) {
      this.adapter.destroy()
      this.adapter = null
    }

    this.isDestroyed = true
  }

  /**
   * 设置适配器事件监听
   */
  private setupAdapterListeners(): void {
    if (!this.adapter) return

    // 打开
    this.adapter.on('open', (event) => {
      this.connectionManager.setState('connected')
      this.eventEmitter.emit('open', event)
    })

    // 关闭
    this.adapter.on('close', (event) => {
      this.heartbeatManager.stop()

      const wasConnected = this.connectionManager.isConnected()
      this.connectionManager.setState('disconnected')

      this.eventEmitter.emit('close', event)

      // 如果是非正常关闭且启用重连，则尝试重连
      if (wasConnected && !event.wasClean && this.reconnectManager.isEnabled) {
        this.handleReconnect()
      }
    })

    // 错误
    this.adapter.on('error', (error) => {
      this.eventEmitter.emit('error', { error, timestamp: Date.now() })
    })

    // 消息
    this.adapter.on('message', (data) => {
      this.connectionManager.incrementMessagesReceived()

      // 检查是否是 pong 响应
      if (this.isPongMessage(data)) {
        this.heartbeatManager.handlePong((latency) => {
          this.connectionManager.updateAverageLatency(latency)
          this.eventEmitter.emit('pong', { timestamp: Date.now() })
        })
      }
      else {
        this.eventEmitter.emit('message', {
          data,
          timestamp: Date.now(),
        })
      }
    })
  }

  /**
   * 检查是否是 pong 消息
   */
  private isPongMessage(data: any): boolean {
    if (typeof data === 'object' && data !== null) {
      const pongType = this.heartbeatManager.getConfig().pongType
      return data.type === pongType
    }
    return false
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.heartbeatManager.start(
      () => {
        // 发送 ping
        if (this.connectionManager.isConnected()) {
          try {
            const message = this.heartbeatManager.getConfig().message
            this.adapter!.send(message)
            this.connectionManager.setLastHeartbeat(Date.now())
            this.eventEmitter.emit('ping', { message, timestamp: Date.now() })
          }
          catch (error) {
            this.log('Failed to send heartbeat:', error)
          }
        }
      },
      () => {
        // 心跳超时
        this.log('Heartbeat timeout')
        this.disconnect(4001, 'Heartbeat timeout')

        // 尝试重连
        if (this.reconnectManager.isEnabled) {
          this.handleReconnect()
        }
      },
    )
  }

  /**
   * 处理重连
   */
  private async handleReconnect(): Promise<void> {
    if (this.isDestroyed || !this.reconnectManager.isEnabled) {
      return
    }

    this.connectionManager.setState('reconnecting')
    this.connectionManager.incrementReconnectCount()

    const success = await this.reconnectManager.reconnect(
      () => this.connect(),
      (attempt, delay) => {
        this.connectionManager.setCurrentReconnectAttempt(attempt)
        this.eventEmitter.emit('reconnecting', {
          attempt,
          maxAttempts: this.reconnectManager.maxAttempts,
          delay,
          timestamp: Date.now(),
        })
        this.log(`Reconnecting... attempt ${attempt}, delay ${delay}ms`)
      },
      (attempts, duration) => {
        this.eventEmitter.emit('reconnected', {
          attempts,
          duration,
          timestamp: Date.now(),
        })
        this.log(`Reconnected after ${attempts} attempts, ${duration}ms`)
      },
      (attempts, reason) => {
        this.connectionManager.setState('disconnected')
        this.eventEmitter.emit('reconnect-failed', {
          attempts,
          reason,
          timestamp: Date.now(),
        })
        this.log(`Reconnect failed after ${attempts} attempts: ${reason}`)
      },
    )

    if (!success) {
      this.connectionManager.setState('disconnected')
    }
  }

  /**
   * 刷新消息队列
   */
  private async flushQueue(): Promise<void> {
    if (!this.messageQueue.getConfig().enabled || this.messageQueue.isEmpty) {
      return
    }

    this.log(`Flushing ${this.messageQueue.size} queued messages`)

    const sentCount = await this.messageQueue.flush((item) => {
      this.send(item.data, { priority: item.priority })
    })

    this.connectionManager.updateQueuedMessages(this.messageQueue.size)
    this.log(`Flushed ${sentCount} messages`)
  }

  /**
   * 调试日志
   */
  private log(message: string, ...args: any[]): void {
    if (this.config.debug) {
      console.log(`[WebSocketClient] ${message}`, ...args)
    }
  }
}

/**
 * 创建 WebSocket 客户端
 * 
 * @param config - 客户端配置
 * @returns WebSocket 客户端实例
 */
export function createWebSocketClient(config: WebSocketClientConfig): WebSocketClient {
  return new WebSocketClient(config)
}


