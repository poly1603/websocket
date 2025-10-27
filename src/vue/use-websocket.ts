/**
 * useWebSocket 组合式函数
 * 
 * 提供 Vue 3 组合式 API 的 WebSocket 客户端，支持自动连接、断开和响应式状态管理
 */

import {
  computed,
  onBeforeUnmount,
  onMounted,
  readonly,
  ref,
  shallowRef,
  unref,
  watch,
  type Ref,
} from 'vue'
import type { ConnectionState, ConnectionMetrics } from '../types'
import type { UseWebSocketOptions, UseWebSocketReturn } from '../types/vue'
import type { WebSocketClient } from '../core/websocket-client'
import { createWebSocketClient } from '../core/websocket-client'

/**
 * useWebSocket 组合式函数
 * 
 * 创建并管理一个 WebSocket 客户端实例，提供响应式的状态和方法
 * 
 * @param url - WebSocket 服务器 URL（可以是字符串或响应式引用）
 * @param options - 配置选项，包括自动连接、事件回调等
 * @returns 返回 WebSocket 客户端的响应式状态和操作方法
 * 
 * @example
 * ```vue
 * <script setup>
 * import { useWebSocket } from '@ldesign/websocket/vue'
 * 
 * const { state, data, send, connect, disconnect } = useWebSocket('ws://localhost:8080', {
 *   autoConnect: true,
 *   onMessage: (data) => console.log('收到消息:', data)
 * })
 * </script>
 * ```
 */
export function useWebSocket(
  url: string | Ref<string>,
  options: UseWebSocketOptions = {},
): UseWebSocketReturn {
  const {
    autoConnect = false,
    autoDisconnect = true,
    onOpen,
    onClose,
    onError,
    onMessage,
    onReconnecting,
    onReconnected,
    ...clientConfig
  } = options

  // 响应式状态
  const state = ref<ConnectionState>('disconnected')
  const data = ref<unknown>(null)
  const error = ref<Error | null>(null)
  const client = shallowRef<WebSocketClient | null>(null)
  const metrics = ref<ConnectionMetrics>({
    messagesSent: 0,
    messagesReceived: 0,
    reconnectCount: 0,
    currentReconnectAttempt: 0,
    averageLatency: 0,
    queuedMessages: 0,
  })
  const queueSize = ref<number>(0)

  // 计算属性：是否已连接
  const isConnected = computed(() => state.value === 'connected')

  /**
   * 创建 WebSocket 客户端实例
   * 
   * 根据提供的 URL 和配置创建新的客户端实例，并设置事件监听器
   * 
   * @throws 如果 URL 为空则抛出错误
   */
  function createClient(): void {
    const currentUrl = unref(url)

    if (!currentUrl) {
      throw new Error('WebSocket URL is required')
    }

    client.value = createWebSocketClient({
      url: currentUrl,
      ...clientConfig,
    })

    // 注册事件监听器
    setupEventListeners()
  }

  /**
   * 设置事件监听器
   * 
   * 为客户端注册各种事件的监听器，包括状态变化、连接打开/关闭、错误、消息接收等
   * 这些监听器会更新响应式状态并调用用户提供的回调函数
   */
  function setupEventListeners(): void {
    if (!client.value) return

    // 状态变化事件：更新连接状态、指标和队列大小
    client.value.on('state-change', (event) => {
      state.value = event.newState
      metrics.value = client.value!.metrics
      queueSize.value = client.value!.queueSize
    })

    // 连接打开事件：清除错误并调用回调
    client.value.on('open', () => {
      error.value = null
      onOpen?.()
    })

    // 连接关闭事件：调用关闭回调
    client.value.on('close', (event) => {
      onClose?.(event)
    })

    // 错误事件：更新错误状态并调用回调
    client.value.on('error', (event) => {
      error.value = event.error
      onError?.(event.error)
    })

    // 消息接收事件：更新最新消息并调用回调
    client.value.on('message', (event) => {
      data.value = event.data
      onMessage?.(event.data)
    })

    // 重连事件：通知重连尝试
    client.value.on('reconnecting', (event) => {
      onReconnecting?.(event.attempt)
    })

    // 重连成功事件
    client.value.on('reconnected', () => {
      onReconnected?.()
    })
  }

  /**
   * 连接到 WebSocket 服务器
   * 
   * 如果客户端实例不存在，会先创建实例再连接
   * 连接失败时会更新错误状态并重新抛出错误
   * 
   * @throws 连接失败时抛出错误
   */
  async function connect(): Promise<void> {
    if (!client.value) {
      createClient()
    }

    try {
      await client.value!.connect()
    }
    catch (err) {
      error.value = err as Error
      throw err
    }
  }

  /**
   * 断开与服务器的连接
   * 
   * @param code - WebSocket 关闭代码（可选）
   * @param reason - 关闭原因（可选）
   */
  function disconnect(code?: number, reason?: string): void {
    client.value?.disconnect(code, reason)
  }

  /**
   * 发送消息到服务器
   * 
   * @param sendData - 要发送的数据，可以是任意类型，会自动序列化
   * @param sendOptions - 发送选项，如优先级、是否需要确认等
   * @throws 如果客户端未初始化则抛出错误
   */
  function send<T = unknown>(sendData: T, sendOptions?: import('../types').SendOptions): void {
    if (!client.value) {
      throw new Error('WebSocket client is not initialized')
    }
    client.value.send(sendData, sendOptions)
  }

  /**
   * 发送二进制数据到服务器
   * 
   * @param binaryData - 二进制数据（ArrayBuffer 或 Blob）
   * @throws 如果客户端未初始化则抛出错误
   */
  function sendBinary(binaryData: ArrayBuffer | Blob): void {
    if (!client.value) {
      throw new Error('WebSocket client is not initialized')
    }
    client.value.sendBinary(binaryData)
  }

  /**
   * 清空消息队列
   * 
   * 清除所有待发送的消息并重置队列大小
   */
  function clearQueue(): void {
    client.value?.clearQueue()
    queueSize.value = 0
  }

  // 监听 URL 变化：当 URL 改变时，重新创建客户端并根据配置决定是否自动连接
  watch(() => unref(url), (newUrl, oldUrl) => {
    if (newUrl !== oldUrl && client.value) {
      disconnect()
      createClient()
      if (autoConnect) {
        connect()
      }
    }
  })

  // 组件挂载时：如果启用了自动连接，则立即连接
  onMounted(() => {
    if (autoConnect) {
      connect()
    }
  })

  // 组件卸载前：如果启用了自动断开，则销毁客户端实例
  onBeforeUnmount(() => {
    if (autoDisconnect) {
      client.value?.destroy()
    }
  })

  return {
    state: readonly(state),
    data: readonly(data),
    error: readonly(error),
    client: readonly(client),
    metrics: readonly(metrics),
    isConnected: readonly(isConnected),
    queueSize: readonly(queueSize),
    connect,
    disconnect,
    send,
    sendBinary,
    clearQueue,
  }
}


