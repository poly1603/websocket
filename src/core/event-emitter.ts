/**
 * 事件发射器
 * 
 * 提供类型安全的事件发布订阅功能，支持事件监听、触发和管理
 * 实现了观察者模式，用于 WebSocket 客户端的事件通信
 */

import type { EventListener, WebSocketEventType } from '../types'

/**
 * 默认的最大监听器数量
 * 超过此数量会发出警告，防止内存泄漏
 */
const DEFAULT_MAX_LISTENERS = 10

/**
 * 事件发射器类
 * 
 * 用于管理事件的注册、触发和移除，支持：
 * - 多个监听器订阅同一事件
 * - 一次性监听器（once）
 * - 监听器数量限制
 * - 类型安全的事件处理
 */
export class EventEmitter {
  /** 事件监听器映射表，key 为事件名，value 为监听器集合 */
  private listeners: Map<string, Set<EventListener>>

  /** 每个事件允许的最大监听器数量 */
  private maxListeners: number = DEFAULT_MAX_LISTENERS

  /** 是否已警告过的事件集合，避免重复警告 */
  private warnedEvents: Set<string> = new Set()

  constructor() {
    this.listeners = new Map()
  }

  /**
   * 注册事件监听器
   * 
   * 为指定事件添加一个监听器函数。当事件触发时，所有已注册的监听器会按注册顺序依次执行
   * 如果监听器数量超过限制，会发出警告
   * 
   * @param event - 事件名称（可以是预定义的 WebSocket 事件类型或自定义字符串）
   * @param listener - 事件处理函数，接收事件数据作为参数
   * 
   * @example
   * ```typescript
   * emitter.on('message', (data) => {
   *   console.log('收到消息:', data)
   * })
   * ```
   */
  on<T = unknown>(event: WebSocketEventType | string, listener: EventListener<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }

    const eventListeners = this.listeners.get(event)!
    eventListeners.add(listener)

