/**
 * 原生 WebSocket 适配器
 * 
 * 基于浏览器原生 WebSocket API 实现的适配器
 * 这是最常用的适配器，兼容所有现代浏览器
 * 
 * 特性：
 * - 轻量级：直接使用浏览器原生 API，无额外依赖
 * - 高性能：原生实现，性能最优
 * - 兼容性好：支持所有现代浏览器和 Node.js（需要 ws 库）
 * - 连接超时：可配置连接超时时间
 * - 自动重连：与重连管理器配合使用
 * 
 * @see https://developer.mozilla.org/zh-CN/docs/Web/API/WebSocket
 */

import type { AdapterConfig } from '../types'
import { BaseAdapter } from './base-adapter'

/**
 * 原生 WebSocket 适配器类
 * 
 * 封装浏览器原生 WebSocket API，提供统一的接口
 */
export class NativeAdapter extends BaseAdapter {
  /** 原生 WebSocket 实例 */
  private ws: WebSocket | null = null
  
  /** 适配器配置 */
  private config: AdapterConfig
  
  /** 连接超时定时器 */
  private connectionTimeout: ReturnType<typeof setTimeout> | null = null

  /**
   * 创建原生 WebSocket 适配器
   * 
   * @param config - 适配器配置选项
   */
  constructor(config: AdapterConfig) {
    super()
    this.config = config
  }

  /**
   * 建立 WebSocket 连接
   * 
   * 创建原生 WebSocket 实例并设置事件监听器
   * 支持连接超时检测，超时后自动关闭连接
   * 
   * @returns Promise，连接成功时 resolve，失败时 reject
   * @throws 如果连接超时或发生错误
   * 
   * @example
   * ```typescript
   * try {
   *   await adapter.connect()
   *   console.log('连接成功')
   * } catch (error) {
   *   console.error('连接失败:', error)
   * }
   * ```
   */
  async connect(): Promise<void> {
    // 如果已连接或正在连接，直接返回
    if (this.isConnected || this._state === 'connecting') {
      return
    }

    return new Promise((resolve, reject) => {
      try {
        this.setState('connecting')

        // 创建原生 WebSocket 连接
        // protocols 参数用于指定子协议（可选）
        this.ws = new WebSocket(this.config.url, this.config.protocols)

        // 设置连接超时定时器
        if (this.config.connectionTimeout) {
          this.connectionTimeout = setTimeout(() => {
            // 如果超时时仍在连接中，则认为连接失败
            if (this._state === 'connecting') {
              this.ws?.close()
              const error = new Error(`连接超时（${this.config.connectionTimeout}ms）`)
              this.emit('error', error)
              reject(error)
            }
          }, this.config.connectionTimeout)
        }

        // 连接打开事件处理
        this.ws.onopen = (event) => {
          // 清除连接超时定时器
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout)
            this.connectionTimeout = null
          }

          this.setState('connected')
          this.emit('open', event)
          resolve()
        }

        // 连接关闭事件处理
        this.ws.onclose = (event) => {
          // 清除连接超时定时器
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout)
            this.connectionTimeout = null
          }

          const wasConnected = this._state === 'connected'
          this.setState('disconnected')

          // 触发关闭事件，携带关闭信息
          this.emit('close', {
            code: event.code,  // 关闭代码（1000 表示正常关闭）
            reason: event.reason,  // 关闭原因
            wasClean: event.wasClean,  // 是否干净关闭
          })

          // 如果是在连接过程中关闭（还未连接成功），视为连接失败
          if (!wasConnected) {
            reject(new Error(`连接失败: ${event.reason || `代码 ${event.code}`}`))
          }
        }

