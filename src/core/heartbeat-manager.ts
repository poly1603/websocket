/**
 * 心跳管理器
 * 
 * 实现 Ping/Pong 心跳检测机制，用于维持连接活性和检测网络状态
 * 
 * 工作原理：
 * 1. 定期发送 ping 消息到服务器
 * 2. 等待服务器返回 pong 消息
 * 3. 如果在超时时间内未收到 pong，认为连接已断开
 * 4. 记录延迟数据，用于网络质量评估
 * 
 * 应用场景：
 * - 检测 "半开" 连接（连接看似正常但实际已断开）
 * - 保持连接活性，防止被代理或防火墙关闭
 * - 评估网络延迟和质量
 */

import type { HeartbeatConfig } from '../types'

/**
 * 默认心跳配置
 */
const DEFAULT_CONFIG: Required<HeartbeatConfig> = {
  enabled: true,
  interval: 30000,          // 30 秒发送一次心跳
  timeout: 5000,            // 5 秒心跳超时
  message: { type: 'ping' },
  pongType: 'pong',
}

/**
 * 心跳管理器类
 * 
 * 负责心跳的发送、pong 的接收、延迟统计和超时检测
 */
export class HeartbeatManager {
  /** 心跳配置 */
  private config: Required<HeartbeatConfig>

  /** ping 发送定时器 */
  private pingInterval: ReturnType<typeof setInterval> | null = null

  /** pong 超时定时器 */
  private pongTimeout: ReturnType<typeof setTimeout> | null = null

  /** 最后一次发送 ping 的时间戳 */
  private lastPingTime: number = 0

  /** 最后一次收到 pong 的时间戳 */
  private lastPongTime: number = 0

  /** 延迟样本数组，用于计算平均延迟 */
  private latencies: number[] = []

  /** 最大延迟样本数，避免数组无限增长 */
  private readonly MAX_LATENCY_SAMPLES = 10

