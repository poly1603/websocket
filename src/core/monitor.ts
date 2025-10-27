/**
 * WebSocket 性能监控器
 * 
 * 提供全面的性能监控和诊断功能
 * 
 * 监控指标：
 * - 消息吞吐量（发送/接收速率）
 * - 网络延迟统计（最小/最大/平均/P95/P99）
 * - 连接质量评分
 * - 错误率统计
 * - 重连统计
 * - 队列状态
 * 
 * 应用场景：
 * - 性能分析和优化
 * - 问题诊断和排查
 * - 服务质量监控
 * - 用户体验评估
 */

/**
 * 监控配置
 */
export interface MonitorConfig {
  /** 是否启用监控 */
  enabled?: boolean
  /** 统计窗口大小（毫秒），默认 60 秒 */
  windowSize?: number
  /** 延迟样本保留数量 */
  maxLatencySamples?: number
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  /** 连接相关指标 */
  connection: {
    /** 连接状态 */
    state: string
    /** 连接持续时间（毫秒） */
    duration: number
    /** 连接建立时间（时间戳） */
    connectedAt?: number
    /** 总重连次数 */
    reconnectCount: number
  }

  /** 消息吞吐量指标 */
  throughput: {
    /** 发送消息总数 */
    totalSent: number
    /** 接收消息总数 */
    totalReceived: number
    /** 发送速率（消息/秒） */
    sendRate: number
    /** 接收速率（消息/秒） */
    receiveRate: number
  }

  /** 网络延迟指标 */
  latency: {
    /** 当前延迟（毫秒） */
    current: number
    /** 平均延迟（毫秒） */
    average: number
    /** 最小延迟（毫秒） */
    min: number
    /** 最大延迟（毫秒） */
    max: number
    /** P95 延迟（毫秒） */
    p95: number
    /** P99 延迟（毫秒） */
    p99: number
  }

  /** 错误统计 */
  errors: {
    /** 错误总数 */
    total: number
    /** 错误率（错误数/消息数） */
    rate: number
    /** 最近的错误列表 */
    recent: Array<{ message: string; timestamp: number }>
  }

  /** 队列状态 */
  queue: {
    /** 当前队列大小 */
    size: number
    /** 队列最大值 */
    maxSize: number
    /** 队列使用率 */
    usage: number
  }

  /** 连接质量评分（0-100） */
  qualityScore: number
}

/**
 * 默认监控配置
 */
const DEFAULT_CONFIG: Required<MonitorConfig> = {
  enabled: true,
  windowSize: 60000,  // 60 秒窗口
  maxLatencySamples: 100,
}

/**
 * 性能监控器类
 * 
 * 收集和统计 WebSocket 连接的各项性能指标
 */
export class PerformanceMonitor {
  /** 监控配置 */
  private config: Required<MonitorConfig>

  /** 消息发送记录（时间戳数组） */
  private sendTimestamps: number[] = []

  /** 消息接收记录（时间戳数组） */
  private receiveTimestamps: number[] = []

  /** 延迟样本数组 */
  private latencySamples: number[] = []

  /** 错误记录 */
  private errorRecords: Array<{ message: string; timestamp: number }> = []

  /** 最大错误记录数 */
  private readonly MAX_ERROR_RECORDS = 50

  /** 总发送消息数 */
  private totalSent: number = 0

  /** 总接收消息数 */
  private totalReceived: number = 0

  /** 总错误数 */
  private totalErrors: number = 0

  /** 连接开始时间 */
  private connectionStartTime: number = 0

  /** 重连次数 */
  private reconnectCount: number = 0

  /** 当前连接状态 */
  private currentState: string = 'disconnected'

  /** 当前队列大小 */
  private queueSize: number = 0

  /** 队列最大容量 */
  private queueMaxSize: number = 1000