        // 连接错误事件处理
        this.ws.onerror = (event) => {
          // 清除连接超时定时器
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout)
            this.connectionTimeout = null
          }

          // 触发错误事件
          this.emit('error', event)

          // 如果是在连接过程中出错，reject promise
          if (this._state === 'connecting') {
            reject(new Error('WebSocket 连接错误'))
          }
        }

        // 消息接收事件处理
        this.ws.onmessage = (event) => {
          this.handleMessage(event.data)
        }
      }
      catch (error) {
        this.setState('disconnected')
        reject(error)
      }
    })
  }

  /**
   * 断开 WebSocket 连接
   * 
   * 关闭 WebSocket 连接并清理相关资源
   * 
   * @param code - WebSocket 关闭代码，默认 1000（正常关闭）
   * @param reason - 关闭原因描述，默认 'Normal closure'
   * 
   * @see https://developer.mozilla.org/zh-CN/docs/Web/API/CloseEvent#status_codes
   * 
   * @example
   * ```typescript
   * // 正常关闭
   * adapter.disconnect()
   * 
   * // 自定义关闭代码和原因
   * adapter.disconnect(4000, '服务器维护')
   * ```
   */
  disconnect(code: number = 1000, reason: string = 'Normal closure'): void {
    // 清除连接超时定时器
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
      this.connectionTimeout = null
    }

    // 如果没有 WebSocket 实例或已断开，直接返回
    if (!this.ws || this._state === 'disconnected') {
      return
    }

    try {
      this.setState('disconnecting')
      this.ws.close(code, reason)
    }
    catch (error) {
      console.error('[NativeAdapter] 关闭 WebSocket 时出错:', error)
      this.setState('disconnected')
    }
  }

  /**
   * 发送消息
   * 
   * 发送文本或对象消息（对象会自动序列化为 JSON）
   * 
   * @param data - 要发送的数据，可以是字符串或对象
   * @throws 如果未连接或发送失败
   * 
   * @example
   * ```typescript
   * // 发送字符串
   * adapter.send('Hello, Server!')
   * 
   * // 发送对象（自动序列化为 JSON）
   * adapter.send({ type: 'chat', message: 'Hello!' })
   * ```
   */
  send(data: unknown): void {
    if (!this.isConnected || !this.ws) {
      throw new Error('WebSocket 未连接')
    }

    try {
      // 字符串直接发送，对象序列化为 JSON
      const message = typeof data === 'string' ? data : JSON.stringify(data)
      this.ws.send(message)
    }
    catch (error) {
      this.emit('error', error)
      throw error
    }
  }

  /**
   * 发送二进制数据
   * 
   * 发送 ArrayBuffer 或 Blob 格式的二进制数据
   * 
   * @param data - 二进制数据（ArrayBuffer 或 Blob）
   * @throws 如果未连接或发送失败
   * 
   * @example
   * ```typescript
   * // 发送 ArrayBuffer
   * const buffer = new Uint8Array([1, 2, 3, 4]).buffer
   * adapter.sendBinary(buffer)
   * 
   * // 发送 Blob
   * const blob = new Blob(['binary data'], { type: 'application/octet-stream' })
   * adapter.sendBinary(blob)
   * ```
   */
  sendBinary(data: ArrayBuffer | Blob): void {
    if (!this.isConnected || !this.ws) {
      throw new Error('WebSocket 未连接')
    }

    try {
      this.ws.send(data)
    }
    catch (error) {
      this.emit('error', error)
      throw error
    }
  }

  /**
   * 处理接收到的消息（内部方法）
   * 
   * 尝试将接收到的数据解析为 JSON，如果不是 JSON 则保持原样
   * 解析后的数据通过 'message' 事件发送给监听器
   * 
   * @param data - 接收到的原始数据
   */
  private handleMessage(data: unknown): void {
    try {
      // 尝试解析 JSON
      let parsedData = data
      if (typeof data === 'string') {
        try {
          parsedData = JSON.parse(data)
        }
        catch {
          // 不是 JSON 格式，保持原样（可能是纯文本消息）
        }
      }

      this.emit('message', parsedData)
    }
    catch (error) {
      this.emit('error', error)
    }
  }

  /**
   * 获取原生 WebSocket 实例
   * 
   * 返回底层的原生 WebSocket 对象，用于高级操作
   * 
   * @returns 原生 WebSocket 实例，如果未创建则返回 null
   * 
   * @example
   * ```typescript
   * const ws = adapter.getRawWebSocket()
   * if (ws) {
   *   console.log('WebSocket 就绪状态:', ws.readyState)
   *   console.log('缓冲数据量:', ws.bufferedAmount)
   * }
   * ```
   */
  getRawWebSocket(): WebSocket | null {
    return this.ws
  }

  /**
   * 获取 WebSocket 的就绪状态
   * 
   * @returns WebSocket 就绪状态值：
   *   - 0 (CONNECTING): 正在连接
   *   - 1 (OPEN): 已连接
   *   - 2 (CLOSING): 正在关闭
   *   - 3 (CLOSED): 已关闭
   * 
   * @see https://developer.mozilla.org/zh-CN/docs/Web/API/WebSocket/readyState
   */
  getReadyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED
  }

  /**
   * 销毁适配器并释放所有资源
   * 
   * 清除所有定时器，断开连接，移除事件监听器
   * 销毁后的适配器不应再被使用
   */
  destroy(): void {
    // 清除连接超时定时器
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
      this.connectionTimeout = null
    }

    // 调用基类的 destroy 方法
    super.destroy()
    
    // 清除 WebSocket 引用
    this.ws = null
  }
}


