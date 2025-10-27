/**
 * RPC（远程过程调用）管理器
 * 
 * 实现类似 HTTP 请求-响应模式的 WebSocket RPC 功能
 * 将异步消息通信封装为 Promise 风格的 API
 * 
 * 工作原理：
 * 1. 发送请求时生成唯一 ID 并返回 Promise
 * 2. 将 Promise 的 resolve/reject 保存起来
 * 3. 收到对应 ID 的响应时，resolve Promise
 * 4. 超时未收到响应时，reject Promise
 * 
 * 使用场景：
 * - 需要等待服务器响应的操作
 * - 类似 HTTP API 调用的场景
 * - 简化异步消息处理
 * 
 * @example
 * ```typescript
 * // 发送请求并等待响应
 * try {
 *   const response = await rpcManager.request({ method: 'getUserInfo', userId: 123 })
 *   console.log('用户信息:', response)
 * } catch (error) {
 *   console.error('请求失败:', error)
 * }
 * ```
 */

import { generateId } from '../utils/id-generator'
import { TimeoutError } from './errors'

/**
 * RPC 配置选项
 */
export interface RpcConfig {
  /** 是否启用 RPC 功能 */
  enabled?: boolean
  /** 默认请求超时时间（毫秒） */
  defaultTimeout?: number
  /** 请求消息类型字段 */
  requestType?: string
  /** 响应消息类型字段 */
  responseType?: string
  /** 请求 ID 字段名 */
  idField?: string
}

/**
 * 待处理的 RPC 请求
 */
interface PendingRequest<T = unknown> {
  /** 请求 ID */
  id: string
  /** 请求数据 */
  request: unknown
  /** 发送时间戳 */
  timestamp: number
  /** Promise 的 resolve 函数 */
  resolve: (value: T) => void
  /** Promise 的 reject 函数 */
  reject: (reason: Error) => void
  /** 超时定时器 */
  timer: ReturnType<typeof setTimeout> | null
}

/**
 * 默认 RPC 配置
 */
const DEFAULT_CONFIG: Required<RpcConfig> = {
  enabled: true,
  defaultTimeout: 30000,  // 30 秒超时
  requestType: 'rpc_request',
  responseType: 'rpc_response',
  idField: 'requestId',
}

/**
 * RPC 管理器类
 * 
 * 管理请求-响应对的关联，提供类似函数调用的异步通信体验
 */
export class RpcManager {
  /** RPC 配置 */
  private config: Required<RpcConfig>

  /** 待处理请求映射表，key 为请求 ID */
  private pendingRequests: Map<string, PendingRequest> = new Map()

