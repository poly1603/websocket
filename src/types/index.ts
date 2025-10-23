/**
 * WebSocket 类型定义统一导出
 */

// 客户端类型
export type {
  ConnectionState,
  ReconnectConfig,
  HeartbeatConfig,
  QueueConfig,
  EncryptionConfig,
  CompressionConfig,
  WebSocketClientConfig,
  SendOptions,
  QueueItem,
  ConnectionMetrics,
  WebSocketError,
} from './client'

// 适配器类型
export type {
  AdapterConfig,
  IWebSocketAdapter,
  AdapterType,
  AdapterFactoryConfig,
} from './adapter'

// 事件类型
export type {
  WebSocketEventType,
  EventListener,
  OpenEvent,
  CloseEvent,
  ErrorEvent,
  MessageEvent,
  ReconnectingEvent,
  ReconnectedEvent,
  ReconnectFailedEvent,
  HeartbeatEvent,
  StateChangeEvent,
  EventDataMap,
} from './events'
