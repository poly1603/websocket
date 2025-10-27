/**
 * 验证中间件
 * 
 * 验证消息格式和内容，确保消息符合预期规范
 */

import type { Middleware, MiddlewareContext } from './middleware'
import { ProtocolError } from '../core/errors'

/**
 * 验证规则函数
 */
export type ValidationRule = (data: unknown, context: MiddlewareContext) => boolean | string

/**
 * 验证中间件选项
 */
export interface ValidatorMiddlewareOptions {
  /** 是否启用 */
  enabled?: boolean
  /** 验证规则列表 */
  rules?: ValidationRule[]
  /** 是否在第一个错误时停止 */
  stopOnFirstError?: boolean
  /** 验证失败时的处理方式：'throw'（抛出错误）或 'skip'（跳过消息） */
  onError?: 'throw' | 'skip'
}

/**
 * 创建验证中间件
 * 
 * 根据提供的规则验证消息，不符合规则的消息可以选择抛出错误或跳过
 * 
 * @param options - 验证选项
 * @returns 验证中间件函数
 * 
 * @example
 * ```typescript
 * const validator = createValidatorMiddleware({
 *   enabled: true,
 *   rules: [
 *     // 检查消息必须有 type 字段
 *     (data) => {
 *       if (typeof data === 'object' && data && 'type' in data) {
 *         return true
 *       }
 *       return '消息必须包含 type 字段'
 *     },
 *     // 检查消息大小
 *     (data) => {
 *       const size = JSON.stringify(data).length
 *       if (size < 100000) { // 100KB
 *         return true
 *       }
 *       return '消息大小超过限制'
 *     }
 *   ],
 *   onError: 'throw'
 * })
 * 
 * middlewareManager.useSend(validator)
 * ```
 */
export function createValidatorMiddleware(options: ValidatorMiddlewareOptions = {}): Middleware {
  const {
    enabled = true,
    rules = [],
    stopOnFirstError = true,
    onError = 'throw',
  } = options

  return async (context: MiddlewareContext, next) => {
    if (!enabled || rules.length === 0) {
      await next()
      return
    }

    const errors: string[] = []

    // 执行所有验证规则
    for (const rule of rules) {
      const result = rule(context.data, context)
      
      if (result !== true) {
        const errorMessage = typeof result === 'string' ? result : '验证失败'
        errors.push(errorMessage)
        
        // 如果配置为遇到第一个错误就停止，立即处理
        if (stopOnFirstError) {
          break
        }
      }
    }

    // 如果有验证错误，根据配置处理
    if (errors.length > 0) {
      const fullError = errors.join('; ')
      
      if (onError === 'throw') {
        // 抛出协议错误
        throw new ProtocolError(`消息验证失败: ${fullError}`, {
          receivedData: context.data,
        })
      }
      else {
        // 跳过此消息
        console.warn(`[ValidatorMiddleware] 消息验证失败，已跳过: ${fullError}`)
        context.shouldSkip = true
        return // 不调用 next()
      }
    }

    // 验证通过，继续执行
    await next()
  }
}

/**
 * 创建 JSON Schema 验证中间件
 * 
 * 使用 JSON Schema 验证消息格式
 * 注意：需要自行引入 JSON Schema 验证库（如 ajv）
 * 
 * @param schema - JSON Schema 对象
 * @param options - 验证选项
 * @returns 验证中间件
 * 
 * @example
 * ```typescript
 * const schema = {
 *   type: 'object',
 *   required: ['type', 'data'],
 *   properties: {
 *     type: { type: 'string' },
 *     data: { type: 'object' }
 *   }
 * }
 * 
 * const validator = createSchemaValidator(schema)
 * middlewareManager.useSend(validator)
 * ```
 */
export function createSchemaValidator(
  schema: Record<string, unknown>,
  options: Omit<ValidatorMiddlewareOptions, 'rules'> = {}
): Middleware {
  return createValidatorMiddleware({
    ...options,
    rules: [
      (data) => {
        // 这里应该使用真正的 JSON Schema 验证库
        // 例如：ajv
        // const ajv = new Ajv()
        // const validate = ajv.compile(schema)
        // if (validate(data)) {
        //   return true
        // }
        // return ajv.errorsText(validate.errors)
        
        // 占位实现：基本的类型检查
        if (typeof data === 'object' && data !== null) {
          return true
        }
        return '数据格式不符合 schema 定义'
      },
    ],
  })
}

/**
 * 常用验证规则
 */
export const ValidationRules = {
  /**
   * 验证消息必须是对象
   */
  requireObject: (data: unknown) => {
    if (typeof data === 'object' && data !== null) {
      return true
    }
    return '消息必须是对象'
  },

  /**
   * 验证消息必须有 type 字段
   */
  requireType: (data: unknown) => {
    if (typeof data === 'object' && data && 'type' in data) {
      return true
    }
    return '消息必须包含 type 字段'
  },

  /**
   * 创建消息大小验证规则
   * 
   * @param maxSize - 最大字节数
   */
  maxSize: (maxSize: number): ValidationRule => {
    return (data: unknown) => {
      try {
        const size = JSON.stringify(data).length
        if (size <= maxSize) {
          return true
        }
        return `消息大小（${size}）超过限制（${maxSize}）`
      }
      catch {
        return true // 无法序列化的数据跳过检查
      }
    }
  },

  /**
   * 创建必需字段验证规则
   * 
   * @param fields - 必需字段列表
   */
  requireFields: (fields: string[]): ValidationRule => {
    return (data: unknown) => {
      if (typeof data !== 'object' || data === null) {
        return '数据必须是对象'
      }
      
      const obj = data as Record<string, unknown>
      const missing = fields.filter(field => !(field in obj))
      
      if (missing.length === 0) {
        return true
      }
      
      return `缺少必需字段: ${missing.join(', ')}`
    }
  },
}



