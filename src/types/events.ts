/**
 * WebSocket 事件类型定义
 */

import type { ConnectionState, WebSocketError } from './client'

/**
 * WebSocket 事件类型
 */
export type WebSocketEventType =
  | 'open'              // 连接打开
  | 'close'             // 连接关闭
  | 'error'             // 错误发生
  | 'message'           // 收到消息
  | 'reconnecting'      // 正在重连
  | 'reconnected'       // 重连成功
  | 'reconnect-failed'  // 重连失败
  | 'ping'              // 发送心跳
  | 'pong'              // 收到心跳响应
  | 'state-change'      // 状态变化

/**
 * 事件监听器类型
 */
export type EventListener<T = any> = (data?: T) => void

/**
 * 连接打开事件数据
 */
export interface OpenEvent {
  /** 连接建立的时间戳 */
  timestamp: number
}

/**
 * 连接关闭事件数据
 */
export interface CloseEvent {
  /** 关闭代码 */
  code: number
  /** 关闭原因 */
  reason: string
  /** 是否为正常关闭 */
  wasClean: boolean
  /** 时间戳 */
  timestamp: number
}

/**
 * 错误事件数据
 */
export interface ErrorEvent {
  /** WebSocket 错误对象 */
  error: WebSocketError
  /** 时间戳 */
  timestamp: number
}

/**
 * 消息事件数据
 */
export interface MessageEvent<T = any> {
  /** 消息数据 */
  data: T
  /** 消息类型（如果是结构化消息） */
  type?: string
  /** 消息 ID（如果有） */
  id?: string
  /** 时间戳 */
  timestamp: number
  /** 是否为二进制消息 */
  isBinary?: boolean
}

/**
 * 重连事件数据
 */
export interface ReconnectingEvent {
  /** 当前重连尝试次数 */
  attempt: number
  /** 最大重连次数 */
  maxAttempts: number
  /** 下次重连延迟（毫秒） */
  delay: number
  /** 时间戳 */
  timestamp: number
}

/**
 * 重连成功事件数据
 */
export interface ReconnectedEvent {
  /** 总共尝试次数 */
  attempts: number
  /** 重连耗时（毫秒） */
  duration: number
  /** 时间戳 */
  timestamp: number
}

/**
 * 重连失败事件数据
 */
export interface ReconnectFailedEvent {
  /** 尝试次数 */
  attempts: number
  /** 失败原因 */
  reason: string
  /** 时间戳 */
  timestamp: number
}

/**
 * 心跳事件数据
 */
export interface HeartbeatEvent {
  /** 心跳消息内容 */
  message?: any
  /** 时间戳 */
  timestamp: number
}

/**
 * 状态变化事件数据
 */
export interface StateChangeEvent {
  /** 旧状态 */
  oldState: ConnectionState
  /** 新状态 */
  newState: ConnectionState
  /** 时间戳 */
  timestamp: number
}

/**
 * 事件数据映射
 */
export interface EventDataMap {
  'open': OpenEvent
  'close': CloseEvent
  'error': ErrorEvent
  'message': MessageEvent
  'reconnecting': ReconnectingEvent
  'reconnected': ReconnectedEvent
  'reconnect-failed': ReconnectFailedEvent
  'ping': HeartbeatEvent
  'pong': HeartbeatEvent
  'state-change': StateChangeEvent
}


