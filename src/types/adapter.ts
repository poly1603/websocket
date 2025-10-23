/**
 * WebSocket 适配器类型定义
 */

import type { ConnectionState } from './client'

/**
 * WebSocket 适配器配置
 */
export interface AdapterConfig {
  /** WebSocket URL */
  url: string
  /** 子协议 */
  protocols?: string | string[]
  /** 连接超时时间（毫秒） */
  connectionTimeout?: number
  /** 自定义请求头 */
  headers?: Record<string, string>
  /** 是否启用调试 */
  debug?: boolean
  /** Socket.IO 特定选项 */
  socketIOOptions?: Record<string, any>
}

/**
 * WebSocket 适配器接口
 * 
 * 定义了所有适配器必须实现的方法
 */
export interface IWebSocketAdapter {
  /** 当前连接状态 */
  readonly state: ConnectionState

  /** 是否已连接 */
  readonly isConnected: boolean

  /**
   * 建立连接
   */
  connect(): Promise<void>

  /**
   * 断开连接
   * @param code - 关闭代码
   * @param reason - 关闭原因
   */
  disconnect(code?: number, reason?: string): void

  /**
   * 发送消息
   * @param data - 消息数据
   */
  send(data: any): void

  /**
   * 发送二进制数据
   * @param data - 二进制数据
   */
  sendBinary(data: ArrayBuffer | Blob): void

  /**
   * 注册事件监听器
   * @param event - 事件名称
   * @param handler - 事件处理函数
   */
  on(event: string, handler: Function): void

  /**
   * 移除事件监听器
   * @param event - 事件名称
   * @param handler - 事件处理函数（可选，不传则移除所有）
   */
  off(event: string, handler?: Function): void

  /**
   * 触发事件
   * @param event - 事件名称
   * @param data - 事件数据
   */
  emit(event: string, ...args: any[]): void

  /**
   * 销毁适配器，释放资源
   */
  destroy(): void
}

/**
 * 适配器类型
 */
export type AdapterType = 'native' | 'socketio'

/**
 * 适配器工厂配置
 */
export interface AdapterFactoryConfig {
  /** 适配器类型 */
  type: AdapterType
  /** 适配器配置 */
  config: AdapterConfig
}


