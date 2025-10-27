/**
 * Socket.IO WebSocket 适配器
 * 
 * 基于 Socket.IO 客户端实现的适配器
 * Socket.IO 提供了比原生 WebSocket 更丰富的功能
 * 
 * 特性：
 * - 自动重连：Socket.IO 内置重连机制
 * - 房间支持：支持加入/离开房间
 * - 命名空间：支持多个命名空间
 * - 广播：支持服务器广播
 * - 自动降级：在不支持 WebSocket 时可降级到长轮询
 * 
 * 依赖：
 * - 需要安装 socket.io-client: npm install socket.io-client
 * 
 * @see https://socket.io/docs/v4/
 */

import type {
  IWebSocketAdapter,
  AdapterConfig,
} from '../types/adapter'
import { BaseAdapter } from './base-adapter'
import { ConnectionError } from '../core/errors'

/**
 * Socket.IO 客户端实例类型（避免直接依赖）
 */
type SocketIOClient = any

/**
 * Socket.IO 适配器实现
 * 
 * 将 Socket.IO 的 API 封装为统一的适配器接口
 */
export class SocketIOAdapter extends BaseAdapter implements IWebSocketAdapter {
  /** Socket.IO 客户端实例 */
  private socket: SocketIOClient = null
  
  /** 适配器配置 */
  private config: AdapterConfig
  
  /** 连接超时定时器 */
  private connectionTimeout: ReturnType<typeof setTimeout> | null = null

  /**
   * 创建 Socket.IO 适配器
   * 
   * @param config - 适配器配置选项
   */
  constructor(config: AdapterConfig) {
    super()
    this.config = config
  }

  /**
   * 建立 Socket.IO 连接
   * 
   * 动态导入 socket.io-client 库并建立连接
   * 
   * @returns Promise，连接成功时 resolve，失败时 reject
   * @throws 如果未安装 socket.io-client 或连接失败
   * 
   * @example
   * ```typescript
   * try {
   *   await adapter.connect()
   *   console.log('Socket.IO 连接成功')
   * } catch (error) {
   *   console.error('连接失败:', error)
   * }
   * ```
   */
  async connect(): Promise<void> {
    if (this.isConnected || this._state === 'connecting') {
      return
    }

    return new Promise(async (resolve, reject) => {
      try {
        this.setState('connecting')

        // 动态导入 socket.io-client
        const { io } = await import('socket.io-client')

        // 创建 Socket.IO 连接
        const socketIOOptions = {
          ...this.config.socketIOOptions,
          // 强制使用 WebSocket 传输（可选）
          transports: this.config.socketIOOptions?.transports || ['websocket', 'polling'],
        }

        this.socket = io(this.config.url, socketIOOptions)

        // 设置连接超时
        if (this.config.connectionTimeout) {
          this.connectionTimeout = setTimeout(() => {
            if (this._state === 'connecting') {
              this.socket?.disconnect()
              const error = new ConnectionError(
                `Socket.IO 连接超时（${this.config.connectionTimeout}ms）`
              )
              this.emit('error', error)
              reject(error)
            }
          }, this.config.connectionTimeout)
        }

        // 连接成功事件
        this.socket.on('connect', () => {
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout)
            this.connectionTimeout = null
          }

          this.setState('connected')
          this.emit('open', { timestamp: Date.now() })
          resolve()
        })

        // 断开连接事件
        this.socket.on('disconnect', (reason: string) => {
          const wasConnected = this._state === 'connected'
          this.setState('disconnected')

          this.emit('close', {
            code: 1000,
            reason,
            wasClean: reason === 'io client disconnect',
          })

          // 如果是在连接过程中断开，视为连接失败
          if (!wasConnected) {
            reject(new ConnectionError(`Socket.IO 连接失败: ${reason}`))
          }
        })

        // 错误事件
        this.socket.on('connect_error', (error: Error) => {
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout)
            this.connectionTimeout = null
          }

          this.emit('error', error)

          if (this._state === 'connecting') {
            reject(new ConnectionError('Socket.IO 连接错误', { originalError: error }))
          }
        })

        // 接收消息事件
        this.socket.on('message', (data: unknown) => {
          this.emit('message', data)
        })
      }
      catch (error) {
        this.setState('disconnected')
        
        // 可能是因为未安装 socket.io-client
        if (error instanceof Error && error.message.includes('Cannot find module')) {
          reject(new ConnectionError(
            'Socket.IO 适配器需要 socket.io-client。请先安装: npm install socket.io-client',
            { originalError: error }
          ))
        } else {
          reject(error)
        }
      }
    })
  }

  /**
   * 断开 Socket.IO 连接
   * 
   * @param code - 关闭代码（Socket.IO 不使用此参数）
   * @param reason - 关闭原因（可选）
   */
  disconnect(code?: number, reason?: string): void {
    // 清除连接超时定时器
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
      this.connectionTimeout = null
    }

    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    
    this.setState('disconnected')
  }

  /**
   * 发送消息
   * 
   * 使用 Socket.IO 的 emit 发送消息
   * 
   * @param data - 要发送的数据
   * @throws 如果未连接
   */
  send(data: unknown): void {
    if (!this.socket || !this.socket.connected) {
      throw new Error('Socket.IO 未连接')
    }

    // Socket.IO 使用 emit 发送消息，这里使用 'message' 事件
    this.socket.emit('message', data)
  }

  /**
   * 发送二进制数据
   * 
   * Socket.IO 会自动处理二进制数据
   * 
   * @param data - 二进制数据
   * @throws 如果未连接
   */
  sendBinary(data: ArrayBuffer | Blob): void {
    if (!this.socket || !this.socket.connected) {
      throw new Error('Socket.IO 未连接')
    }

    // Socket.IO 自动支持二进制数据
    this.socket.emit('message', data)
  }

  /**
   * 加入房间（Socket.IO 特有功能）
   * 
   * @param room - 房间名称
   * 
   * @example
   * ```typescript
   * adapter.joinRoom('chat-room-1')
   * ```
   */
  joinRoom(room: string): void {
    if (this.socket) {
      this.socket.emit('join', room)
    }
  }

  /**
   * 离开房间（Socket.IO 特有功能）
   * 
   * @param room - 房间名称
   */
  leaveRoom(room: string): void {
    if (this.socket) {
      this.socket.emit('leave', room)
    }
  }

  /**
   * 获取原生 Socket.IO 实例
   * 
   * @returns Socket.IO 客户端实例
   */
  getRawSocket(): SocketIOClient {
    return this.socket
  }

  /**
   * 销毁适配器
   */
  destroy(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
      this.connectionTimeout = null
    }

    super.destroy()
  }
}

