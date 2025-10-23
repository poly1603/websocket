/**
 * WebSocket Vue 插件
 * 
 * 提供全局 WebSocket 客户端实例
 */

import type { App, InjectionKey } from 'vue'
import type { WebSocketPluginOptions } from '../types/vue'
import type { WebSocketClient } from '../core/websocket-client'
import { createWebSocketClient } from '../core/websocket-client'

/**
 * WebSocket 客户端注入键
 */
export const WEBSOCKET_CLIENT_KEY: InjectionKey<WebSocketClient> = Symbol('websocket-client')

/**
 * WebSocket 配置注入键
 */
export const WEBSOCKET_CONFIG_KEY: InjectionKey<WebSocketPluginOptions> = Symbol('websocket-config')

/**
 * WebSocket 插件
 */
export const WebSocketPlugin = {
  install(app: App, options: WebSocketPluginOptions) {
    // 创建全局客户端实例
    const client = createWebSocketClient(options)

    // 提供客户端和配置
    app.provide(WEBSOCKET_CLIENT_KEY, client)
    app.provide(WEBSOCKET_CONFIG_KEY, options)

    // 添加全局属性（可选）
    if (app.config.globalProperties) {
      app.config.globalProperties.$websocket = client
    }

    // 在应用卸载时清理
    const originalUnmount = app.unmount
    app.unmount = function () {
      client.destroy()
      originalUnmount.call(this)
    }
  },
}

/**
 * 创建 WebSocket 插件
 * 
 * @param options - 插件选项
 * @returns Vue 插件
 * 
 * @example
 * ```typescript
 * import { createApp } from 'vue'
 * import { createWebSocketPlugin } from '@ldesign/websocket/vue'
 * 
 * const app = createApp(App)
 * app.use(createWebSocketPlugin({
 *   url: 'ws://localhost:8080',
 *   reconnect: { enabled: true }
 * }))
 * ```
 */
export function createWebSocketPlugin(options: WebSocketPluginOptions) {
  return {
    install(app: App) {
      WebSocketPlugin.install(app, options)
    },
  }
}

/**
 * 安装插件的快捷方法
 * 
 * @param app - Vue 应用实例
 * @param options - 插件选项
 */
export function install(app: App, options: WebSocketPluginOptions) {
  WebSocketPlugin.install(app, options)
}