  /**
   * 创建性能监控器
   * 
   * @param config - 监控配置选项
   */
  constructor(config?: MonitorConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 是否启用监控
   */
  get isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * 记录消息发送
   * 
   * @param timestamp - 发送时间戳（可选，默认当前时间）
   */
  recordSend(timestamp: number = Date.now()): void {
    if (!this.config.enabled) return

    this.totalSent++
    this.sendTimestamps.push(timestamp)
    this.cleanOldTimestamps(this.sendTimestamps)
  }

  /**
   * 记录消息接收
   * 
   * @param timestamp - 接收时间戳（可选，默认当前时间）
   */
  recordReceive(timestamp: number = Date.now()): void {
    if (!this.config.enabled) return

    this.totalReceived++
    this.receiveTimestamps.push(timestamp)
    this.cleanOldTimestamps(this.receiveTimestamps)
  }

  /**
   * 记录网络延迟
   * 
   * @param latency - 延迟时间（毫秒）
   */
  recordLatency(latency: number): void {
    if (!this.config.enabled) return

    this.latencySamples.push(latency)

    // 限制样本数量
    if (this.latencySamples.length > this.config.maxLatencySamples) {
      this.latencySamples.shift()
    }
  }

  /**
   * 记录错误
   * 
   * @param error - 错误对象或错误消息
   */
  recordError(error: Error | string): void {
    if (!this.config.enabled) return

    this.totalErrors++

    const message = error instanceof Error ? error.message : error
    this.errorRecords.push({
      message,
      timestamp: Date.now(),
    })

    // 限制错误记录数量
    if (this.errorRecords.length > this.MAX_ERROR_RECORDS) {
      this.errorRecords.shift()
    }
  }

  /**
   * 记录连接状态变化
   * 
   * @param newState - 新状态
   */
  recordStateChange(newState: string): void {
    if (!this.config.enabled) return

    const oldState = this.currentState
    this.currentState = newState

    // 记录连接建立时间
    if (newState === 'connected' && oldState !== 'connected') {
      this.connectionStartTime = Date.now()
    }

    // 记录重连
    if (newState === 'connected' && oldState === 'reconnecting') {
      this.reconnectCount++
    }
  }

  /**
   * 更新队列状态
   * 
   * @param size - 当前队列大小
   * @param maxSize - 队列最大容量（可选）
   */
  updateQueueStatus(size: number, maxSize?: number): void {
    if (!this.config.enabled) return

    this.queueSize = size
    if (maxSize !== undefined) {
      this.queueMaxSize = maxSize
    }
  }

  /**
   * 获取性能指标
   * 
   * @returns 完整的性能指标数据
   */
  getMetrics(): PerformanceMetrics {
    const now = Date.now()
    const connectionDuration = this.connectionStartTime > 0
      ? now - this.connectionStartTime
      : 0

    return {
      connection: {
        state: this.currentState,
        duration: connectionDuration,
        connectedAt: this.connectionStartTime || undefined,
        reconnectCount: this.reconnectCount,
      },

      throughput: {
        totalSent: this.totalSent,
        totalReceived: this.totalReceived,
        sendRate: this.calculateRate(this.sendTimestamps),
        receiveRate: this.calculateRate(this.receiveTimestamps),
      },

      latency: this.calculateLatencyStats(),

      errors: {
        total: this.totalErrors,
        rate: this.calculateErrorRate(),
        recent: [...this.errorRecords].slice(-10), // 最近 10 个错误
      },

      queue: {
        size: this.queueSize,
        maxSize: this.queueMaxSize,
        usage: this.queueMaxSize > 0 ? this.queueSize / this.queueMaxSize : 0,
      },

      qualityScore: this.calculateQualityScore(),
    }
  }

  /**
   * 计算消息速率（消息/秒）
   * 
   * @param timestamps - 时间戳数组
   * @returns 速率值
   */
  private calculateRate(timestamps: number[]): number {
    if (timestamps.length === 0) {
      return 0
    }

    const windowMs = this.config.windowSize
    const now = Date.now()
    const recentCount = timestamps.filter(ts => now - ts <= windowMs).length

    return recentCount / (windowMs / 1000) // 转换为每秒
  }

  /**
   * 计算延迟统计数据
   */
  private calculateLatencyStats() {
    if (this.latencySamples.length === 0) {
      return {
        current: 0,
        average: 0,
        min: 0,
        max: 0,
        p95: 0,
        p99: 0,
      }
    }

    const sorted = [...this.latencySamples].sort((a, b) => a - b)
    const sum = sorted.reduce((a, b) => a + b, 0)

    return {
      current: sorted[sorted.length - 1],
      average: Math.round(sum / sorted.length),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: this.calculatePercentile(sorted, 0.95),
      p99: this.calculatePercentile(sorted, 0.99),
    }
  }

  /**
   * 计算百分位数
   * 
   * @param sortedArray - 已排序的数组
   * @param percentile - 百分位（0-1）
   */
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) {
      return 0
    }

