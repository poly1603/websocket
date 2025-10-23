/**
 * 事件发射器
 * 
 * 提供类型安全的事件发布订阅功能
 */

import type { EventListener, WebSocketEventType } from '../types'

/**
 * 事件发射器类
 */
export class EventEmitter {
  private listeners: Map<string, Set<EventListener>>

  constructor() {
    this.listeners = new Map()
  }

  /**
   * 注册事件监听器
   * 
   * @param event - 事件名称
   * @param listener - 事件处理函数
   */
  on<T = any>(event: WebSocketEventType | string, listener: EventListener<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener)
  }

  /**
   * 注册一次性事件监听器
   * 
   * @param event - 事件名称
   * @param listener - 事件处理函数
   */
  once<T = any>(event: WebSocketEventType | string, listener: EventListener<T>): void {
    const onceWrapper: EventListener<T> = (data) => {
      listener(data)
      this.off(event, onceWrapper)
    }
    this.on(event, onceWrapper)
  }

  /**
   * 移除事件监听器
   * 
   * @param event - 事件名称
   * @param listener - 事件处理函数（可选）
   */
  off(event: WebSocketEventType | string, listener?: EventListener): void {
    if (!listener) {
      // 移除该事件的所有监听器
      this.listeners.delete(event)
      return
    }

    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.delete(listener)
      if (eventListeners.size === 0) {
        this.listeners.delete(event)
      }
    }
  }

  /**
   * 触发事件
   * 
   * @param event - 事件名称
   * @param data - 事件数据
   */
  emit<T = any>(event: WebSocketEventType | string, data?: T): void {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      // 使用数组副本避免迭代时修改集合
      const listenersArray = Array.from(eventListeners)
      for (const listener of listenersArray) {
        try {
          listener(data)
        }
        catch (error) {
          console.error(`Error in event listener for "${event}":`, error)
        }
      }
    }
  }

  /**
   * 移除所有事件监听器
   */
  removeAllListeners(): void {
    this.listeners.clear()
  }

  /**
   * 获取指定事件的监听器数量
   * 
   * @param event - 事件名称
   * @returns 监听器数量
   */
  listenerCount(event: WebSocketEventType | string): number {
    const eventListeners = this.listeners.get(event)
    return eventListeners ? eventListeners.size : 0
  }

  /**
   * 获取所有事件名称
   * 
   * @returns 事件名称数组
   */
  eventNames(): string[] {
    return Array.from(this.listeners.keys())
  }

  /**
   * 检查是否有监听器
   * 
   * @param event - 事件名称（可选）
   * @returns 是否有监听器
   */
  hasListeners(event?: WebSocketEventType | string): boolean {
    if (event) {
      return this.listenerCount(event) > 0
    }
    return this.listeners.size > 0
  }
}


