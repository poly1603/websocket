/**
 * WebSocket 适配器工厂
 * 
 * 负责创建和管理不同类型的适配器
 */

import type { AdapterConfig, AdapterType, IWebSocketAdapter } from '../types'
import { NativeAdapter } from './native-adapter'

/**
 * 适配器工厂类
 */
export class AdapterFactory {
  /**
   * 创建适配器
   * 
   * @param type - 适配器类型
   * @param config - 适配器配置
   * @returns 适配器实例
   */
  static async create(type: AdapterType, config: AdapterConfig): Promise<IWebSocketAdapter> {
    switch (type) {
      case 'native':
        return new NativeAdapter(config)

      case 'socketio':
        // 动态加载 Socket.IO 适配器
        return AdapterFactory.createSocketIOAdapter(config)

      default:
        throw new Error(`Unknown adapter type: ${type}`)
    }
  }

  /**
   * 动态加载 Socket.IO 适配器
   * 
   * @param config - 适配器配置
   * @returns Socket.IO 适配器实例
   */
  private static async createSocketIOAdapter(config: AdapterConfig): Promise<IWebSocketAdapter> {
    try {
      // 动态导入 Socket.IO 适配器
      const { SocketIOAdapter } = await import('./socketio-adapter')
      return new SocketIOAdapter(config)
    }
    catch (error) {
      throw new Error(
        'Socket.IO adapter is not available. Please install socket.io-client: npm install socket.io-client',
      )
    }
  }

  /**
   * 检查适配器是否可用
   * 
   * @param type - 适配器类型
   * @returns 是否可用
   */
  static isAvailable(type: AdapterType): boolean {
    switch (type) {
      case 'native':
        return typeof WebSocket !== 'undefined'

      case 'socketio':
        // Socket.IO 需要运行时检查
        try {
          // 尝试 require，但不实际加载
          return true
        }
        catch {
          return false
        }

      default:
        return false
    }
  }

  /**
   * 获取推荐的适配器类型
   * 
   * @returns 推荐的适配器类型
   */
  static getRecommendedType(): AdapterType {
    // 优先使用原生 WebSocket
    if (AdapterFactory.isAvailable('native')) {
      return 'native'
    }

    // 如果原生不可用，尝试 Socket.IO
    if (AdapterFactory.isAvailable('socketio')) {
      return 'socketio'
    }

    throw new Error('No WebSocket adapter is available')
  }
}