  /**
   * 创建 RPC 管理器
   * 
   * @param config - RPC 配置选项
   */
  constructor(config?: RpcConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 是否启用 RPC 功能
   */
  get isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * 获取待处理请求数量
   */
  get pendingCount(): number {
    return this.pendingRequests.size
  }

  /**
   * 发送 RPC 请求
   * 
   * 生成唯一请求 ID，构造请求消息，并返回 Promise 等待响应
   * 
   * @param data - 请求数据（方法名、参数等）
   * @param timeout - 超时时间（毫秒），可选，默认使用配置的超时时间
   * @returns Promise<T> 返回响应数据的 Promise
   * 
   * @example
   * ```typescript
   * // 调用远程方法
   * const result = await rpcManager.request({
   *   method: 'calculateSum',
   *   params: [1, 2, 3]
   * }, 5000)
   * 
   * console.log('计算结果:', result) // { result: 6 }
   * ```
   */
  request<T = unknown>(data: unknown, timeout?: number): { requestId: string; promise: Promise<T> } {
    if (!this.config.enabled) {
      throw new Error('RPC 功能未启用')
    }

    // 生成唯一请求 ID
    const requestId = generateId('rpc')

    // 获取超时时间
    const timeoutMs = timeout ?? this.config.defaultTimeout

    // 创建 Promise
    const promise = new Promise<T>((resolve, reject) => {
      // 设置超时定时器
      const timer = setTimeout(() => {
        this.handleTimeout(requestId)
      }, timeoutMs)

      // 保存到待处理请求列表
      const pending: PendingRequest<T> = {
        id: requestId,
        request: data,
        timestamp: Date.now(),
        resolve,
        reject,
        timer,
      }

      this.pendingRequests.set(requestId, pending)
    })

    return { requestId, promise }
  }

  /**
   * 处理 RPC 响应
   * 
   * 当收到服务器的响应消息时调用
   * 
   * @param requestId - 请求 ID
   * @param responseData - 响应数据
   * @param isError - 是否是错误响应
   * @returns 是否成功处理响应
   * 
   * @example
   * ```typescript
   * // 在接收到服务器响应时
   * rpcManager.handleResponse('rpc_12345', { result: 'success' }, false)
   * 
   * // 处理错误响应
   * rpcManager.handleResponse('rpc_12345', { error: 'Not found' }, true)
   * ```
   */
  handleResponse(requestId: string, responseData: unknown, isError: boolean = false): boolean {
    const pending = this.pendingRequests.get(requestId)

    if (!pending) {
      // 可能是重复响应或未知的请求 ID
      console.warn(`[RpcManager] 收到未知请求的响应: ${requestId}`)
      return false
    }

    // 清除超时定时器
    if (pending.timer) {
      clearTimeout(pending.timer)
      pending.timer = null
    }

    // 从待处理列表中移除
    this.pendingRequests.delete(requestId)

    // 根据是否错误，resolve 或 reject Promise
    if (isError) {
      const error = responseData instanceof Error
        ? responseData
        : new Error(typeof responseData === 'string' ? responseData : 'RPC 请求失败')
      pending.reject(error)
    }
    else {
      pending.resolve(responseData)
    }

    return true
  }

  /**
   * 处理请求超时
   * 
   * @param requestId - 请求 ID
   */
  private handleTimeout(requestId: string): void {
    const pending = this.pendingRequests.get(requestId)

    if (!pending) {
      return
    }

    // 清除定时器
    if (pending.timer) {
      clearTimeout(pending.timer)
      pending.timer = null
    }

    // 从待处理列表中移除
    this.pendingRequests.delete(requestId)

    // 创建超时错误
    const error = new TimeoutError(
      `RPC 请求超时: ${requestId}`,
      this.config.defaultTimeout
    )

    // Reject Promise
    pending.reject(error)
  }

  /**
   * 取消指定的 RPC 请求
   * 
   * @param requestId - 请求 ID
   * @param reason - 取消原因
   * @returns 是否成功取消
   * 
   * @example
   * ```typescript
   * const { requestId, promise } = rpcManager.request(data)
   * 
   * // 稍后决定取消
   * rpcManager.cancel(requestId, '用户取消操作')
   * ```
   */
  cancel(requestId: string, reason: string = '请求已取消'): boolean {
    const pending = this.pendingRequests.get(requestId)

    if (!pending) {
      return false
    }

    // 清除超时定时器
    if (pending.timer) {
      clearTimeout(pending.timer)
      pending.timer = null
    }

    // 从待处理列表中移除
    this.pendingRequests.delete(requestId)

    // Reject Promise
    pending.reject(new Error(reason))

    return true
  }

  /**
   * 取消所有待处理的 RPC 请求
   * 
   * @param reason - 取消原因
   * 
   * 通常在断开连接时调用
   */
  cancelAll(reason: string = '连接已断开'): void {
    const error = new Error(reason)

    for (const pending of this.pendingRequests.values()) {
      // 清除超时定时器
      if (pending.timer) {
        clearTimeout(pending.timer)
        pending.timer = null
      }

      // Reject Promise
      pending.reject(error)
    }

    this.pendingRequests.clear()
  }

  /**
   * 检查是否是 RPC 响应消息
   * 
   * 根据消息格式判断是否是 RPC 响应
   * 
   * @param data - 消息数据
   * @returns 如果是 RPC 响应返回请求 ID，否则返回 null
   */
  isResponse(data: unknown): string | null {
    if (typeof data !== 'object' || data === null) {
      return null
    }

    const obj = data as Record<string, unknown>

    // 检查是否有响应类型标记
    if (obj.type !== this.config.responseType) {
      return null
    }

    // 提取请求 ID
    const requestId = obj[this.config.idField]
    if (typeof requestId === 'string') {
      return requestId
    }

    return null
  }

  /**
   * 构造 RPC 请求消息
   * 
   * 将请求数据包装为标准的 RPC 请求格式
   * 
   * @param requestId - 请求 ID
   * @param data - 请求数据
   * @returns 完整的请求消息对象
   */
  buildRequestMessage(requestId: string, data: unknown): Record<string, unknown> {
    return {
      type: this.config.requestType,
      [this.config.idField]: requestId,
      data,
      timestamp: Date.now(),
    }
  }

  /**
   * 获取待处理请求列表
   * 
   * @returns 请求 ID 数组
   */
  getPendingRequestIds(): string[] {
    return Array.from(this.pendingRequests.keys())
  }

  /**
   * 获取指定请求的详情
   * 
   * @param requestId - 请求 ID
   * @returns 请求详情或 undefined
   */
  getRequestDetails(requestId: string): {
    id: string
    timestamp: number
    age: number
  } | undefined {
    const pending = this.pendingRequests.get(requestId)

    if (!pending) {
      return undefined
    }

    return {
      id: pending.id,
      timestamp: pending.timestamp,
      age: Date.now() - pending.timestamp,
    }
  }

  /**
   * 获取统计信息
   * 
   * @returns RPC 统计数据
   */
  getStats() {
    const now = Date.now()
    const requests = Array.from(this.pendingRequests.values())

    return {
      /** 待处理请求总数 */
      pendingCount: this.pendingRequests.size,
      /** 最旧请求的年龄（毫秒） */
      oldestRequestAge: requests.length > 0
        ? Math.max(...requests.map(req => now - req.timestamp))
        : 0,
      /** 平均请求年龄（毫秒） */
      averageRequestAge: requests.length > 0
        ? requests.reduce((sum, req) => sum + (now - req.timestamp), 0) / requests.length
        : 0,
    }
  }

  /**
   * 更新配置
   * 
   * @param config - 新的配置项
   */
  updateConfig(config: Partial<RpcConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取当前配置
   */
  getConfig(): Readonly<Required<RpcConfig>> {
    return { ...this.config }
  }

  /**
   * 重置 RPC 管理器
   * 
   * 取消所有待处理请求并清空状态
   */
  reset(): void {
    this.cancelAll('RPC 管理器已重置')
  }

  /**
   * 销毁 RPC 管理器
   * 
   * 释放所有资源
   */
  destroy(): void {
    this.cancelAll('RPC 管理器已销毁')
  }
}


