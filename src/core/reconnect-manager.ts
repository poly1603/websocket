/**
 * 重连管理器
 * 
 * 实现基于指数退避算法的智能自动重连机制
 * 
 * 特性：
 * - 指数退避：每次重连延迟时间逐渐增加
 * - 随机抖动：避免多个客户端同时重连（雷鸣群效应）
 * - 最大次数限制：防止无限重连
 * - 延迟上限：确保重连间隔不会过长
 * 
 * @example
 * 重连延迟计算：
 * - 第1次：1秒 + 随机抖动
 * - 第2次：2秒 + 随机抖动
 * - 第3次：4秒 + 随机抖动
 * - 第4次：8秒 + 随机抖动
 * - 以此类推，但不超过 maxDelay
 */

import type { ReconnectConfig } from '../types'

/**
 * 默认重连配置
 */
const DEFAULT_CONFIG: Required<ReconnectConfig> = {
  enabled: true,
  delay: 1000,              // 初始延迟 1 秒
  maxDelay: 30000,          // 最大延迟 30 秒
  maxAttempts: 10,          // 最多重连 10 次
  factor: 2,                // 指数因子（每次乘以2）
  jitter: 0.1,              // 10% 随机抖动
}

/**
 * 重连管理器类
 * 
 * 负责管理 WebSocket 的自动重连逻辑，使用指数退避算法
 * 避免网络波动时的频繁重连，减少服务器压力
 */
export class ReconnectManager {
  /** 重连配置 */
  private config: Required<ReconnectConfig>

  /** 当前重连尝试次数 */
  private attempts: number = 0

  /** 重连定时器 */
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  /** 重连开始时间戳（毫秒） */
  private reconnectStartTime: number = 0

  /**
   * 创建重连管理器
   * 
   * @param config - 重连配置选项
   */
  constructor(config?: ReconnectConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 获取当前重连尝试次数
   * 
   * @returns 当前已尝试的重连次数
   */
  get currentAttempt(): number {
    return this.attempts
  }

  /**
   * 获取最大重连次数
   * 
   * @returns 允许的最大重连次数，0 表示无限制
   */
  get maxAttempts(): number {
    return this.config.maxAttempts
  }

  /**
   * 检查是否已达到最大重连次数
   * 
   * @returns 如果已达到或超过最大次数返回 true，否则返回 false
   */
  get isMaxAttemptsReached(): boolean {
    return this.config.maxAttempts > 0 && this.attempts >= this.config.maxAttempts
  }

  /**
   * 检查是否启用了自动重连
   * 
   * @returns 如果启用返回 true，否则返回 false
   */
  get isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * 计算下次重连的延迟时间
   * 
   * 使用指数退避算法并添加随机抖动：
   * 1. 指数退避：delay × factor^attempts
   * 2. 限制上限：不超过 maxDelay
   * 3. 随机抖动：± (delay × jitter)，避免雷鸣群效应
   * 
   * **雷鸣群效应**：多个客户端同时断开后，如果使用固定延迟重连，
   * 会在同一时刻同时发起重连，对服务器造成瞬间压力。
   * 随机抖动可以将重连请求分散到一个时间窗口内。
   * 
   * @returns 延迟时间（毫秒）
   * 
   * @example
   * ```typescript
   * // 假设 delay=1000, factor=2, jitter=0.1
   * // 第1次：1000 * 2^0 = 1000ms ± 100ms = 900-1100ms
   * // 第2次：1000 * 2^1 = 2000ms ± 200ms = 1800-2200ms
   * // 第3次：1000 * 2^2 = 4000ms ± 400ms = 3600-4400ms
   * ```
   */
  getNextDelay(): number {
    // 1. 指数退避计算
    const exponentialDelay = this.config.delay * Math.pow(this.config.factor, this.attempts)

    // 2. 限制在最大延迟内，避免延迟过长
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelay)

    // 3. 添加随机抖动
    // jitterRange 是抖动的范围，例如 10% 的抖动范围
    const jitterRange = cappedDelay * this.config.jitter
    // 生成 -jitterRange 到 +jitterRange 之间的随机值
    const jitter = (Math.random() - 0.5) * 2 * jitterRange

    // 4. 确保结果不为负数
    return Math.max(0, cappedDelay + jitter)
  }