    const index = Math.ceil(sortedArray.length * percentile) - 1
    return sortedArray[Math.max(0, index)]
  }

  /**
   * 计算错误率
   * 
   * @returns 错误率（0-1）
   */
  private calculateErrorRate(): number {
    const totalMessages = this.totalSent + this.totalReceived
    if (totalMessages === 0) {
      return 0
    }
    return this.totalErrors / totalMessages
  }

  /**
   * 计算连接质量评分（0-100）
   * 
   * 综合考虑延迟、错误率、重连次数等因素
   */
  private calculateQualityScore(): number {
    let score = 100

    // 延迟影响（最高扣 40 分）
    const latency = this.calculateLatencyStats()
    if (latency.average > 0) {
      if (latency.average < 50) {
        score -= 0 // 延迟 < 50ms，不扣分
      } else if (latency.average < 100) {
        score -= 5 // 延迟 50-100ms，扣 5 分
      } else if (latency.average < 200) {
        score -= 15 // 延迟 100-200ms，扣 15 分
      } else if (latency.average < 500) {
        score -= 25 // 延迟 200-500ms，扣 25 分
      } else {
        score -= 40 // 延迟 > 500ms，扣 40 分
      }
    }

    // 错误率影响（最高扣 30 分）
    const errorRate = this.calculateErrorRate()
    if (errorRate > 0) {
      if (errorRate < 0.01) {
        score -= 5 // 错误率 < 1%，扣 5 分
      } else if (errorRate < 0.05) {
        score -= 15 // 错误率 1-5%，扣 15 分
      } else {
        score -= 30 // 错误率 > 5%，扣 30 分
      }
    }

    // 重连次数影响（最高扣 20 分）
    if (this.reconnectCount > 0) {
      if (this.reconnectCount <= 2) {
        score -= 5 // 重连 1-2 次，扣 5 分
      } else if (this.reconnectCount <= 5) {
        score -= 10 // 重连 3-5 次，扣 10 分
      } else {
        score -= 20 // 重连 > 5 次，扣 20 分
      }
    }

    // 队列使用率影响（最高扣 10 分）
    const queueUsage = this.queueMaxSize > 0 ? this.queueSize / this.queueMaxSize : 0
    if (queueUsage > 0.8) {
      score -= 10 // 队列使用超过 80%，扣 10 分
    } else if (queueUsage > 0.5) {
      score -= 5 // 队列使用 50-80%，扣 5 分
    }

    return Math.max(0, Math.min(100, score))
  }

  /**
   * 清理旧的时间戳记录
   * 
   * 只保留统计窗口内的记录
   * 
   * @param timestamps - 时间戳数组
   */
  private cleanOldTimestamps(timestamps: number[]): void {
    const now = Date.now()
    const windowMs = this.config.windowSize

    // 找到第一个在窗口内的索引
    let firstValidIndex = 0
    for (let i = 0; i < timestamps.length; i++) {
      if (now - timestamps[i] <= windowMs) {
        firstValidIndex = i
        break
      }
    }

    // 移除窗口外的记录
    if (firstValidIndex > 0) {
      timestamps.splice(0, firstValidIndex)
    }
  }

  /**
   * 生成诊断报告
   * 
   * @returns 可读的诊断报告字符串
   */
  generateReport(): string {
    const metrics = this.getMetrics()

    const lines: string[] = []
    lines.push('='.repeat(60))
    lines.push('WebSocket 性能诊断报告')
    lines.push('='.repeat(60))
    lines.push('')

    // 连接信息
    lines.push('【连接信息】')
    lines.push(`  状态: ${metrics.connection.state}`)
    lines.push(`  持续时间: ${(metrics.connection.duration / 1000).toFixed(1)} 秒`)
    lines.push(`  重连次数: ${metrics.connection.reconnectCount}`)
    lines.push('')

    // 吞吐量
    lines.push('【消息吞吐量】')
    lines.push(`  总发送: ${metrics.throughput.totalSent} 条`)
    lines.push(`  总接收: ${metrics.throughput.totalReceived} 条`)
    lines.push(`  发送速率: ${metrics.throughput.sendRate.toFixed(2)} 条/秒`)
    lines.push(`  接收速率: ${metrics.throughput.receiveRate.toFixed(2)} 条/秒`)
    lines.push('')

    // 网络延迟
    lines.push('【网络延迟】')
    lines.push(`  当前: ${metrics.latency.current} ms`)
    lines.push(`  平均: ${metrics.latency.average} ms`)
    lines.push(`  范围: ${metrics.latency.min} - ${metrics.latency.max} ms`)
    lines.push(`  P95: ${metrics.latency.p95} ms`)
    lines.push(`  P99: ${metrics.latency.p99} ms`)
    lines.push('')

    // 错误统计
    lines.push('【错误统计】')
    lines.push(`  总错误数: ${metrics.errors.total}`)
    lines.push(`  错误率: ${(metrics.errors.rate * 100).toFixed(2)}%`)
    if (metrics.errors.recent.length > 0) {
      lines.push(`  最近错误:`)
      metrics.errors.recent.slice(-5).forEach((err, index) => {
        const time = new Date(err.timestamp).toLocaleTimeString()
        lines.push(`    ${index + 1}. [${time}] ${err.message}`)
      })
    }
    lines.push('')

    // 队列状态
    lines.push('【队列状态】')
    lines.push(`  当前大小: ${metrics.queue.size}`)
    lines.push(`  最大容量: ${metrics.queue.maxSize}`)
    lines.push(`  使用率: ${(metrics.queue.usage * 100).toFixed(1)}%`)
    lines.push('')

    // 质量评分
    lines.push('【连接质量】')
    const score = metrics.qualityScore
    const grade = score >= 90 ? '优秀' : score >= 70 ? '良好' : score >= 50 ? '一般' : '较差'
    lines.push(`  评分: ${score.toFixed(0)}/100 (${grade})`)
    lines.push('')

    lines.push('='.repeat(60))

    return lines.join('\n')
  }

  /**
   * 重置所有统计数据
   */
  reset(): void {
    this.sendTimestamps = []
    this.receiveTimestamps = []
    this.latencySamples = []
    this.errorRecords = []
    this.totalSent = 0
    this.totalReceived = 0
    this.totalErrors = 0
    this.connectionStartTime = 0
    this.reconnectCount = 0
    this.queueSize = 0
  }

  /**
   * 更新配置
   * 
   * @param config - 新的配置项
   */
  updateConfig(config: Partial<MonitorConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取当前配置
   */
  getConfig(): Readonly<Required<MonitorConfig>> {
    return { ...this.config }
  }
}


