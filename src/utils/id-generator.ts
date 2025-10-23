/**
 * ID 生成器工具
 */

let counter = 0

/**
 * 生成唯一 ID
 * 
 * @param prefix - ID 前缀
 * @returns 唯一 ID
 */
export function generateId(prefix: string = 'msg'): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 9)
  counter = (counter + 1) % 10000
  return `${prefix}_${timestamp}_${random}_${counter}`
}

/**
 * 重置计数器（仅用于测试）
 */
export function resetCounter(): void {
  counter = 0
}


