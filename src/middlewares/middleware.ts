/**
 * WebSocket 中间件系统
 * 
 * 实现洋葱模型的中间件机制，用于拦截和处理消息的发送和接收
 * 
 * 洋葱模型：
 * - 中间件按注册顺序依次执行
 * - 每个中间件可以：
 *   1. 在 next() 前执行预处理
 *   2. 调用 next() 传递给下一个中间件
 *   3. 在 next() 后执行后处理
 * 
 * 执行流程示例：
 * ```
 * 请求 → 中间件1前 → 中间件2前 → 中间件3前 → 实际发送
 *                  ← 中间件1后 ← 中间件2后 ← 中间件3后 ← 响应
 * ```
 * 
 * @example
 * ```typescript
 * // 日志中间件
 * const logger: Middleware = async (context, next) => {
 *   console.log('发送前:', context.data)
 *   await next()
 *   console.log('发送后')
 * }
 * 
 * // 验证中间件
 * const validator: Middleware = async (context, next) => {
 *   if (!context.data.token) {
 *     throw new Error('缺少认证token')
 *   }
 *   await next()
 * }
 * ```
 */

/**
 * 中间件上下文
 * 
 * 携带消息数据和元数据，在中间件链中传递
 */
export interface MiddlewareContext {
  /** 消息数据（可被中间件修改） */
  data: unknown
  
  /** 消息方向：send（发送）或 receive（接收） */
  direction: 'send' | 'receive'
  
  /** 消息类型（如果是结构化消息） */
  type?: string
  
  /** 消息 ID（如果有） */
  id?: string
  
  /** 时间戳 */
  timestamp: number
  
  /** 自定义元数据，中间件可以在此添加任意数据 */
  meta: Record<string, unknown>
  
  /** 是否应该跳过后续中间件 */
  shouldSkip?: boolean
}

/**
 * 中间件函数类型
 * 
 * @param context - 中间件上下文
 * @param next - 调用下一个中间件的函数
 */
export type Middleware = (
  context: MiddlewareContext,
  next: () => Promise<void>
) => Promise<void> | void

/**
 * 中间件管理器
 * 
 * 管理中间件的注册、移除和执行
 */
export class MiddlewareManager {
  /** 发送中间件列表 */
  private sendMiddlewares: Middleware[] = []
  
  /** 接收中间件列表 */
  private receiveMiddlewares: Middleware[] = []

  /**
   * 注册发送中间件
   * 
   * 在消息发送前执行的中间件
   * 
   * @param middleware - 中间件函数
   * 
   * @example
   * ```typescript
   * manager.useSend(async (context, next) => {
   *   console.log('准备发送:', context.data)
   *   await next()
   *   console.log('已发送')
   * })
   * ```
   */
  useSend(middleware: Middleware): void {
    this.sendMiddlewares.push(middleware)
  }

  /**
   * 注册接收中间件
   * 
   * 在消息接收后执行的中间件
   * 
   * @param middleware - 中间件函数
   * 
   * @example
   * ```typescript
   * manager.useReceive(async (context, next) => {
   *   console.log('收到消息:', context.data)
   *   await next()
   * })
   * ```
   */
  useReceive(middleware: Middleware): void {
    this.receiveMiddlewares.push(middleware)
  }

  /**
   * 注册通用中间件（同时用于发送和接收）
   * 
   * @param middleware - 中间件函数
   */
  use(middleware: Middleware): void {
    this.useSend(middleware)
    this.useReceive(middleware)
  }

  /**
   * 执行发送中间件链
   * 
   * @param data - 要发送的数据
   * @param actualSend - 实际的发送函数
   * @returns 处理后的数据
   */
  async executeSend(data: unknown, actualSend: () => Promise<void> | void): Promise<void> {
    const context = this.createContext(data, 'send')
    
    await this.executeChain(this.sendMiddlewares, context, actualSend)
    
    return
  }

  /**
   * 执行接收中间件链
   * 
   * @param data - 接收到的数据
   * @returns 处理后的数据
   */
  async executeReceive(data: unknown): Promise<unknown> {
    const context = this.createContext(data, 'receive')
    
    await this.executeChain(this.receiveMiddlewares, context, async () => {
      // 接收中间件的最终操作是什么都不做（数据已被处理）
    })
    
    return context.data
  }

  /**
   * 创建中间件上下文
   */
  private createContext(data: unknown, direction: 'send' | 'receive'): MiddlewareContext {
    // 尝试提取消息类型和 ID
    let type: string | undefined
    let id: string | undefined
    
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>
      type = typeof obj.type === 'string' ? obj.type : undefined
      id = typeof obj.id === 'string' ? obj.id : undefined
    }

    return {
      data,
      direction,
      type,
      id,
      timestamp: Date.now(),
      meta: {},
    }
  }

  /**
   * 执行中间件链（洋葱模型）
   * 
   * @param middlewares - 中间件列表
   * @param context - 上下文
   * @param finalAction - 最终要执行的操作
   */
  private async executeChain(
    middlewares: Middleware[],
    context: MiddlewareContext,
    finalAction: () => Promise<void> | void
  ): Promise<void> {
    if (middlewares.length === 0) {
      await finalAction()
      return
    }

    let index = 0

    const next = async (): Promise<void> => {
      // 检查是否应该跳过后续中间件
      if (context.shouldSkip) {
        return
      }

      if (index >= middlewares.length) {
        // 所有中间件都执行完了，执行最终操作
        await finalAction()
        return
      }

      const middleware = middlewares[index++]
      
      try {
        await middleware(context, next)
      }
      catch (error) {
        // 中间件执行出错，记录错误并继续
        console.error('[MiddlewareManager] 中间件执行错误:', error)
        throw error
      }
    }

    await next()
  }

  /**
   * 移除所有中间件
   */
  clear(): void {
    this.sendMiddlewares = []
    this.receiveMiddlewares = []
  }

  /**
   * 获取中间件数量
   */
  getMiddlewareCount(): { send: number; receive: number } {
    return {
      send: this.sendMiddlewares.length,
      receive: this.receiveMiddlewares.length,
    }
  }
}



