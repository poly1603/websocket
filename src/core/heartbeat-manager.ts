/**
 * 心跳管理器
 * 
 * 实现 Ping/Pong 心跳检测机制
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
 */
export class HeartbeatManager {
  private config: Required<HeartbeatConfig>
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private pongTimeout: ReturnType<typeof setTimeout> | null = null
  private lastPingTime: number = 0
  private lastPongTime: number = 0
  private latencies: number[] = []
  private readonly MAX_LATENCY_SAMPLES = 10

  constructor(config?: HeartbeatConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 是否启用心跳
   */
  get isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * 是否正在运行
   */
  get isRunning(): boolean {
    return this.pingInterval !== null
  }

  /**
   * 获取最后一次 ping 时间
   */
  get lastPing(): number {
    return this.lastPingTime
  }

  /**
   * 获取最后一次 pong 时间
   */
  get lastPong(): number {
    return this.lastPongTime
  }

  /**
   * 获取平均延迟（毫秒）
   */
  get averageLatency(): number {
    if (this.latencies.length === 0) {
      return 0
    }
    const sum = this.latencies.reduce((a, b) => a + b, 0)
    return Math.round(sum / this.latencies.length)
  }

  /**
   * 启动心跳
   * 
   * @param sendFn - 发送心跳消息的函数
   * @param onTimeout - 心跳超时回调
   * @param onPing - 发送 ping 回调
   */
  start(
    sendFn: (message: any) => void,
    onTimeout: () => void,
    onPing?: (message: any) => void,
  ): void {
    if (!this.config.enabled || this.isRunning) {
      return
    }

    // 定期发送 ping
    this.pingInterval = setInterval(() => {
      this.sendPing(sendFn, onTimeout, onPing)
    }, this.config.interval)

    // 立即发送第一个 ping
    this.sendPing(sendFn, onTimeout, onPing)
  }

  /**
   * 发送 ping 消息
   */
  private sendPing(
    sendFn: (message: any) => void,
    onTimeout: () => void,
    onPing?: (message: any) => void,
  ): void {
    this.lastPingTime = Date.now()

    try {
      sendFn(this.config.message)
      onPing?.(this.config.message)
    }
    catch (error) {
      console.error('Failed to send ping:', error)
      return
    }

    // 设置 pong 超时
    this.clearPongTimeout()
    this.pongTimeout = setTimeout(() => {
      console.warn('Heartbeat timeout: no pong received')
      onTimeout()
    }, this.config.timeout)
  }

  /**
   * 处理 pong 响应
   * 
   * @param onPong - pong 响应回调
   */
  handlePong(onPong?: (latency: number) => void): void {
    this.lastPongTime = Date.now()

    // 清除超时定时器
    this.clearPongTimeout()

    // 计算延迟
    if (this.lastPingTime > 0) {
      const latency = this.lastPongTime - this.lastPingTime
      this.latencies.push(latency)

      // 保持最近的样本数
      if (this.latencies.length > this.MAX_LATENCY_SAMPLES) {
        this.latencies.shift()
      }

      onPong?.(latency)
    }
  }

  /**
   * 停止心跳
   */
  stop(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
    this.clearPongTimeout()
  }

  /**
   * 清除 pong 超时定时器
   */
  private clearPongTimeout(): void {
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout)
      this.pongTimeout = null
    }
  }

  /**
   * 重置心跳状态
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
   * @param config - 新的配置
   */
  updateConfig(config: Partial<HeartbeatConfig>): void {
    const wasRunning = this.isRunning
    if (wasRunning) {
      this.stop()
    }

    this.config = { ...this.config, ...config }

    // 如果之前在运行，使用新配置重启
    if (wasRunning) {
      // 需要外部重新调用 start
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): Readonly<Required<HeartbeatConfig>> {
    return { ...this.config }
  }

  /**
   * 获取心跳统计信息
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      lastPing: this.lastPingTime,
      lastPong: this.lastPongTime,
      averageLatency: this.averageLatency,
      latencySamples: [...this.latencies],
    }
  }
}


