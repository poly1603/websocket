/**
 * WebSocket 客户端核心类型定义
 */

/**
 * 连接状态
 */
export type ConnectionState =
  | 'connecting'    // 连接中
  | 'connected'     // 已连接
  | 'disconnecting' // 断开中
  | 'disconnected'  // 已断开
  | 'reconnecting'  // 重连中

/**
 * 重连配置
 */
export interface ReconnectConfig {
  /** 是否启用自动重连 */
  enabled?: boolean
  /** 初始重连延迟（毫秒） */
  delay?: number
  /** 最大重连延迟（毫秒） */
  maxDelay?: number
  /** 最大重连次数，0 表示无限次 */
  maxAttempts?: number
  /** 重连延迟增长因子（指数退避） */
  factor?: number
  /** 重连时的随机抖动（0-1），避免雷鸣群效应 */
  jitter?: number
}

/**
 * 心跳配置
 */
export interface HeartbeatConfig {
  /** 是否启用心跳检测 */
  enabled?: boolean
  /** 心跳发送间隔（毫秒） */
  interval?: number
  /** 心跳超时时间（毫秒） */
  timeout?: number
  /** 心跳消息内容 */
  message?: any
  /** 心跳响应消息类型（用于识别 pong） */
  pongType?: string
}

/**
 * 消息队列配置
 */
export interface QueueConfig {
  /** 是否启用消息队列 */
  enabled?: boolean
  /** 队列最大长度 */
  maxSize?: number
  /** 是否持久化到 localStorage */
  persistent?: boolean
  /** 持久化存储键名 */
  storageKey?: string
}

/**
 * 加密配置
 */
export interface EncryptionConfig {
  /** 是否启用加密 */
  enabled?: boolean
  /** 加密算法 */
  algorithm?: 'aes-256-gcm' | 'aes-256-cbc'
  /** 加密密钥 */
  key?: string
  /** 初始化向量 */
  iv?: string
}

/**
 * 压缩配置
 */
export interface CompressionConfig {
  /** 是否启用压缩 */
  enabled?: boolean
  /** 压缩阈值（字节），小于此值不压缩 */
  threshold?: number
  /** 压缩算法 */
  algorithm?: 'gzip' | 'deflate' | 'lz-string'
}

/**
 * WebSocket 客户端配置
 */
export interface WebSocketClientConfig {
  /** WebSocket 服务器 URL */
  url: string
  /** 子协议 */
  protocols?: string | string[]
  /** 重连配置 */
  reconnect?: ReconnectConfig
  /** 心跳配置 */
  heartbeat?: HeartbeatConfig
  /** 消息队列配置 */
  queue?: QueueConfig
  /** 加密配置 */
  encryption?: EncryptionConfig
  /** 压缩配置 */
  compression?: CompressionConfig
  /** 适配器类型 */
  adapter?: 'native' | 'socketio'
  /** 连接超时时间（毫秒） */
  connectionTimeout?: number
  /** 是否启用调试日志 */
  debug?: boolean
  /** 自定义请求头（仅 Node.js 环境） */
  headers?: Record<string, string>
}

/**
 * 消息发送选项
 */
export interface SendOptions {
  /** 消息优先级 */
  priority?: 'high' | 'normal' | 'low'
  /** 是否需要确认（ACK） */
  requireAck?: boolean
  /** 超时时间（毫秒） */
  timeout?: number
  /** 重试次数 */
  retries?: number
}

/**
 * 消息队列项
 */
export interface QueueItem {
  /** 消息内容 */
  data: any
  /** 优先级 */
  priority: 'high' | 'normal' | 'low'
  /** 时间戳 */
  timestamp: number
  /** 消息 ID */
  id: string
  /** 重试次数 */
  retries?: number
}

/**
 * 连接指标
 */
export interface ConnectionMetrics {
  /** 连接建立时间 */
  connectedAt?: number
  /** 总共发送的消息数 */
  messagesSent: number
  /** 总共接收的消息数 */
  messagesReceived: number
  /** 重连次数 */
  reconnectCount: number
  /** 当前重连尝试次数 */
  currentReconnectAttempt: number
  /** 平均延迟（毫秒） */
  averageLatency: number
  /** 最后一次心跳时间 */
  lastHeartbeat?: number
  /** 队列中的消息数 */
  queuedMessages: number
}

/**
 * WebSocket 错误
 */
export interface WebSocketError {
  /** 错误类型 */
  type: 'connection' | 'timeout' | 'protocol' | 'unknown'
  /** 错误消息 */
  message: string
  /** 原始错误对象 */
  originalError?: Error | Event
  /** 错误代码 */
  code?: number
  /** 是否可重试 */
  retryable?: boolean
}
