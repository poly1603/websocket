/**
 * 原生 WebSocket 适配器
 * 
 * 基于浏览器原生 WebSocket API 实现
 */

import type { AdapterConfig } from '../types'
import { BaseAdapter } from './base-adapter'

/**
 * 原生 WebSocket 适配器类
 */
export class NativeAdapter extends BaseAdapter {
  private ws: WebSocket | null = null
  private config: AdapterConfig
  private connectionTimeout: ReturnType<typeof setTimeout> | null = null

  constructor(config: AdapterConfig) {
    super()
    this.config = config
  }

  /**
   * 建立连接
   */
  async connect(): Promise<void> {
    if (this.isConnected || this._state === 'connecting') {
      return
    }

    return new Promise((resolve, reject) => {
      try {
        this.setState('connecting')

        // 创建 WebSocket 连接
        this.ws = new WebSocket(this.config.url, this.config.protocols)

        // 设置连接超时
        if (this.config.connectionTimeout) {
          this.connectionTimeout = setTimeout(() => {
            if (this._state === 'connecting') {
              this.ws?.close()
              const error = new Error('Connection timeout')
              this.emit('error', error)
              reject(error)
            }
          }, this.config.connectionTimeout)
        }

        // 连接打开
        this.ws.onopen = (event) => {
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout)
            this.connectionTimeout = null
          }

          this.setState('connected')
          this.emit('open', event)
          resolve()
        }

        // 连接关闭
        this.ws.onclose = (event) => {
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout)
            this.connectionTimeout = null
          }

          const wasConnected = this._state === 'connected'
          this.setState('disconnected')

          this.emit('close', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          })

          // 如果是在连接过程中关闭，视为连接失败
          if (!wasConnected) {
            reject(new Error(`Connection failed: ${event.reason || event.code}`))
          }
        }

        // 连接错误
        this.ws.onerror = (event) => {
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout)
            this.connectionTimeout = null
          }

          this.emit('error', event)

          // 如果是在连接过程中出错，reject promise
          if (this._state === 'connecting') {
            reject(new Error('WebSocket connection error'))
          }
        }

        // 接收消息
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
   * 断开连接
   */
  disconnect(code: number = 1000, reason: string = 'Normal closure'): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
      this.connectionTimeout = null
    }

    if (!this.ws || this._state === 'disconnected') {
      return
    }

    try {
      this.setState('disconnecting')
      this.ws.close(code, reason)
    }
    catch (error) {
      console.error('Error closing WebSocket:', error)
      this.setState('disconnected')
    }
  }

  /**
   * 发送消息
   */
  send(data: any): void {
    if (!this.isConnected || !this.ws) {
      throw new Error('WebSocket is not connected')
    }

    try {
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
   */
  sendBinary(data: ArrayBuffer | Blob): void {
    if (!this.isConnected || !this.ws) {
      throw new Error('WebSocket is not connected')
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
   * 处理接收到的消息
   */
  private handleMessage(data: any): void {
    try {
      // 尝试解析 JSON
      let parsedData = data
      if (typeof data === 'string') {
        try {
          parsedData = JSON.parse(data)
        }
        catch {
          // 不是 JSON，保持原样
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
   */
  getRawWebSocket(): WebSocket | null {
    return this.ws
  }

  /**
   * 获取连接的 ReadyState
   */
  getReadyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED
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
    this.ws = null
  }
}