  /**
   * 执行重连操作
   * 
   * 递归地尝试重新建立连接，每次失败后会自动计算下次重连的延迟时间
   * 如果达到最大重连次数，则停止重连并通知失败
   * 
   * @param connectFn - 连接函数，执行实际的连接操作
   * @param onReconnecting - 重连开始时的回调，传入当前尝试次数和延迟时间
   * @param onReconnected - 重连成功时的回调，传入总尝试次数和耗时
   * @param onFailed - 重连失败时的回调（达到最大次数），传入尝试次数和失败原因
   * @returns Promise<boolean> 返回重连是否最终成功
   * 
   * @example
   * ```typescript
   * const success = await reconnectManager.reconnect(
   *   () => client.connect(),
   *   (attempt, delay) => console.log(`第 ${attempt} 次重连，延迟 ${delay}ms`),
   *   (attempts, duration) => console.log(`重连成功！尝试了 ${attempts} 次，耗时 ${duration}ms`),
   *   (attempts, reason) => console.error(`重连失败：${reason}`)
   * )
   * ```
   */
  async reconnect(
    connectFn: () => Promise<void>,
    onReconnecting?: (attempt: number, delay: number) => void,
    onReconnected?: (attempts: number, duration: number) => void,
    onFailed?: (attempts: number, reason: string) => void,
  ): Promise<boolean> {
    // 检查是否启用重连
    if (!this.config.enabled) {
      return false
    }

    // 检查是否已达到最大重连次数
    if (this.isMaxAttemptsReached) {
      onFailed?.(this.attempts, '已达到最大重连次数')
      return false
    }

    // 增加重连尝试计数
    this.attempts++
    const delay = this.getNextDelay()
    this.reconnectStartTime = Date.now()

    // 通知开始重连
    onReconnecting?.(this.attempts, delay)

    return new Promise((resolve) => {
      // 延迟后执行重连
      this.reconnectTimer = setTimeout(async () => {
        try {
          // 执行连接
          await connectFn()

          // 连接成功
          const duration = Date.now() - this.reconnectStartTime
          onReconnected?.(this.attempts, duration)
          this.reset() // 重置重连状态
          resolve(true)
        }
        catch (error) {
          // 连接失败，如果未达到最大尝试次数，继续重连
          if (!this.isMaxAttemptsReached) {
            const success = await this.reconnect(connectFn, onReconnecting, onReconnected, onFailed)
            resolve(success)
          }
          else {
            // 达到最大次数，重连失败
            const reason = error instanceof Error ? error.message : '未知错误'
            onFailed?.(this.attempts, reason)
            resolve(false)
          }
        }
      }, delay)
    })
  }

  /**
   * 取消正在进行的重连
   * 
   * 清除重连定时器，停止重连流程
   * 注意：这不会重置重连计数器，如需重置请调用 reset()
   */
  cancel(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  /**
   * 重置重连状态
   * 
   * 取消当前重连并将重连计数器重置为 0
   * 通常在连接成功或手动断开时调用
   */
  reset(): void {
    this.cancel()
    this.attempts = 0
    this.reconnectStartTime = 0
  }

  /**
   * 更新重连配置
   * 
   * 动态修改重连参数，新配置会立即生效
   * 注意：不会影响当前正在进行的重连尝试
   * 
   * @param config - 新的配置项（部分更新）
   * 
   * @example
   * ```typescript
   * // 延长重连间隔
   * reconnectManager.updateConfig({ delay: 2000, maxDelay: 60000 })
   * ```
   */
  updateConfig(config: Partial<ReconnectConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取当前重连配置
   * 
   * @returns 当前的重连配置（只读副本）
   */
  getConfig(): Readonly<Required<ReconnectConfig>> {
    return { ...this.config }
  }
}


