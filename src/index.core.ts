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
export { EncryptionManager } from './core/encryption-manager'
export { CompressionManager } from './core/compression-manager'
export { AckManager } from './core/ack-manager'
export { RpcManager } from './core/rpc-manager'
export { PerformanceMonitor } from './core/monitor'
export { MessageRouter } from './core/router'
export { BatchSender } from './core/batch-sender'
export { MessageDeduplicator } from './core/deduplicator'

// ============ 错误类 ============
export {
  WebSocketError,
  ConnectionError,
  TimeoutError,
  ProtocolError,
  QueueFullError,
  EncryptionError,
  CompressionError,
  StateError,
  AuthenticationError,
  MessageSizeError,
  isRetryableError,
  createErrorFromNative,
} from './core/errors'

// ============ 适配器 ============
export {
  BaseAdapter,
  NativeAdapter,
  AdapterFactory,
} from './adapters'

// ============ 中间件 ============
export {
  MiddlewareManager,
  createLoggerMiddleware,
  createValidatorMiddleware,
  createSchemaValidator,
  createTransformerMiddleware,
  ValidationRules,
  Transformers,
  type Middleware,
  type MiddlewareContext,
  type LoggerMiddlewareOptions,
  type ValidatorMiddlewareOptions,
  type ValidationRule,
  type TransformerMiddlewareOptions,
  type TransformFunction,
} from './middlewares'

// ============ 类型 ============
export type * from './types'

// ============ 工具函数 ============
export { generateId, resetCounter } from './utils/id-generator'


