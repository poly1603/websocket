/**
 * useWebSocket Composable
 * 
 * 提供 Vue 3 组合式 API 的 WebSocket 客户端
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
import type { UseWebSocketOptions, UseWebSocketReturn } from '../types/vue'
import { createWebSocketClient } from '../core/websocket-client'

/**
 * useWebSocket 组合式函数
 * 
 * @param url - WebSocket URL（可以是 ref）
 * @param options - 配置选项
 * @returns WebSocket 客户端状态和方法
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
  const state = ref<any>('disconnected')
  const data = ref<any>(null)
  const error = ref<Error | null>(null)
  const client = shallowRef<any>(null)
  const metrics = ref<any>({})
  const queueSize = ref(0)

  // 计算属性
  const isConnected = computed(() => state.value === 'connected')

  /**
   * 创建客户端实例
   */
  function createClient() {
    const currentUrl = unref(url)

    if (!currentUrl) {
      throw new Error('WebSocket URL is required')
    }

    client.value = createWebSocketClient({
      url: currentUrl,
      ...clientConfig,
    })

    // 注册事件监听
    setupEventListeners()
  }

  /**
   * 设置事件监听
   */
  function setupEventListeners() {
    if (!client.value) return

    // 状态变化
    client.value.on('state-change', (event: any) => {
      state.value = event.newState
      metrics.value = client.value.metrics
      queueSize.value = client.value.queueSize
    })

    // 连接打开
    client.value.on('open', () => {
      error.value = null
      onOpen?.()
    })

    // 连接关闭
    client.value.on('close', (event: any) => {
      onClose?.(event)
    })

    // 错误
    client.value.on('error', (event: any) => {
      error.value = event.error
      onError?.(event.error)
    })

    // 消息
    client.value.on('message', (event: any) => {
      data.value = event.data
      onMessage?.(event.data)
    })

    // 重连
    client.value.on('reconnecting', (event: any) => {
      onReconnecting?.(event.attempt)
    })

    client.value.on('reconnected', () => {
      onReconnected?.()
    })
  }

  /**
   * 连接到服务器
   */
  async function connect() {
    if (!client.value) {
      createClient()
    }

    try {
      await client.value.connect()
    }
    catch (err) {
      error.value = err as Error
      throw err
    }
  }

  /**
   * 断开连接
   */
  function disconnect(code?: number, reason?: string) {
    client.value?.disconnect(code, reason)
  }

  /**
   * 发送消息
   */
  function send<T = any>(sendData: T, sendOptions?: any) {
    if (!client.value) {
      throw new Error('WebSocket client is not initialized')
    }
    client.value.send(sendData, sendOptions)
  }

  /**
   * 发送二进制数据
   */
  function sendBinary(binaryData: ArrayBuffer | Blob) {
    if (!client.value) {
      throw new Error('WebSocket client is not initialized')
    }
    client.value.sendBinary(binaryData)
  }

  /**
   * 清空队列
   */
  function clearQueue() {
    client.value?.clearQueue()
    queueSize.value = 0
  }

  // 监听 URL 变化
  watch(() => unref(url), (newUrl, oldUrl) => {
    if (newUrl !== oldUrl && client.value) {
      disconnect()
      createClient()
      if (autoConnect) {
        connect()
      }
    }
  })

  // 生命周期
  onMounted(() => {
    if (autoConnect) {
      connect()
    }
  })

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