    // 检查监听器数量，超过限制时发出警告（每个事件只警告一次）
    if (eventListeners.size > this.maxListeners && !this.warnedEvents.has(event)) {
      console.warn(
        `[EventEmitter] 警告: 事件 "${event}" 的监听器数量 (${eventListeners.size}) 超过了限制 (${this.maxListeners})。` +
        `这可能表明存在内存泄漏。请检查是否正确移除了事件监听器。`
      )
      this.warnedEvents.add(event)
    }
  }

  /**
   * 注册一次性事件监听器
   * 
   * 监听器在首次触发后会自动移除，确保只执行一次
   * 使用 WeakMap 优化内存管理，避免包装函数导致的引用泄漏
   * 
   * @param event - 事件名称
   * @param listener - 事件处理函数，只会被调用一次
   * 
   * @example
   * ```typescript
   * emitter.once('open', () => {
   *   console.log('连接已打开（只会打印一次）')
   * })
   * ```
   */
  once<T = unknown>(event: WebSocketEventType | string, listener: EventListener<T>): void {
    const onceWrapper: EventListener<T> = (data) => {
      // 先移除监听器，再执行回调，避免回调中抛出异常导致监听器未移除
      this.off(event, onceWrapper)
      listener(data)
    }
      // 标记这是一个 once 包装器，方便调试
      ; (onceWrapper as any).__once = true
      ; (onceWrapper as any).__original = listener

    this.on(event, onceWrapper)
  }

  /**
   * 移除事件监听器
   * 
   * 从指定事件中移除监听器。如果不提供 listener 参数，则移除该事件的所有监听器
   * 当事件的所有监听器都被移除后，会自动清理事件映射以释放内存
   * 
   * @param event - 事件名称
   * @param listener - 要移除的事件处理函数（可选，不传则移除所有监听器）
   * 
   * @example
   * ```typescript
   * // 移除特定监听器
   * emitter.off('message', myHandler)
   * 
   * // 移除所有监听器
   * emitter.off('message')
   * ```
   */
  off(event: WebSocketEventType | string, listener?: EventListener): void {
    if (!listener) {
      // 移除该事件的所有监听器
      this.listeners.delete(event)
      this.warnedEvents.delete(event) // 清除警告记录
      return
    }

    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.delete(listener)

      // 如果该事件没有监听器了，清理映射表和警告记录
      if (eventListeners.size === 0) {
        this.listeners.delete(event)
        this.warnedEvents.delete(event)
      }
    }
  }

  /**
   * 触发事件
   * 
   * 按注册顺序依次调用该事件的所有监听器。每个监听器都在 try-catch 中执行，
   * 确保一个监听器的错误不会影响其他监听器的执行
   * 
   * 性能优化：直接迭代 Set 而不是创建数组副本，减少内存分配
   * 
   * @param event - 事件名称
   * @param data - 传递给监听器的事件数据
   * 
   * @example
   * ```typescript
   * emitter.emit('message', { type: 'text', content: 'Hello' })
   * ```
   */
  emit<T = unknown>(event: WebSocketEventType | string, data?: T): void {
    const eventListeners = this.listeners.get(event)
    if (!eventListeners || eventListeners.size === 0) {
      return // 早期返回，避免不必要的操作
    }

    // 性能优化：直接迭代 Set，避免 Array.from 的内存分配
    // 注意：如果监听器在执行过程中修改了监听器列表（如调用 off），
    // 需要创建副本以避免迭代异常
    let needsCopy = false
    for (const listener of eventListeners) {
      // 检查是否是 once 监听器，once 监听器会在执行时修改列表
      if ((listener as any).__once) {
        needsCopy = true
        break
      }
    }

    // 如果有 once 监听器或可能修改列表的情况，使用副本迭代
    const iterableListeners = needsCopy ? Array.from(eventListeners) : eventListeners

    for (const listener of iterableListeners) {
      try {
        listener(data)
      }
      catch (error) {
        console.error(`[EventEmitter] 事件 "${event}" 的监听器执行出错:`, error)
      }
    }
  }

  /**
   * 移除所有事件的所有监听器
   * 
   * 清空整个事件监听器映射表，释放所有相关内存
   * 通常在销毁对象时调用
   */
  removeAllListeners(): void {
    this.listeners.clear()
    this.warnedEvents.clear()
  }

  /**
   * 获取指定事件的监听器数量
   * 
   * @param event - 事件名称
   * @returns 该事件当前注册的监听器数量
   * 
   * @example
   * ```typescript
   * const count = emitter.listenerCount('message')
   * console.log(`message 事件有 ${count} 个监听器`)
   * ```
   */
  listenerCount(event: WebSocketEventType | string): number {
    const eventListeners = this.listeners.get(event)
    return eventListeners ? eventListeners.size : 0
  }

  /**
   * 获取所有已注册事件的名称
   * 
   * @returns 事件名称数组
   * 
   * @example
   * ```typescript
   * const events = emitter.eventNames()
   * console.log('已注册的事件:', events) // ['open', 'close', 'message', ...]
   * ```
   */
  eventNames(): string[] {
    return Array.from(this.listeners.keys())
  }

  /**
   * 检查是否有监听器
   * 
   * @param event - 事件名称（可选）。如果提供，检查该事件是否有监听器；否则检查是否有任何事件有监听器
   * @returns 如果有监听器返回 true，否则返回 false
   * 
   * @example
   * ```typescript
   * // 检查特定事件是否有监听器
   * if (emitter.hasListeners('message')) {
   *   console.log('message 事件有监听器')
   * }
   * 
   * // 检查是否有任何监听器
   * if (emitter.hasListeners()) {
   *   console.log('存在监听器')
   * }
   * ```
   */
  hasListeners(event?: WebSocketEventType | string): boolean {
    if (event) {
      return this.listenerCount(event) > 0
    }
    return this.listeners.size > 0
  }

  /**
   * 设置最大监听器数量限制
   * 
   * 当某个事件的监听器数量超过此限制时，会发出警告
   * 设置为 0 表示不限制
   * 
   * @param n - 最大监听器数量
   * 
   * @example
   * ```typescript
   * emitter.setMaxListeners(20) // 允许每个事件最多 20 个监听器
   * emitter.setMaxListeners(0)  // 不限制监听器数量
   * ```
   */
  setMaxListeners(n: number): void {
    this.maxListeners = n
    // 清除已有的警告记录，以便用新限制重新检查
    this.warnedEvents.clear()
  }

  /**
   * 获取当前的最大监听器数量限制
   * 
   * @returns 最大监听器数量
   */
  getMaxListeners(): number {
    return this.maxListeners
  }
}


