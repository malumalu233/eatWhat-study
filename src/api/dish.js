/**
 * api/dish.js —— 菜品相关业务接口
 *
 * 职责划分：
 * - 本文件负责「本地临时图 → 云存储 fileID」的上传编排，以及调用 dish 云函数；
 * - 页面只负责选图、校验、展示，不直接碰 wx.cloud。
 */
import { callFunction, uploadFile, deleteFiles, FN_DISH } from '@/utils/cloud'
import { userStore } from '@/store/user'

/** 单张图片上传超时时间（毫秒）。云存储大图 + 弱网时 30s 很容易超，给到 60s */
const UPLOAD_TIMEOUT = 60 * 1000

/**
 * 给 Promise 套一层超时
 *
 * 为什么要自己做超时？
 * wx.cloud.uploadFile 没有 timeout 参数，网络卡住时会一直挂起，
 * 用户看到的就是「一直转圈」。用 Promise.race 竞争一个定时器，
 * 谁先完成用谁，超时就 reject，让页面能提示「上传超时」并允许重试。
 */
function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms)
    })
  ])
}

/** 从临时路径里取扩展名（去掉可能的 query，如 xxx.jpg?v=1） */
function getExt(path = '') {
  const clean = String(path).split('?')[0]
  const match = /\.(\w+)$/.exec(clean)
  return match ? match[1].toLowerCase() : 'jpg'
}

/** 生成一个足够唯一的云存储文件名，避免并发上传互相覆盖 */
function makeCloudPath(openid, index, path) {
  const random = Math.random().toString(36).slice(2, 8)
  // 目录按 openid 分，便于后续按用户批量清理
  return `dishes/${openid}/${Date.now()}_${index}_${random}.${getExt(path)}`
}

/**
 * 批量上传菜品图片
 *
 * 设计要点：
 * 1. 顺序上传而不是 Promise.all：弱网下并发上传更慢，且进度没法按顺序显示；
 * 2. 已经上传成功的图片会记在 item.fileID 上，重试时直接跳过（幂等，省钱省流量）；
 * 3. 每张图片开始上传时回调 onItemUploading，页面据此显示单图 loading 动画。
 *
 * @param {Array<{path:string, fileID?:string}>} items 图片列表（会被就地修改，写入 fileID）
 * @param {(index:number)=>void} [onItemUploading] 某张开始上传
 * @param {(done:number,total:number)=>void} [onProgress] 上传进度
 * @returns {Promise<string[]>} fileID 数组，顺序与 items 一致
 */
export async function uploadDishImages(items, onItemUploading, onProgress) {
  const openid = (userStore.profile && userStore.profile._openid) || 'anonymous'
  const fileIDs = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]

    // 已经传过的直接复用（重试场景）
    if (item.fileID) {
      fileIDs.push(item.fileID)
      continue
    }

    if (onItemUploading) onItemUploading(i)

    const cloudPath = makeCloudPath(openid, i, item.path)

    const fileID = await withTimeout(
      uploadFile(item.path, cloudPath),
      UPLOAD_TIMEOUT,
      '图片上传超时'
    )

    // 写回列表，重试时可跳过
    item.fileID = fileID
    fileIDs.push(fileID)

    if (onProgress) onProgress(fileIDs.length, items.length)
  }

  return fileIDs
}

/**
 * 清理未被保存的图片（用户选了图又删掉时调用，避免云存储里堆积孤儿文件）
 * @param {string[]} fileIDs
 */
export function cleanupImages(fileIDs = []) {
  const valid = fileIDs.filter((id) => typeof id === 'string' && id.startsWith('cloud://'))
  return deleteFiles(valid)
}

/**
 * 新增菜品
 * @param {{name:string, images:string[], steps:string, category:string, isDietFriendly:boolean}} payload
 * @returns {Promise<object>} 创建成功的菜品文档（含 _id）
 */
export async function createDish(payload) {
  const res = await callFunction(FN_DISH, {
    action: 'createDish',
    data: payload
  })

  if (!res || res.code !== 0) {
    throw new Error((res && res.msg) || '保存失败')
  }
  return res.data
}

/**
 * 查询菜品列表（第二步还没有列表页，先把接口备好，第五步直接用）
 * @param {{category?:string, isDietFriendly?:boolean, page?:number, pageSize?:number}} filter
 * @returns {Promise<{list:object[], total:number}>}
 */
export async function listDishes(filter = {}) {
  const res = await callFunction(FN_DISH, {
    action: 'listDishes',
    filter
  })

  if (!res || res.code !== 0) {
    throw new Error((res && res.msg) || '加载菜品失败')
  }
  return res.data
}

/**
 * 更新菜品（预留：第三步做完菜品列表后启用）
 * @param {object} payload 必须包含 _id
 */
export async function updateDish(payload) {
  const res = await callFunction(FN_DISH, {
    action: 'updateDish',
    data: payload
  })

  if (!res || res.code !== 0) {
    throw new Error((res && res.msg) || '更新失败')
  }
  return res.data
}
