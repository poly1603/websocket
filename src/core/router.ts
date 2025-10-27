/**
 * 消息路由管理器
 * 
 * 实现基于消息类型的路由和频道订阅机制
 * 
 * 功能：
 * - 消息类型路由：根据消息类型分发到不同的处理器
 * - 频道订阅：订阅/取消订阅特定频道的消息
 * - 通配符匹配：支持 * 和 ** 通配符
 * - 优先级处理：支持处理器优先级
 * 
 * 应用场景：
 * - 多类型消息的分类处理
 * - 聊天室/房间功能
 * - 主题订阅（pub/sub 模式）
 * - 复杂消息分发逻辑
 * 
 * @example
 * ```typescript
 * const router = new MessageRouter()
 * 
 * // 注册路由处理器
 * router.on('chat.message', (data) => {
 *   console.log('聊天消息:', data)
 * })
 * 
 * router.on('user.*', (data) => {
 *   console.log('用户事件:', data)
 * })
 * 
 * // 订阅频道
 * router.subscribe('room-123')
 * 
 * // 分发消息
 * router.dispatch({ type: 'chat.message', content: 'Hello' })
 * ```
 */

/**
 * 消息处理器函数
 */
export type MessageHandler = (data: unknown, context: RouteContext) => void | Promise<void>

/**
 * 路由上下文
 */
export interface RouteContext {
  /** 消息类型 */
  type: string
  /** 原始消息数据 */
  rawData: unknown
  /** 时间戳 */
  timestamp: number
  /** 频道名称（如果有） */
  channel?: string
  /** 是否已被处理 */
  handled: boolean
}

/**
 * 路由规则
 */
interface Route {
  /** 路由模式（支持通配符） */
  pattern: string
  /** 处理器函数 */
  handler: MessageHandler
  /** 优先级（数值越大越优先） */
  priority: number
  /** 是否是一次性处理器 */
  once: boolean
}

/**
 * 频道订阅信息
 */
interface ChannelSubscription {
  /** 频道名称 */
  name: string
  /** 订阅时间 */
  subscribedAt: number
  /** 处理器函数 */
  handler?: MessageHandler
}

/**
 * 消息路由管理器类
 */
export class MessageRouter {
  /** 路由规则列表 */
  private routes: Route[] = []

  /** 频道订阅列表 */
  private subscriptions: Map<string, ChannelSubscription> = new Map()

  /** 默认处理器（未匹配任何路由时使用） */
  private defaultHandler: MessageHandler | null = null

  /**
   * 注册路由处理器
   * 
   * @param pattern - 消息类型模式（支持通配符 * 和 **）
   * @param handler - 处理器函数
   * @param priority - 优先级，默认 0
   * 
   * 通配符说明：
   * - `*` 匹配单个段（不包含 .）
   * - `**` 匹配任意段（包含 .）
   * 
   * @example
   * ```typescript
   * // 精确匹配
   * router.on('chat.message', handler)
   * 
   * // 单段通配
   * router.on('user.*', handler)  // 匹配 user.login, user.logout 等
   * 
   * // 多段通配
   * router.on('event.**', handler)  // 匹配 event.a, event.a.b, event.a.b.c 等
   * ```
   */
  on(pattern: string, handler: MessageHandler, priority: number = 0): void {
    this.routes.push({
      pattern,
      handler,
      priority,
      once: false,
    })

    // 按优先级排序（优先级高的在前）
    this.routes.sort((a, b) => b.priority - a.priority)
  }

  /**
   * 注册一次性路由处理器
   * 
   * 处理器在首次匹配后会自动移除
   * 
   * @param pattern - 消息类型模式
   * @param handler - 处理器函数
   * @param priority - 优先级
   */
  once(pattern: string, handler: MessageHandler, priority: number = 0): void {
    this.routes.push({
      pattern,
      handler,
      priority,
      once: true,
    })

    this.routes.sort((a, b) => b.priority - a.priority)
  }

  /**
   * 移除路由处理器
   * 
   * @param pattern - 消息类型模式
   * @param handler - 处理器函数（可选）
   */
  off(pattern: string, handler?: MessageHandler): void {
    if (!handler) {
      // 移除匹配该模式的所有处理器
      this.routes = this.routes.filter(route => route.pattern !== pattern)
    }
    else {
      // 移除特定的处理器
      this.routes = this.routes.filter(
        route => !(route.pattern === pattern && route.handler === handler)
      )
    }
  }

  /**
   * 设置默认处理器
   * 
   * 当消息不匹配任何路由时，会调用此处理器
   * 
   * @param handler - 默认处理器函数
   */
  setDefaultHandler(handler: MessageHandler | null): void {
    this.defaultHandler = handler
  }

