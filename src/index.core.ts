/**
 * @ldesign/websocket - 核心导出（框架无关）
 * 
 * 此文件只导出核心功能，不包含任何框架特定的代码
 */

// ============ 核心客户端 ============
export {
  WebSocketClient,
  createWebSocketClient,
} from './core/websocket-client'

// ============ 管理器 ============
export { ConnectionManager } from './core/connection-manager'
export { ReconnectManager } from './core/reconnect-manager'
export { HeartbeatManager } from './core/heartbeat-manager'
export { MessageQueue } from './core/message-queue'
export { EventEmitter } from './core/event-emitter'

// ============ 适配器 ============
export {
  BaseAdapter,
  NativeAdapter,
  AdapterFactory,
} from './adapters'

// ============ 类型 ============
export type * from './types'

// ============ 工具函数 ============
export { generateId, resetCounter } from './utils/id-generator'


