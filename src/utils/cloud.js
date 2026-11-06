/**
 * utils/cloud.js —— 微信云开发的统一入口
 *
 * 为什么要有这一层？
 * 1. 全项目只在这里出现 `wx.cloud.xxx`，将来换成 uniCloud 或自建后端时只改一个文件；
 * 2. 回调风格（success/fail）转成 Promise，业务代码可以直接 await，少写嵌套；
 * 3. 统一错误提示与日志，排查问题时信息更完整。
 *
 * 关键概念：uni-app 编译到微信小程序后，全局对象 `wx` 是可用的；
 * 但编译到 H5 / App 端时并不存在 `wx`，所以用条件编译 `#ifdef MP-WEIXIN`
 * 把云开发相关代码「只保留给微信小程序端」。
 */
import { CLOUD_ENV_ID, CLOUD_FUNCTIONS } from '@/config'

let initialized = false

/**
 * 初始化云开发环境
 * @returns {boolean} 是否初始化成功（小程序端且基础库支持才为 true）
 */
export function initCloud() {
  // #ifdef MP-WEIXIN
  if (!wx.cloud) {
    console.error('[cloud] 当前微信基础库版本过低，请升级微信客户端（需 2.2.3 以上）')
    return false
  }
  if (!initialized) {
    wx.cloud.init({
      // env 指定数据/云函数所在环境；把这里写死可以避免「默认环境」带来的误操作
      env: CLOUD_ENV_ID,
      // traceUser: true 会把用户访问记录到云开发的「用户管理」里，方便定位问题
      traceUser: true
    })
    initialized = true
    console.log('[cloud] 云开发初始化完成，环境：', CLOUD_ENV_ID)
  }
  return true
  // #endif

  // #ifndef MP-WEIXIN
  console.warn('[cloud] 云开发只在微信小程序端可用，当前平台已跳过初始化')
  return false
  // #endif
}

/**
 * 调用云函数（Promise 化）
 * @param {string} name 云函数名，如 user
 * @param {object} data 传给云函数的 event 参数
 * @returns {Promise<any>} 云函数 return 的数据（已自动解开 res.result 这层壳）
 */
export function callFunction(name, data = {}) {
  // #ifdef MP-WEIXIN
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success: (res) => resolve(res.result),
      fail: (err) => {
        console.error(`[cloud] 调用云函数 ${name} 失败：`, err)
        reject(err)
      }
    })
  })
  // #endif

  // #ifndef MP-WEIXIN
  return Promise.reject(new Error('云函数仅在微信小程序端可用'))
  // #endif
}

/**
 * 上传文件到云存储
 * @param {string} filePath 本地临时文件路径（如 chooseAvatar 回调里的 avatarUrl）
 * @param {string} cloudPath 云存储中的路径，如 avatars/xxx.png
 * @returns {Promise<string>} fileID，形如 cloud://环境ID.xxxx/avatars/xxx.png
 */
export function uploadFile(filePath, cloudPath) {
  // #ifdef MP-WEIXIN
  return new Promise((resolve, reject) => {
    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: (res) => resolve(res.fileID),
      fail: (err) => {
        console.error('[cloud] 上传文件失败：', err)
        reject(err)
      }
    })
  })
  // #endif

  // #ifndef MP-WEIXIN
  return Promise.reject(new Error('云存储仅在小程序端可用'))
  // #endif
}

/* 便捷方法：直接拿到当前环境的云函数名 */
export const FN_USER = CLOUD_FUNCTIONS.user