  /**
   * 创建心跳管理器
   * 
   * @param config - 心跳配置选项
   */
  constructor(config?: HeartbeatConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 检查心跳是否已启用
   * 
   * @returns 如果启用返回 true，否则返回 false
   */
  get isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * 检查心跳是否正在运行
   * 
   * @returns 如果心跳定时器正在运行返回 true，否则返回 false
   */
  get isRunning(): boolean {
    return this.pingInterval !== null
  }

  /**
   * 获取最后一次发送 ping 的时间
   * 
   * @returns 时间戳（毫秒），如果从未发送过返回 0
   */
  get lastPing(): number {
    return this.lastPingTime
  }

  /**
   * 获取最后一次收到 pong 的时间
   * 
   * @returns 时间戳（毫秒），如果从未收到过返回 0
   */
  get lastPong(): number {
    return this.lastPongTime
  }

  /**
   * 获取平均网络延迟
   * 
   * 基于最近的延迟样本计算平均值（最多保留最近 10 个样本）
   * 延迟 = pong 收到时间 - ping 发送时间
   * 
   * @returns 平均延迟（毫秒），如果没有样本返回 0
   */
  get averageLatency(): number {
    if (this.latencies.length === 0) {
      return 0
    }
    const sum = this.latencies.reduce((a, b) => a + b, 0)
    return Math.round(sum / this.latencies.length)
  }

  /**
   * 启动心跳机制
   * 
   * 设置定时器定期发送 ping 消息，并在超时时触发回调
   * 会立即发送第一个 ping，然后按配置的间隔发送后续 ping
   * 
   * @param sendFn - 发送心跳消息的函数，接收心跳消息对象作为参数
   * @param onTimeout - 心跳超时回调，当在 timeout 时间内未收到 pong 时调用
   * @param onPing - 发送 ping 时的回调（可选），用于通知外部 ping 已发送
   * 
   * @example
   * ```typescript
   * heartbeatManager.start(
   *   (message) => websocket.send(message),
   *   () => {
   *     console.log('心跳超时，连接可能已断开')
   *     websocket.close()
   *   },
   *   (message) => console.log('发送心跳:', message)
   * )
   * ```
   */
  start(
    sendFn: (message: unknown) => void,
    onTimeout: () => void,
    onPing?: (message: unknown) => void,
  ): void {
    // 如果未启用或已在运行，则不执行
    if (!this.config.enabled || this.isRunning) {
      return
    }

    // 设置定期发送 ping 的定时器
    this.pingInterval = setInterval(() => {
      this.sendPing(sendFn, onTimeout, onPing)
    }, this.config.interval)

    // 立即发送第一个 ping，不等待第一个间隔
    this.sendPing(sendFn, onTimeout, onPing)
  }

  /**
   * 发送 ping 消息（内部方法）
   * 
   * 记录发送时间，执行发送，并设置 pong 超时定时器
   */
  private sendPing(
    sendFn: (message: unknown) => void,
    onTimeout: () => void,
    onPing?: (message: unknown) => void,
  ): void {
    // 记录 ping 发送时间
    this.lastPingTime = Date.now()

    try {
      // 发送心跳消息
      sendFn(this.config.message)
      // 通知外部
      onPing?.(this.config.message)
    }
    catch (error) {
      console.error('[HeartbeatManager] 发送心跳失败:', error)
      return
    }

    // 清除之前的 pong 超时定时器
    this.clearPongTimeout()

    // 设置新的 pong 超时定时器
    // 如果在 timeout 时间内未收到 pong，则认为连接已断开
    this.pongTimeout = setTimeout(() => {
      console.warn('[HeartbeatManager] 心跳超时：未收到 pong 响应')
      onTimeout()
    }, this.config.timeout)
  }

  /**
   * 处理收到的 pong 响应
   * 
   * 清除超时定时器，计算网络延迟并更新延迟样本
   * 
   * @param onPong - pong 响应回调（可选），传入计算出的延迟时间
   * 
   * @example
   * ```typescript
   * // 在收到 pong 消息时调用
   * heartbeatManager.handlePong((latency) => {
   *   console.log(`网络延迟：${latency}ms`)
   *   if (latency > 500) {
   *     console.warn('网络延迟较高')
   *   }
   * })
   * ```
   */
  handlePong(onPong?: (latency: number) => void): void {
    this.lastPongTime = Date.now()

    // 清除 pong 超时定时器，表示已收到响应
    this.clearPongTimeout()

    // 计算网络延迟（往返时间）
    if (this.lastPingTime > 0) {
      const latency = this.lastPongTime - this.lastPingTime
      this.latencies.push(latency)

      // 保持最近的 N 个样本，使用滑动窗口
      // 避免数组无限增长
      if (this.latencies.length > this.MAX_LATENCY_SAMPLES) {
        this.latencies.shift() // 移除最旧的样本
      }

      // 通知外部延迟信息
      onPong?.(latency)
    }
  }

  /**
   * 停止心跳机制
   * 
   * 清除所有定时器，停止发送 ping 和超时检测
   * 但不清除延迟统计数据和时间戳
   */
  stop(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
    this.clearPongTimeout()
  }

  /**
   * 清除 pong 超时定时器（内部方法）
   * 
   * 用于在收到 pong 响应时取消超时检测
   */
  private clearPongTimeout(): void {
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout)
      this.pongTimeout = null
    }
  }

  /**
   * 重置心跳状态
   * 
   * 停止心跳并清除所有状态数据，包括时间戳和延迟样本
   * 通常在连接断开或重新建立时调用
   */
  reset(): void {
    this.stop()
    this.lastPingTime = 0
    this.lastPongTime = 0
    this.latencies = []
  }

  /**
   * 更新心跳配置
   * 
   * 动态修改心跳参数
   * 如果心跳正在运行，会先停止，应用新配置后需要手动重新启动
   * 
   * @param config - 新的配置项（部分更新）
   * 
   * @example
   * ```typescript
   * // 调整心跳间隔
   * heartbeatManager.updateConfig({ interval: 60000, timeout: 10000 })
   * // 需要重新调用 start() 使新配置生效
   * ```
   */
  updateConfig(config: Partial<HeartbeatConfig>): void {
    const wasRunning = this.isRunning
    if (wasRunning) {
      this.stop()
    }

    this.config = { ...this.config, ...config }

    // 注意：如果之前在运行，需要外部重新调用 start() 以使用新配置
    if (wasRunning) {
      console.warn('[HeartbeatManager] 心跳配置已更新，需要重新调用 start() 方法')
    }
  }

  /**
   * 获取当前心跳配置
   * 
   * @returns 当前的心跳配置（只读副本）
   */
  getConfig(): Readonly<Required<HeartbeatConfig>> {
    return { ...this.config }
  }

  /**
   * 获取心跳统计信息
   * 
   * 返回心跳运行状态、时间戳和延迟统计
   * 
   * @returns 心跳统计对象
   * 
   * @example
   * ```typescript
   * const stats = heartbeatManager.getStats()
   * console.log('心跳统计:')
   * console.log('  运行状态:', stats.isRunning)
   * console.log('  平均延迟:', stats.averageLatency, 'ms')
   * console.log('  延迟样本:', stats.latencySamples)
   * ```
   */
  getStats() {
    return {
      /** 心跳是否正在运行 */
      isRunning: this.isRunning,
      /** 最后一次 ping 时间戳 */
      lastPing: this.lastPingTime,
      /** 最后一次 pong 时间戳 */
      lastPong: this.lastPongTime,
      /** 平均延迟（毫秒） */
      averageLatency: this.averageLatency,
      /** 延迟样本数组（副本） */
      latencySamples: [...this.latencies],
    }
  }
}


