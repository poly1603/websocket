/**
 * WebSocket 自定义错误类
 * 
 * 定义了各种场景下的专用错误类型，便于错误识别和处理
 * 所有自定义错误都继承自基础错误类 WebSocketError
 */

/**
 * WebSocket 基础错误类
 * 
 * 所有 WebSocket 相关错误的基类
 */
export class WebSocketError extends Error {
  /** 错误代码 */
  public code?: number

  /** 是否可以重试 */
  public retryable: boolean = false

  /** 原始错误对象 */
  public originalError?: Error | Event

  constructor(message: string, options?: {
    code?: number
    retryable?: boolean
    originalError?: Error | Event
  }) {
    super(message)
    this.name = 'WebSocketError'
    this.code = options?.code
    this.retryable = options?.retryable ?? false
    this.originalError = options?.originalError

    // 修复 Error 继承的问题（确保 instanceof 正确工作）
    Object.setPrototypeOf(this, WebSocketError.prototype)
  }
}

/**
 * 连接错误
 * 
 * 当无法建立 WebSocket 连接时抛出
 * 可能原因：网络故障、服务器不可达、URL 错误等
 */
export class ConnectionError extends WebSocketError {
  constructor(message: string, options?: {
    code?: number
    originalError?: Error | Event
  }) {
    super(message, {
      ...options,
      retryable: true, // 连接错误通常可以重试
    })
    this.name = 'ConnectionError'
    Object.setPrototypeOf(this, ConnectionError.prototype)
  }
}

/**
 * 超时错误
 * 
 * 当操作超过预定时间限制时抛出
 * 如：连接超时、心跳超时、消息确认超时等
 */
export class TimeoutError extends WebSocketError {
  /** 超时时长（毫秒） */
  public timeout: number

  constructor(message: string, timeout: number, options?: {
    code?: number
    originalError?: Error | Event
  }) {
    super(message, {
      ...options,
      retryable: true, // 超时错误通常可以重试
    })
    this.name = 'TimeoutError'
    this.timeout = timeout
    Object.setPrototypeOf(this, TimeoutError.prototype)
  }
}

/**
 * 协议错误
 * 
 * 当收到不符合预期协议格式的数据时抛出
 * 如：消息格式错误、协议版本不匹配等
 */
export class ProtocolError extends WebSocketError {
  /** 收到的原始数据 */
  public receivedData?: unknown

  constructor(message: string, options?: {
    code?: number
    receivedData?: unknown
    originalError?: Error | Event
  }) {
    super(message, {
      ...options,
      retryable: false, // 协议错误通常不应重试
    })
    this.name = 'ProtocolError'
    this.receivedData = options?.receivedData
    Object.setPrototypeOf(this, ProtocolError.prototype)
  }
}

/**
 * 队列满错误
 * 
 * 当消息队列已满且无法添加新消息时抛出
 */
export class QueueFullError extends WebSocketError {
  /** 当前队列大小 */
  public queueSize: number

  /** 队列最大容量 */
  public maxSize: number

  constructor(queueSize: number, maxSize: number) {
    super(`消息队列已满 (${queueSize}/${maxSize})，无法添加新消息`, {
      retryable: false, // 队列满时重试也无效，需要先清理队列
    })
    this.name = 'QueueFullError'
    this.queueSize = queueSize
    this.maxSize = maxSize
    Object.setPrototypeOf(this, QueueFullError.prototype)
  }
}

/**
 * 加密错误
 * 
 * 当消息加密或解密失败时抛出
 */
export class EncryptionError extends WebSocketError {
  /** 操作类型：加密或解密 */
  public operation: 'encrypt' | 'decrypt'

  constructor(message: string, operation: 'encrypt' | 'decrypt', options?: {
    originalError?: Error
  }) {
    super(message, {
      ...options,
      retryable: false, // 加密错误通常是配置问题，不应重试
    })
    this.name = 'EncryptionError'
    this.operation = operation
    Object.setPrototypeOf(this, EncryptionError.prototype)
  }
}

/**
 * 压缩错误
 * 
 * 当消息压缩或解压缩失败时抛出
 */
export class CompressionError extends WebSocketError {
  /** 操作类型：压缩或解压缩 */
  public operation: 'compress' | 'decompress'

  constructor(message: string, operation: 'compress' | 'decompress', options?: {
    originalError?: Error
  }) {
    super(message, {
      ...options,
      retryable: false, // 压缩错误通常是数据问题，不应重试
    })
    this.name = 'CompressionError'
    this.operation = operation
    Object.setPrototypeOf(this, CompressionError.prototype)
  }
}

/**
 * 状态错误
 * 
 * 当在不正确的连接状态下执行操作时抛出
 * 如：在未连接时尝试发送消息
 */
export class StateError extends WebSocketError {
  /** 当前状态 */
  public currentState: string

  /** 期望的状态 */
  public expectedState: string

  constructor(message: string, currentState: string, expectedState: string) {
    super(message, {
      retryable: false,
    })
    this.name = 'StateError'
    this.currentState = currentState
    this.expectedState = expectedState
    Object.setPrototypeOf(this, StateError.prototype)
  }
}

/**
 * 认证错误
 * 
 * 当 WebSocket 认证失败时抛出
 */
export class AuthenticationError extends WebSocketError {
  constructor(message: string, options?: {
    code?: number
    originalError?: Error | Event
  }) {
    super(message, {
      ...options,
      retryable: false, // 认证错误通常需要用户介入，不应自动重试
    })
    this.name = 'AuthenticationError'
    Object.setPrototypeOf(this, AuthenticationError.prototype)
  }
}

/**
 * 消息大小错误
 * 
 * 当消息大小超过限制时抛出
 */
export class MessageSizeError extends WebSocketError {
  /** 消息实际大小（字节） */
  public actualSize: number

  /** 允许的最大大小（字节） */
  public maxSize: number

  constructor(actualSize: number, maxSize: number) {
    super(`消息大小 (${actualSize} 字节) 超过限制 (${maxSize} 字节)`, {
      retryable: false,
    })
    this.name = 'MessageSizeError'
    this.actualSize = actualSize
    this.maxSize = maxSize
    Object.setPrototypeOf(this, MessageSizeError.prototype)
  }
}

/**
 * 检查错误是否可重试
 * 
 * @param error - 要检查的错误对象
 * @returns 如果错误可以重试返回 true，否则返回 false
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof WebSocketError) {
    return error.retryable
  }
  return false
}

/**
 * 从原生 WebSocket 错误创建自定义错误
 * 
 * @param error - 原生错误对象或事件
 * @param context - 错误上下文信息
 * @returns 自定义错误对象
 */
export function createErrorFromNative(
  error: Error | Event,
  context?: { operation?: string; state?: string }
): WebSocketError {
  const message = error instanceof Error ? error.message : '未知的 WebSocket 错误'

  // 根据错误消息判断错误类型
  if (message.includes('timeout') || message.includes('超时')) {
    return new TimeoutError(message, 0, { originalError: error })
  }

  if (message.includes('connection') || message.includes('connect') || message.includes('连接')) {
    return new ConnectionError(message, { originalError: error })
  }

  if (message.includes('auth') || message.includes('认证') || message.includes('unauthorized')) {
    return new AuthenticationError(message, { originalError: error })
  }

  // 默认返回基础 WebSocket 错误
  return new WebSocketError(message, {
    originalError: error,
    retryable: true,
  })
}



