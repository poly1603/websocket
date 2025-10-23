/**
 * WebSocket Provider 组件
 * 
 * 为子组件提供 WebSocket 客户端实例
 */

import { defineComponent, provide, type PropType } from 'vue'
import type { WebSocketPluginOptions } from '../types/vue'
import { createWebSocketClient } from '../core/websocket-client'
import { WEBSOCKET_CLIENT_KEY, WEBSOCKET_CONFIG_KEY } from './plugin'

/**
 * WebSocket Provider 组件
 * 
 * @example
 * ```vue
 * <template>
 *   <WebSocketProvider :config="{ url: 'ws://localhost:8080' }">
 *     <YourComponent />
 *   </WebSocketProvider>
 * </template>
 * ```
 */
export const WebSocketProvider = defineComponent({
  name: 'WebSocketProvider',
  props: {
    config: {
      type: Object as PropType<WebSocketPluginOptions>,
      required: true,
    },
    autoConnect: {
      type: Boolean,
      default: false,
    },
  },
  setup(props, { slots }) {
    // 创建客户端
    const client = createWebSocketClient(props.config)

    // 提供给子组件
    provide(WEBSOCKET_CLIENT_KEY, client)
    provide(WEBSOCKET_CONFIG_KEY, props.config)

    // 自动连接
    if (props.autoConnect) {
      client.connect()
    }

    // 返回渲染函数
    return () => slots.default?.()
  },
  beforeUnmount() {
    // 清理
    const client = this.$.provides[WEBSOCKET_CLIENT_KEY as any]
    if (client) {
      client.destroy()
    }
  },
})


