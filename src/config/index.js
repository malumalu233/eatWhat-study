/**
 * 全局配置
 *
 * ⚠️ 第一步唯一需要你手动改的地方就是下面的 CLOUD_ENV_ID。
 * 获取方式：微信开发者工具 → 云开发 → 环境设置 → 环境 ID（形如 eatwhat-3gxxxxx）
 */
export const CLOUD_ENV_ID = 'cloud1-d5gaec90198225806'

/** 新用户的默认昵称（用户未授权微信昵称时使用） */
export const DEFAULT_NICKNAME = '美食爱好者'

/** 云函数名称统一在这里登记，避免各处手写字符串拼错 */
export const CLOUD_FUNCTIONS = {
  user: 'user'
}
