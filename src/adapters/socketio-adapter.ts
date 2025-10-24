/**
 * Socket.IO WebSocket 适配器
 * 
 * 此适配器需要安装 socket.io-client
 * npm install socket.io-client
 */

import type {
  IWebSocketAdapter,
  AdapterConfig,
  WebSocketEventMap,
} from '../types/adapter'
import { BaseAdapter } from './base-adapter'

/**
 * Socket.IO 适配器实现
 */
export class SocketIOAdapter extends BaseAdapter implements IWebSocketAdapter {
  private socket: any = null

  constructor(config: AdapterConfig) {
    super(config)
  }

  async connect(): Promise<void> {
    throw new Error(
      'Socket.IO adapter requires socket.io-client. Please install it: npm install socket.io-client'
    )
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.updateState('disconnected')
  }

  send(data: string | ArrayBuffer | Blob): void {
    if (!this.socket || !this.socket.connected) {
      throw new Error('Socket.IO is not connected')
    }

    this.socket.emit('message', data)
  }

  on<K extends keyof WebSocketEventMap>(
    event: K,
    handler: WebSocketEventMap[K],
  ): void {
    this.eventEmitter.on(event, handler as any)
  }

  off<K extends keyof WebSocketEventMap>(
    event: K,
    handler: WebSocketEventMap[K],
  ): void {
    this.eventEmitter.off(event, handler as any)
  }

  getReadyState(): number {
    if (!this.socket) return WebSocket.CLOSED
    if (this.socket.connected) return WebSocket.OPEN
    if (this.socket.connecting) return WebSocket.CONNECTING
    return WebSocket.CLOSED
  }
}

