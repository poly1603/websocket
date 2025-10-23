/**
 * WebSocket 适配器基类
 * 
 * 提供适配器的通用功能
 */

import type { ConnectionState, IWebSocketAdapter } from '../types'
import { EventEmitter } from '../core/event-emitter'

/**
 * 适配器基类
 */
export abstract class BaseAdapter implements IWebSocketAdapter {
  protected _state: ConnectionState = 'disconnected'
  protected eventEmitter: EventEmitter

  constructor() {
    this.eventEmitter = new EventEmitter()
  }

  /**
   * 获取当前连接状态
   */
  get state(): ConnectionState {
    return this._state
  }

  /**
   * 检查是否已连接
   */
  get isConnected(): boolean {
    return this._state === 'connected'
  }

  /**
   * 设置连接状态
   */
  protected setState(state: ConnectionState): void {
    this._state = state
  }

  /**
   * 连接（需要子类实现）
   */
  abstract connect(): Promise<void>

  /**
   * 断开连接（需要子类实现）
   */
  abstract disconnect(code?: number, reason?: string): void

  /**
   * 发送消息（需要子类实现）
   */
  abstract send(data: any): void

  /**
   * 发送二进制数据（需要子类实现）
   */
  abstract sendBinary(data: ArrayBuffer | Blob): void

  /**
   * 注册事件监听器
   */
  on(event: string, handler: Function): void {
    this.eventEmitter.on(event, handler)
  }

  /**
   * 移除事件监听器
   */
  off(event: string, handler?: Function): void {
    this.eventEmitter.off(event, handler)
  }

  /**
   * 触发事件
   */
  emit(event: string, ...args: any[]): void {
    this.eventEmitter.emit(event, ...args)
  }

  /**
   * 销毁适配器
   */
  destroy(): void {
    this.disconnect()
    this.eventEmitter.removeAllListeners()
  }
}


