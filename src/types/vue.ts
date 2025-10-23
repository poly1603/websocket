/**
 * Vue 集成类型定义
 */

import type { Ref } from 'vue'
import type { ConnectionState, WebSocketClientConfig } from './client'
import type { WebSocketClient } from '../core/websocket-client'

/**
 * useWebSocket 选项
 */
export interface UseWebSocketOptions extends Partial<WebSocketClientConfig> {
  /** 是否自动连接 */
  autoConnect?: boolean
  /** 是否在组件卸载时自动断开 */
  autoDisconnect?: boolean
  /** 连接打开回调 */
  onOpen?: () => void
  /** 连接关闭回调 */
  onClose?: (event: any) => void
  /** 错误回调 */
  onError?: (error: any) => void
  /** 消息接收回调 */
  onMessage?: (data: any) => void
  /** 重连回调 */
  onReconnecting?: (attempt: number) => void
  /** 重连成功回调 */
  onReconnected?: () => void
}

/**
 * useWebSocket 返回值
 */
export interface UseWebSocketReturn {
  /** 连接状态 */
  state: Readonly<Ref<ConnectionState>>
  /** 最后接收的消息 */
  data: Readonly<Ref<any>>
  /** 错误信息 */
  error: Readonly<Ref<Error | null>>
  /** WebSocket 客户端实例 */
  client: Readonly<Ref<WebSocketClient | null>>
  /** 连接指标 */
  metrics: Readonly<Ref<any>>
  /** 是否已连接 */
  isConnected: Readonly<Ref<boolean>>
  /** 队列大小 */
  queueSize: Readonly<Ref<number>>
  /** 连接到服务器 */
  connect: () => Promise<void>
  /** 断开连接 */
  disconnect: (code?: number, reason?: string) => void
  /** 发送消息 */
  send: <T = any>(data: T, options?: any) => void
  /** 发送二进制数据 */
  sendBinary: (data: ArrayBuffer | Blob) => void
  /** 清空队列 */
  clearQueue: () => void
}

/**
 * WebSocket 插件选项
 */
export interface WebSocketPluginOptions extends WebSocketClientConfig {
  /** 插件名称（用于注入键） */
  name?: string
}


