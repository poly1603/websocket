/**
 * 注入的 WebSocket 客户端 Composable
 * 
 * 从上层 Provider 或插件中注入客户端实例
 */

import { inject } from 'vue'
import type { WebSocketClient } from '../core/websocket-client'
import type { WebSocketPluginOptions } from '../types/vue'
import { WEBSOCKET_CLIENT_KEY, WEBSOCKET_CONFIG_KEY } from './plugin'

/**
 * 注入 WebSocket 客户端
 * 
 * @returns WebSocket 客户端实例
 * @throws 如果未找到客户端实例
 * 
 * @example
 * ```vue
 * <script setup>
 * import { useInjectedWebSocket } from '@ldesign/websocket/vue'
 * 
 * const client = useInjectedWebSocket()
 * client.send({ type: 'message', content: 'Hello' })
 * </script>
 * ```
 */
export function useInjectedWebSocket(): WebSocketClient {
  const client = inject(WEBSOCKET_CLIENT_KEY)

  if (!client) {
    throw new Error(
      'WebSocket client not found. Did you forget to install the plugin or wrap your component with WebSocketProvider?',
    )
  }

  return client
}

/**
 * 注入 WebSocket 配置
 * 
 * @returns WebSocket 配置
 * @throws 如果未找到配置
 */
export function useInjectedWebSocketConfig(): WebSocketPluginOptions {
  const config = inject(WEBSOCKET_CONFIG_KEY)

  if (!config) {
    throw new Error('WebSocket config not found')
  }

  return config
}

/**
 * 提供 WebSocket 客户端
 * 
 * @param client - WebSocket 客户端实例
 */
export function provideWebSocket(client: WebSocketClient): void {
  provide(WEBSOCKET_CLIENT_KEY, client)
}


