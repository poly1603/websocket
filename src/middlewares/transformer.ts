/**
 * 数据转换中间件
 * 
 * 提供消息的转换、序列化和格式化功能
 */

import type { Middleware, MiddlewareContext } from './middleware'

/**
 * 转换函数类型
 */
export type TransformFunction = (data: unknown, context: MiddlewareContext) => unknown

/**
 * 转换中间件选项
 */
export interface TransformerMiddlewareOptions {
  /** 是否启用 */
  enabled?: boolean
  /** 发送时的转换函数 */
  transformSend?: TransformFunction
  /** 接收时的转换函数 */
  transformReceive?: TransformFunction
}

/**
 * 创建转换中间件
 * 
 * 在消息发送或接收时自动转换数据格式
 * 
 * @param options - 转换选项
 * @returns 转换中间件函数
 * 
 * @example
 * ```typescript
 * const transformer = createTransformerMiddleware({
 *   enabled: true,
 *   transformSend: (data) => {
 *     // 发送前添加时间戳
 *     return {
 *       ...data,
 *       timestamp: Date.now()
 *     }
 *   },
 *   transformReceive: (data) => {
 *     // 接收后解析特殊格式
 *     return parseCustomFormat(data)
 *   }
 * })
 * 
 * middlewareManager.use(transformer)
 * ```
 */
export function createTransformerMiddleware(options: TransformerMiddlewareOptions = {}): Middleware {
  const {
    enabled = true,
    transformSend,
    transformReceive,
  } = options

  return async (context: MiddlewareContext, next) => {
    if (!enabled) {
      await next()
      return
    }

    // 根据方向选择转换函数
    const transformFn = context.direction === 'send' ? transformSend : transformReceive

    // 执行转换
    if (transformFn) {
      try {
        context.data = transformFn(context.data, context)
      }
      catch (error) {
        console.error('[TransformerMiddleware] 数据转换失败:', error)
        throw error
      }
    }

    await next()
  }
}

/**
 * 常用转换器
 */
export const Transformers = {
  /**
   * 添加时间戳转换器
   * 
   * 在发送的消息中自动添加时间戳字段
   */
  addTimestamp: (timestampField: string = 'timestamp'): TransformFunction => {
    return (data: unknown) => {
      if (typeof data === 'object' && data !== null) {
        return {
          ...(data as object),
          [timestampField]: Date.now(),
        }
      }
      return data
    }
  },

  /**
   * 添加元数据转换器
   * 
   * 在消息中添加自定义元数据
   * 
   * @param metadata - 要添加的元数据
   */
  addMetadata: (metadata: Record<string, unknown>): TransformFunction => {
    return (data: unknown) => {
      if (typeof data === 'object' && data !== null) {
        return {
          ...(data as object),
          ...metadata,
        }
      }
      return data
    }
  },

  /**
   * 消息包装转换器
   * 
   * 将原始数据包装在统一的消息格式中
   * 
   * @param wrapperKey - 包装字段名，默认 'payload'
   */
  wrap: (wrapperKey: string = 'payload'): TransformFunction => {
    return (data: unknown, context: MiddlewareContext) => {
      return {
        [wrapperKey]: data,
        type: context.type,
        id: context.id,
        timestamp: context.timestamp,
      }
    }
  },

  /**
   * 消息解包转换器
   * 
   * 从包装的消息格式中提取原始数据
   * 
   * @param wrapperKey - 包装字段名，默认 'payload'
   */
  unwrap: (wrapperKey: string = 'payload'): TransformFunction => {
    return (data: unknown) => {
      if (typeof data === 'object' && data !== null) {
        const obj = data as Record<string, unknown>
        if (wrapperKey in obj) {
          return obj[wrapperKey]
        }
      }
      return data
    }
  },

  /**
   * 字符串化转换器
   * 
   * 确保数据被序列化为 JSON 字符串
   */
  stringify: (): TransformFunction => {
    return (data: unknown) => {
      if (typeof data === 'string') {
        return data
      }
      return JSON.stringify(data)
    }
  },

  /**
   * JSON 解析转换器
   * 
   * 尝试将字符串解析为 JSON 对象
   */
  parse: (): TransformFunction => {
    return (data: unknown) => {
      if (typeof data === 'string') {
        try {
          return JSON.parse(data)
        }
        catch {
          return data // 解析失败，返回原始字符串
        }
      }
      return data
    }
  },

  /**
   * 字段重命名转换器
   * 
   * 重命名消息中的字段
   * 
   * @param mapping - 字段映射，key 为旧字段名，value 为新字段名
   */
  renameFields: (mapping: Record<string, string>): TransformFunction => {
    return (data: unknown) => {
      if (typeof data !== 'object' || data === null) {
        return data
      }

      const obj = data as Record<string, unknown>
      const result: Record<string, unknown> = {}

      for (const [key, value] of Object.entries(obj)) {
        const newKey = mapping[key] || key
        result[newKey] = value
      }

      return result
    }
  },

  /**
   * 字段过滤转换器
   * 
   * 只保留指定的字段
   * 
   * @param allowedFields - 允许的字段列表
   */
  pickFields: (allowedFields: string[]): TransformFunction => {
    return (data: unknown) => {
      if (typeof data !== 'object' || data === null) {
        return data
      }

      const obj = data as Record<string, unknown>
      const result: Record<string, unknown> = {}

      for (const field of allowedFields) {
        if (field in obj) {
          result[field] = obj[field]
        }
      }

      return result
    }
  },

  /**
   * 字段排除转换器
   * 
   * 排除指定的字段
   * 
   * @param excludedFields - 要排除的字段列表
   */
  omitFields: (excludedFields: string[]): TransformFunction => {
    return (data: unknown) => {
      if (typeof data !== 'object' || data === null) {
        return data
      }

      const obj = data as Record<string, unknown>
      const result: Record<string, unknown> = {}

      for (const [key, value] of Object.entries(obj)) {
        if (!excludedFields.includes(key)) {
          result[key] = value
        }
      }

      return result
    }
  },
}



