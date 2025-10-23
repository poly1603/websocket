/**
 * 重连管理器
 * 
 * 实现指数退避算法的自动重连机制
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
  factor: 2,                // 指数因子
  jitter: 0.1,              // 10% 随机抖动
}

/**
 * 重连管理器类
 */
export class ReconnectManager {
  private config: Required<ReconnectConfig>
  private attempts: number = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectStartTime: number = 0

  constructor(config?: ReconnectConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 获取当前重连尝试次数
   */
  get currentAttempt(): number {
    return this.attempts
  }

  /**
   * 获取最大重连次数
   */
  get maxAttempts(): number {
    return this.config.maxAttempts
  }

  /**
   * 是否已达到最大重连次数
   */
  get isMaxAttemptsReached(): boolean {
    return this.config.maxAttempts > 0 && this.attempts >= this.config.maxAttempts
  }

  /**
   * 是否启用重连
   */
  get isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * 计算下次重连延迟时间（指数退避 + 随机抖动）
   * 
   * @returns 延迟时间（毫秒）
   */
  getNextDelay(): number {
    // 指数退避: delay * factor^attempts
    const exponentialDelay = this.config.delay * Math.pow(this.config.factor, this.attempts)

    // 限制在最大延迟内
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelay)

    // 添加随机抖动，避免雷鸣群效应
    const jitterRange = cappedDelay * this.config.jitter
    const jitter = (Math.random() - 0.5) * 2 * jitterRange

    return Math.max(0, cappedDelay + jitter)
  }

  /**
   * 执行重连
   * 
   * @param connectFn - 连接函数
   * @param onReconnecting - 重连开始回调
   * @param onReconnected - 重连成功回调
   * @param onFailed - 重连失败回调
   * @returns Promise<boolean> 是否重连成功
   */
  async reconnect(
    connectFn: () => Promise<void>,
    onReconnecting?: (attempt: number, delay: number) => void,
    onReconnected?: (attempts: number, duration: number) => void,
    onFailed?: (attempts: number, reason: string) => void,
  ): Promise<boolean> {
    if (!this.config.enabled) {
      return false
    }

    if (this.isMaxAttemptsReached) {
      onFailed?.(this.attempts, 'Maximum reconnect attempts reached')
      return false
    }

    this.attempts++
    const delay = this.getNextDelay()
    this.reconnectStartTime = Date.now()

    onReconnecting?.(this.attempts, delay)

    return new Promise((resolve) => {
      this.reconnectTimer = setTimeout(async () => {
        try {
          await connectFn()
          const duration = Date.now() - this.reconnectStartTime
          onReconnected?.(this.attempts, duration)
          this.reset()
          resolve(true)
        }
        catch (error) {
          // 如果未达到最大尝试次数，继续重连
          if (!this.isMaxAttemptsReached) {
            const success = await this.reconnect(connectFn, onReconnecting, onReconnected, onFailed)
            resolve(success)
          }
          else {
            onFailed?.(this.attempts, error instanceof Error ? error.message : 'Unknown error')
            resolve(false)
          }
        }
      }, delay)
    })
  }

  /**
   * 取消重连
   */
  cancel(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  /**
   * 重置重连状态
   */
  reset(): void {
    this.cancel()
    this.attempts = 0
    this.reconnectStartTime = 0
  }

  /**
   * 更新重连配置
   * 
   * @param config - 新的配置
   */
  updateConfig(config: Partial<ReconnectConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取当前配置
   */
  getConfig(): Readonly<Required<ReconnectConfig>> {
    return { ...this.config }
  }
}


