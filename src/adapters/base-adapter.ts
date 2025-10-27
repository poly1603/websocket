/**
 * WebSocket 适配器基类
 * 
 * 提供所有 WebSocket 适配器的通用功能和接口定义
 * 不同的 WebSocket 实现（原生、Socket.IO 等）都继承此基类
 * 
 * 适配器模式的优势：
 * - 统一接口：所有适配器提供相同的 API
 * - 可替换性：轻松切换不同的 WebSocket 实现
 * - 可扩展性：方便添加新的 WebSocket 实现
 */

import type { ConnectionState, IWebSocketAdapter } from '../types'
import { EventEmitter } from '../core/event-emitter'

/**
 * WebSocket 适配器基类
 * 
 * 定义了所有适配器必须实现的核心功能：
 * - 连接管理（连接、断开）
 * - 消息发送（文本、二进制）
 * - 事件处理（监听、触发）
 * - 状态管理（连接状态）
 * 
 * @abstract 这是一个抽象类，不能直接实例化
 */
export abstract class BaseAdapter implements IWebSocketAdapter {
  /** 当前连接状态 */
  protected _state: ConnectionState = 'disconnected'
  
  /** 事件发射器，用于事件通知 */
  protected eventEmitter: EventEmitter

  /**
   * 创建适配器实例
   * 
   * 初始化事件发射器，用于事件的发布和订阅
   */
  constructor() {
    this.eventEmitter = new EventEmitter()
  }

  /**
   * 获取当前连接状态
   * 
   * @returns 当前的连接状态
   */
  get state(): ConnectionState {
    return this._state
  }

  /**
   * 检查是否已连接
   * 
   * @returns 如果已连接返回 true，否则返回 false
   */
  get isConnected(): boolean {
    return this._state === 'connected'
  }

  /**
   * 设置连接状态（内部方法）
   * 
   * 由子类调用以更新连接状态
   * 
   * @param state - 新的连接状态
   */
  protected setState(state: ConnectionState): void {
    this._state = state
  }

  /**
   * 连接到 WebSocket 服务器（抽象方法，需要子类实现）
   * 
   * 子类必须实现此方法以建立实际的 WebSocket 连接
   * 
   * @returns Promise，连接成功时 resolve，失败时 reject
   * 
   * @abstract
   */
  abstract connect(): Promise<void>

  /**
   * 断开 WebSocket 连接（抽象方法，需要子类实现）
   * 
   * 子类必须实现此方法以关闭 WebSocket 连接
   * 
   * @param code - WebSocket 关闭代码（可选）
   * @param reason - 关闭原因描述（可选）
   * 
   * @abstract
   */
  abstract disconnect(code?: number, reason?: string): void

  /**
   * 发送消息（抽象方法，需要子类实现）
   * 
   * 子类必须实现此方法以发送文本或 JSON 数据
   * 
   * @param data - 要发送的数据，通常会被序列化为 JSON
   * 
   * @abstract
   */
  abstract send(data: unknown): void

  /**
   * 发送二进制数据（抽象方法，需要子类实现）
   * 
   * 子类必须实现此方法以发送二进制数据
   * 
   * @param data - 要发送的二进制数据（ArrayBuffer 或 Blob）
   * 
   * @abstract
   */
  abstract sendBinary(data: ArrayBuffer | Blob): void

  /**
   * 注册事件监听器
   * 
   * 委托给内部的 EventEmitter 处理
   * 
   * @param event - 事件名称
   * @param handler - 事件处理函数
   * 
   * @example
   * ```typescript
   * adapter.on('open', () => console.log('连接已打开'))
   * adapter.on('message', (data) => console.log('收到消息:', data))
   * ```
   */
  on(event: string, handler: Function): void {
    this.eventEmitter.on(event, handler)
  }

  /**
   * 移除事件监听器
   * 
   * 委托给内部的 EventEmitter 处理
   * 
   * @param event - 事件名称
   * @param handler - 要移除的事件处理函数（可选，不传则移除所有）
   * 
   * @example
   * ```typescript
   * adapter.off('message', myHandler)  // 移除特定监听器
   * adapter.off('message')  // 移除所有 message 监听器
   * ```
   */
  off(event: string, handler?: Function): void {
    this.eventEmitter.off(event, handler)
  }

  /**
   * 触发事件
   * 
   * 委托给内部的 EventEmitter 处理
   * 通常由子类调用以通知事件发生
   * 
   * @param event - 事件名称
   * @param args - 传递给监听器的参数
   * 
   * @example
   * ```typescript
   * // 在子类中触发事件
   * this.emit('open', { timestamp: Date.now() })
   * this.emit('message', receivedData)
   * ```
   */
  emit(event: string, ...args: unknown[]): void {
    this.eventEmitter.emit(event, ...args)
  }

  /**
   * 销毁适配器并释放资源
   * 
   * 断开连接并移除所有事件监听器
   * 通常在不再需要此适配器时调用
   * 
   * 注意：销毁后的适配器不应再被使用
   */
  destroy(): void {
    this.disconnect()
    this.eventEmitter.removeAllListeners()
  }
}


