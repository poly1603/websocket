/**
 * 连接管理器
 * 
 * 管理 WebSocket 连接状态和生命周期
 */

import type { ConnectionState, ConnectionMetrics } from '../types'
import { EventEmitter } from './event-emitter'

/**
 * 连接管理器类
 */
export class ConnectionManager {
  private state: ConnectionState = 'disconnected'
  private metrics: ConnectionMetrics
  private eventEmitter: EventEmitter
  private connectionStartTime: number = 0

  constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter
    this.metrics = {
      messagesSent: 0,
      messagesReceived: 0,
      reconnectCount: 0,
      currentReconnectAttempt: 0,
      averageLatency: 0,
      queuedMessages: 0,
    }
  }

  /**
   * 获取当前连接状态
   */
  getState(): ConnectionState {
    return this.state
  }

  /**
   * 设置连接状态
   * 
   * @param newState - 新状态
   */
  setState(newState: ConnectionState): void {
    if (this.state === newState) {
      return
    }

    const oldState = this.state
    this.state = newState

    // 触发状态变化事件
    this.eventEmitter.emit('state-change', {
      oldState,
      newState,
      timestamp: Date.now(),
    })

    // 根据状态更新指标
    if (newState === 'connected') {
      this.connectionStartTime = Date.now()
      this.metrics.connectedAt = this.connectionStartTime
      this.metrics.currentReconnectAttempt = 0
    }
    else if (newState === 'disconnected') {
      this.connectionStartTime = 0
      this.metrics.connectedAt = undefined
    }
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.state === 'connected'
  }

  /**
   * 检查是否正在连接
   */
  isConnecting(): boolean {
    return this.state === 'connecting' || this.state === 'reconnecting'
  }

  /**
   * 检查是否已断开
   */
  isDisconnected(): boolean {
    return this.state === 'disconnected'
  }

  /**
   * 增加发送消息计数
   */
  incrementMessagesSent(): void {
    this.metrics.messagesSent++
  }

  /**
   * 增加接收消息计数
   */
  incrementMessagesReceived(): void {
    this.metrics.messagesReceived++
  }

  /**
   * 增加重连计数
   */
  incrementReconnectCount(): void {
    this.metrics.reconnectCount++
  }

  /**
   * 设置当前重连尝试次数
   * 
   * @param attempt - 尝试次数
   */
  setCurrentReconnectAttempt(attempt: number): void {
    this.metrics.currentReconnectAttempt = attempt
  }

  /**
   * 更新平均延迟
   * 
   * @param latency - 延迟时间（毫秒）
   */
  updateAverageLatency(latency: number): void {
    // 使用移动平均
    const alpha = 0.2 // 平滑因子
    if (this.metrics.averageLatency === 0) {
      this.metrics.averageLatency = latency
    }
    else {
      this.metrics.averageLatency = alpha * latency + (1 - alpha) * this.metrics.averageLatency
    }
  }

  /**
   * 更新队列消息数
   * 
   * @param count - 队列中的消息数
   */
  updateQueuedMessages(count: number): void {
    this.metrics.queuedMessages = count
  }

  /**
   * 设置最后心跳时间
   * 
   * @param timestamp - 时间戳
   */
  setLastHeartbeat(timestamp: number): void {
    this.metrics.lastHeartbeat = timestamp
  }

  /**
   * 获取连接指标
   */
  getMetrics(): Readonly<ConnectionMetrics> {
    return { ...this.metrics }
  }

  /**
   * 获取连接持续时间（毫秒）
   */
  getConnectionDuration(): number {
    if (!this.isConnected() || this.connectionStartTime === 0) {
      return 0
    }
    return Date.now() - this.connectionStartTime
  }

  /**
   * 重置所有指标
   */
  resetMetrics(): void {
    this.metrics = {
      messagesSent: 0,
      messagesReceived: 0,
      reconnectCount: 0,
      currentReconnectAttempt: 0,
      averageLatency: 0,
      queuedMessages: 0,
    }
  }

  /**
   * 重置连接管理器
   */
  reset(): void {
    this.state = 'disconnected'
    this.connectionStartTime = 0
    this.resetMetrics()
  }
}


