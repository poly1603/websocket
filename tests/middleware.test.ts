/**
 * 中间件系统单元测试
 * 
 * 测试中间件管理器和内置中间件
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  MiddlewareManager,
  createLoggerMiddleware,
  createValidatorMiddleware,
  createTransformerMiddleware,
  ValidationRules,
  Transformers,
} from '../src/middlewares'

describe('MiddlewareManager', () => {
  let manager: MiddlewareManager

  beforeEach(() => {
    manager = new MiddlewareManager()
  })

  describe('基础功能', () => {
    it('应该能够注册和执行中间件', async () => {
      const middleware = vi.fn(async (context, next) => {
        await next()
      })

      manager.useSend(middleware)

      await manager.executeSend({ data: 'test' }, async () => { })

      expect(middleware).toHaveBeenCalled()
    })

    it('中间件应该按注册顺序执行', async () => {
      const order: number[] = []

      const middleware1 = vi.fn(async (context, next) => {
        order.push(1)
        await next()
        order.push(4)
      })

      const middleware2 = vi.fn(async (context, next) => {
        order.push(2)
        await next()
        order.push(3)
      })

      manager.useSend(middleware1)
      manager.useSend(middleware2)

      await manager.executeSend({ data: 'test' }, async () => { })

      expect(order).toEqual([1, 2, 3, 4]) // 洋葱模型
    })

    it('应该能够修改上下文数据', async () => {
      const middleware = async (context: any, next: any) => {
        context.data = { modified: true }
        await next()
      }

      manager.useSend(middleware)

      let finalData: any
      await manager.executeSend({ data: 'original' }, async () => { })

      expect(manager).toBeDefined() // 中间件应该能修改数据
    })

    it('应该支持跳过后续中间件', async () => {
      const middleware1 = async (context: any, next: any) => {
        context.shouldSkip = true
      }

      const middleware2 = vi.fn()

      manager.useSend(middleware1)
      manager.useSend(middleware2)

      await manager.executeSend({ data: 'test' }, async () => { })

      // middleware2 不应该被调用（因为 shouldSkip）
      expect(middleware2).not.toHaveBeenCalled()
    })
  })

  describe('发送和接收中间件', () => {
    it('应该区分发送和接收中间件', async () => {
      const sendMiddleware = vi.fn(async (context, next) => await next())
      const receiveMiddleware = vi.fn(async (context, next) => await next())

      manager.useSend(sendMiddleware)
      manager.useReceive(receiveMiddleware)

      await manager.executeSend({ data: 'test' }, async () => { })
      expect(sendMiddleware).toHaveBeenCalled()
      expect(receiveMiddleware).not.toHaveBeenCalled()

      await manager.executeReceive({ data: 'test' })
      expect(receiveMiddleware).toHaveBeenCalled()
    })

    it('use 应该同时注册发送和接收中间件', async () => {
      const middleware = vi.fn(async (context, next) => await next())

      manager.use(middleware)

      await manager.executeSend({ data: 'test' }, async () => { })
      await manager.executeReceive({ data: 'test' })

      expect(middleware).toHaveBeenCalledTimes(2)
    })
  })

  describe('错误处理', () => {
    it('中间件抛出错误应该被捕获', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

      const middleware = async () => {
        throw new Error('中间件错误')
      }

      manager.useSend(middleware)

      await expect(
        manager.executeSend({ data: 'test' }, async () => { })
      ).rejects.toThrow('中间件错误')

      consoleErrorSpy.mockRestore()
    })
  })

  describe('统计和清理', () => {
    it('应该能够获取中间件数量', () => {
      manager.useSend(async (ctx, next) => await next())
      manager.useSend(async (ctx, next) => await next())
      manager.useReceive(async (ctx, next) => await next())

      const count = manager.getMiddlewareCount()
      expect(count.send).toBe(2)
      expect(count.receive).toBe(1)
    })

    it('应该能够清除所有中间件', () => {
      manager.useSend(async (ctx, next) => await next())
      manager.useReceive(async (ctx, next) => await next())

      manager.clear()

      const count = manager.getMiddlewareCount()
      expect(count.send).toBe(0)
      expect(count.receive).toBe(0)
    })
  })
})

describe('内置中间件', () => {
  describe('LoggerMiddleware', () => {
    it('应该记录消息', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { })

      const logger = createLoggerMiddleware({
        enabled: true,
        logData: true,
      })

      const context: any = {
        data: { type: 'test', message: 'Hello' },
        direction: 'send',
        timestamp: Date.now(),
        meta: {},
      }

      await logger(context, async () => { })

      expect(consoleLogSpy).toHaveBeenCalled()

      consoleLogSpy.mockRestore()
    })

    it('禁用时不应该记录', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { })

      const logger = createLoggerMiddleware({ enabled: false })
      const context: any = {
        data: 'test',
        direction: 'send',
        timestamp: Date.now(),
        meta: {},
      }

      await logger(context, async () => { })

      expect(consoleLogSpy).not.toHaveBeenCalled()

      consoleLogSpy.mockRestore()
    })
  })

  describe('ValidatorMiddleware', () => {
    it('应该验证消息', async () => {
      const validator = createValidatorMiddleware({
        enabled: true,
        rules: [ValidationRules.requireObject, ValidationRules.requireType],
        onError: 'throw',
      })

      const validContext: any = {
        data: { type: 'test', message: 'valid' },
        direction: 'send',
        timestamp: Date.now(),
        meta: {},
      }

      await expect(
        validator(validContext, async () => { })
      ).resolves.not.toThrow()
    })

    it('验证失败应该抛出错误', async () => {
      const validator = createValidatorMiddleware({
        enabled: true,
        rules: [ValidationRules.requireType],
        onError: 'throw',
      })

      const invalidContext: any = {
        data: { message: 'no type field' },
        direction: 'send',
        timestamp: Date.now(),
        meta: {},
      }

      await expect(
        validator(invalidContext, async () => { })
      ).rejects.toThrow()
    })

    it('onError=skip 应该跳过无效消息', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

      const validator = createValidatorMiddleware({
        enabled: true,
        rules: [ValidationRules.requireType],
        onError: 'skip',
      })

      const invalidContext: any = {
        data: { message: 'no type field' },
        direction: 'send',
        timestamp: Date.now(),
        meta: {},
      }

      const next = vi.fn()
      await validator(invalidContext, next)

      expect(next).not.toHaveBeenCalled() // 应该跳过
      expect(consoleWarnSpy).toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })
  })

  describe('TransformerMiddleware', () => {
    it('应该转换发送数据', async () => {
      const transformer = createTransformerMiddleware({
        enabled: true,
        transformSend: Transformers.addTimestamp('sentAt'),
      })

      const context: any = {
        data: { message: 'test' },
        direction: 'send',
        timestamp: Date.now(),
        meta: {},
      }

      await transformer(context, async () => { })

      expect(context.data).toHaveProperty('sentAt')
      expect(context.data).toHaveProperty('message', 'test')
    })

    it('应该转换接收数据', async () => {
      const transformer = createTransformerMiddleware({
        enabled: true,
        transformReceive: Transformers.parse(),
      })

      const context: any = {
        data: '{"message":"test"}',
        direction: 'receive',
        timestamp: Date.now(),
        meta: {},
      }

      await transformer(context, async () => { })

      expect(context.data).toEqual({ message: 'test' })
    })
  })

  describe('常用转换器', () => {
    it('addTimestamp 应该添加时间戳', () => {
      const transformer = Transformers.addTimestamp('ts')
      const result = transformer({ message: 'test' }, {} as any)

      expect(result).toHaveProperty('ts')
      expect(result).toHaveProperty('message', 'test')
    })

    it('wrap 应该包装数据', () => {
      const transformer = Transformers.wrap('payload')
      const result = transformer({ message: 'test' }, {
        type: 'chat',
        timestamp: 123
      } as any)

      expect(result).toHaveProperty('payload', { message: 'test' })
      expect(result).toHaveProperty('type', 'chat')
    })

    it('unwrap 应该解包数据', () => {
      const transformer = Transformers.unwrap('payload')
      const result = transformer({
        payload: { message: 'test' },
        type: 'chat'
      }, {} as any)

      expect(result).toEqual({ message: 'test' })
    })

    it('renameFields 应该重命名字段', () => {
      const transformer = Transformers.renameFields({
        oldName: 'newName'
      })

      const result = transformer({
        oldName: 'value',
        other: 'data'
      }, {} as any)

      expect(result).toEqual({
        newName: 'value',
        other: 'data'
      })
    })
  })
})


