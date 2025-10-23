/**
 * Vue 3 集成导出
 */

// Composables
export { useWebSocket } from './use-websocket'
export {
  useInjectedWebSocket,
  useInjectedWebSocketConfig,
  provideWebSocket,
} from './use-injected'

// 插件
export {
  WebSocketPlugin,
  createWebSocketPlugin,
  install,
  WEBSOCKET_CLIENT_KEY,
  WEBSOCKET_CONFIG_KEY,
} from './plugin'

// 组件
export { WebSocketProvider } from './provider'

// 类型
export type {
  UseWebSocketOptions,
  UseWebSocketReturn,
  WebSocketPluginOptions,
} from '../types/vue'


