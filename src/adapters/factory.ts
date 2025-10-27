/**
 * WebSocket 适配器工厂
 * 
 * 负责创建和管理不同类型的 WebSocket 适配器
 * 使用工厂模式统一适配器的创建逻辑
 * 
 * 支持的适配器类型：
 * - native: 原生 WebSocket（推荐，性能最好）
 * - socketio: Socket.IO 客户端（功能更丰富，需要安装依赖）
 * 
 * 工厂模式优势：
 * - 统一创建接口
 * - 支持动态加载
 * - 便于添加新适配器
 * - 自动检测环境支持
 */

import type { AdapterConfig, AdapterType, IWebSocketAdapter } from '../types'
import { NativeAdapter } from './native-adapter'

/**
 * 适配器工厂类
 * 
 * 提供静态方法用于创建不同类型的 WebSocket 适配器
 */
export class AdapterFactory {
  /**
   * 创建指定类型的适配器
   * 
   * 根据 type 参数创建相应的适配器实例
   * Socket.IO 适配器采用动态导入，避免增加不必要的打包体积
   * 
   * @param type - 适配器类型（'native' 或 'socketio'）
   * @param config - 适配器配置选项
   * @returns Promise<IWebSocketAdapter> 适配器实例
   * @throws 如果适配器类型未知或创建失败
   * 
   * @example
   * ```typescript
   * // 创建原生 WebSocket 适配器
   * const adapter = await AdapterFactory.create('native', {
   *   url: 'ws://localhost:8080',
   *   connectionTimeout: 5000
   * })
   * 
   * // 创建 Socket.IO 适配器（需要先安装 socket.io-client）
   * const socketIOAdapter = await AdapterFactory.create('socketio', {
   *   url: 'http://localhost:8080',
   *   socketIOOptions: { transports: ['websocket'] }
   * })
   * ```
   */
  static async create(type: AdapterType, config: AdapterConfig): Promise<IWebSocketAdapter> {
    switch (type) {
      case 'native':
        // 创建原生 WebSocket 适配器（同步创建）
        return new NativeAdapter(config)

      case 'socketio':
        // 动态加载 Socket.IO 适配器（异步创建）
        return AdapterFactory.createSocketIOAdapter(config)

      default:
        throw new Error(`未知的适配器类型: ${type}`)
    }
  }

  /**
   * 动态加载 Socket.IO 适配器（私有方法）
   * 
   * 使用动态 import 按需加载 Socket.IO 适配器
   * 这样可以避免在不使用 Socket.IO 时增加打包体积
   * 
   * @param config - 适配器配置选项
   * @returns Promise<IWebSocketAdapter> Socket.IO 适配器实例
   * @throws 如果 socket.io-client 未安装或加载失败
   * 
   * @private
   */
  private static async createSocketIOAdapter(config: AdapterConfig): Promise<IWebSocketAdapter> {
    try {
      // 动态导入 Socket.IO 适配器模块
      const { SocketIOAdapter } = await import('./socketio-adapter')
      return new SocketIOAdapter(config)
    }
    catch (error) {
      throw new Error(
        'Socket.IO 适配器不可用。请先安装 socket.io-client: npm install socket.io-client',
      )
    }
  }

  /**
   * 检查指定适配器是否可用
   * 
   * 检测当前运行环境是否支持指定类型的适配器
   * 
   * @param type - 适配器类型
   * @returns 如果适配器可用返回 true，否则返回 false
   * 
   * @example
   * ```typescript
   * if (AdapterFactory.isAvailable('native')) {
   *   console.log('浏览器支持原生 WebSocket')
   * }
   * 
   * if (AdapterFactory.isAvailable('socketio')) {
   *   console.log('Socket.IO 适配器可用')
   * }
   * ```
   */
  static isAvailable(type: AdapterType): boolean {
    switch (type) {
      case 'native':
        // 检查全局是否存在 WebSocket 对象
        return typeof WebSocket !== 'undefined'

      case 'socketio':
        // Socket.IO 需要运行时检查（是否已安装 socket.io-client）
        // 这里返回 true，实际可用性在创建时检查
        return true

      default:
        return false
    }
  }

  /**
   * 获取推荐的适配器类型
   * 
   * 根据当前运行环境自动选择最合适的适配器类型
   * 优先级：native > socketio
   * 
   * @returns 推荐的适配器类型
   * @throws 如果没有可用的适配器
   * 
   * @example
   * ```typescript
   * const recommendedType = AdapterFactory.getRecommendedType()
   * console.log('推荐使用的适配器:', recommendedType)  // 通常是 'native'
   * 
   * const adapter = await AdapterFactory.create(recommendedType, config)
   * ```
   */
  static getRecommendedType(): AdapterType {
    // 优先使用原生 WebSocket（性能最好，无额外依赖）
    if (AdapterFactory.isAvailable('native')) {
      return 'native'
    }

    // 如果原生不可用（理论上不太可能），尝试 Socket.IO
    if (AdapterFactory.isAvailable('socketio')) {
      return 'socketio'
    }

    // 所有适配器都不可用
    throw new Error('没有可用的 WebSocket 适配器')
  }
}


