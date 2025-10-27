/**
 * 日志中间件
 * 
 * 记录消息的发送和接收日志，用于调试和监控
 */

import type { Middleware, MiddlewareContext } from './middleware'

/**
 * 日志中间件选项
 */
export interface LoggerMiddlewareOptions {
  /** 是否启用 */
  enabled?: boolean
  /** 是否记录消息内容 */
  logData?: boolean
  /** 是否记录时间戳 */
  logTimestamp?: boolean
  /** 自定义日志函数 */
  logger?: (message: string, context: MiddlewareContext) => void
}

/**
 * 创建日志中间件
 * 
 * 记录所有通过的消息，便于调试和问题排查
 * 
 * @param options - 日志选项
 * @returns 日志中间件函数
 * 
 * @example
 * ```typescript
 * const logger = createLoggerMiddleware({
 *   enabled: true,
 *   logData: true,
 *   logTimestamp: true
 * })
 * 
 * middlewareManager.use(logger)
 * ```
 */
export function createLoggerMiddleware(options: LoggerMiddlewareOptions = {}): Middleware {
  const {
    enabled = true,
    logData = true,
    logTimestamp = true,
    logger = defaultLogger,
  } = options

  return async (context: MiddlewareContext, next) => {
    if (!enabled) {
      await next()
      return
    }

    // 构建日志消息
    const parts: string[] = []
    
    // 方向标记
    const directionSymbol = context.direction === 'send' ? '→' : '←'
    parts.push(`[WebSocket ${directionSymbol}]`)
    
    // 消息类型
    if (context.type) {
      parts.push(`类型: ${context.type}`)
    }
    
    // 消息 ID
    if (context.id) {
      parts.push(`ID: ${context.id}`)
    }
    
    // 时间戳
    if (logTimestamp) {
      const time = new Date(context.timestamp).toISOString()
      parts.push(`时间: ${time}`)
    }
    
    // 消息内容
    if (logData) {
      const dataStr = typeof context.data === 'string'
        ? context.data
        : JSON.stringify(context.data)
      
      // 限制日志长度
      const maxLength = 200
      const truncated = dataStr.length > maxLength
        ? dataStr.substring(0, maxLength) + '...'
        : dataStr
      
      parts.push(`数据: ${truncated}`)
    }

    const logMessage = parts.join(' | ')
    logger(logMessage, context)

    // 执行下一个中间件
    await next()
  }
}

/**
 * 默认日志函数
 */
function defaultLogger(message: string, context: MiddlewareContext): void {
  const method = context.direction === 'send' ? 'log' : 'info'
  console[method](message)
}