  /**
   * 分发消息到匹配的处理器
   * 
   * @param data - 消息数据
   * @returns 是否有处理器处理了该消息
   */
  async dispatch(data: unknown): Promise<boolean> {
    // 提取消息类型和频道
    const { type, channel } = this.extractTypeAndChannel(data)

    if (!type) {
      // 没有类型信息，使用默认处理器
      if (this.defaultHandler) {
        await this.defaultHandler(data, this.createContext(type || 'unknown', data))
        return true
      }
      return false
    }

    // 检查频道订阅
    if (channel && !this.subscriptions.has(channel)) {
      // 未订阅此频道，忽略消息
      return false
    }

    // 创建路由上下文
    const context = this.createContext(type, data, channel)

    // 查找匹配的路由
    const matchedRoutes: Route[] = []
    for (const route of this.routes) {
      if (this.matchPattern(type, route.pattern)) {
        matchedRoutes.push(route)
      }
    }

    // 如果没有匹配的路由，使用默认处理器
    if (matchedRoutes.length === 0) {
      if (this.defaultHandler) {
        await this.defaultHandler(data, context)
        return true
      }
      return false
    }

    // 执行所有匹配的处理器
    for (const route of matchedRoutes) {
      try {
        await route.handler(data, context)
        context.handled = true

        // 如果是一次性处理器，移除它
        if (route.once) {
          this.off(route.pattern, route.handler)
        }
      }
      catch (error) {
        console.error(`[MessageRouter] 路由处理器执行错误 (${route.pattern}):`, error)
      }
    }

    return context.handled
  }

  /**
   * 订阅频道
   * 
   * @param channel - 频道名称
   * @param handler - 频道消息处理器（可选）
   * 
   * @example
   * ```typescript
   * // 订阅聊天室
   * router.subscribe('room-123', (data) => {
   *   console.log('房间消息:', data)
   * })
   * ```
   */
  subscribe(channel: string, handler?: MessageHandler): void {
    this.subscriptions.set(channel, {
      name: channel,
      subscribedAt: Date.now(),
      handler,
    })
  }

  /**
   * 取消订阅频道
   * 
   * @param channel - 频道名称
   * @returns 是否成功取消订阅
   */
  unsubscribe(channel: string): boolean {
    return this.subscriptions.delete(channel)
  }

  /**
   * 取消所有频道订阅
   */
  unsubscribeAll(): void {
    this.subscriptions.clear()
  }

  /**
   * 检查是否已订阅频道
   * 
   * @param channel - 频道名称
   */
  isSubscribed(channel: string): boolean {
    return this.subscriptions.has(channel)
  }

  /**
   * 获取已订阅的频道列表
   */
  getSubscribedChannels(): string[] {
    return Array.from(this.subscriptions.keys())
  }

  /**
   * 模式匹配
   * 
   * @param type - 消息类型
   * @param pattern - 路由模式
   * @returns 是否匹配
   */
  private matchPattern(type: string, pattern: string): boolean {
    // 精确匹配
    if (type === pattern) {
      return true
    }

    // 将模式转换为正则表达式
    // * 匹配单个段（不包含 .）
    // ** 匹配任意段（包含 .）
    const regexPattern = pattern
      .replace(/\./g, '\\.') // 转义 .
      .replace(/\*\*/g, '___DOUBLE_STAR___') // 临时替换 **
      .replace(/\*/g, '[^.]+') // * 替换为匹配非 . 的字符
      .replace(/___DOUBLE_STAR___/g, '.*') // ** 替换为匹配任意字符

    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(type)
  }

  /**
   * 提取消息类型和频道
   */
  private extractTypeAndChannel(data: unknown): { type?: string; channel?: string } {
    if (typeof data !== 'object' || data === null) {
      return {}
    }

    const obj = data as Record<string, unknown>

    return {
      type: typeof obj.type === 'string' ? obj.type : undefined,
      channel: typeof obj.channel === 'string' ? obj.channel : undefined,
    }
  }

  /**
   * 创建路由上下文
   */
  private createContext(type: string, rawData: unknown, channel?: string): RouteContext {
    return {
      type,
      rawData,
      timestamp: Date.now(),
      channel,
      handled: false,
    }
  }

  /**
   * 获取路由统计信息
   */
  getStats() {
    return {
      /** 注册的路由数量 */
      routeCount: this.routes.length,
      /** 订阅的频道数量 */
      channelCount: this.subscriptions.size,
      /** 已订阅的频道列表 */
      channels: this.getSubscribedChannels(),
      /** 路由模式列表 */
      patterns: this.routes.map(r => r.pattern),
    }
  }

  /**
   * 清除所有路由和订阅
   */
  clear(): void {
    this.routes = []
    this.subscriptions.clear()
    this.defaultHandler = null
  }
}


