/**
 * api/user.js —— 用户相关的「业务接口层」
 *
 * 分层思路（后面每一步都会沿用）：
 *   页面(.vue) → api(业务语义) → utils/cloud(通信细节) → 云函数 → 云数据库
 * 页面只关心「拿到用户」这件事，不关心底层是云函数还是 HTTP。
 */
import { callFunction, uploadFile, FN_USER } from '@/utils/cloud'
import { userStore, setProfile, patchProfile } from '@/store/user'

/**
 * 静默登录
 *
 * 链路：小程序 → 云函数 user(login) → 云函数用 cloud.getWXContext() 拿到 OPENID
 *      → 查 users 集合，没有就创建 → 返回用户记录
 *
 * 为什么不需要 wx.login / code2session？
 * 因为「云开发」内置了免鉴权通道：调用云函数时，微信会自动把调用者身份
 * （OPENID、APPID、UNIONID）注入到 cloud.getWXContext() 里，且无法被伪造。
 */
export async function loginSilently() {
  if (userStore.loading) return userStore.profile
  userStore.loading = true
  try {
    const res = await callFunction(FN_USER, { action: 'login' })
    if (!res || res.code !== 0) {
      throw new Error((res && res.msg) || '登录失败')
    }
    setProfile(res.data)
    console.log('[auth] 登录成功：', res.isNew ? '新用户，已创建账号' : '老用户')
    return res.data
  } catch (err) {
    // 这一步失败通常是环境没配好：环境 ID 写错 / users 集合没建 / 云函数没上传
    console.error('[auth] 静默登录失败，请检查云开发配置：', err)
    userStore.logged = false
    return null
  } finally {
    userStore.loading = false
  }
}

/**
 * 更新用户资料（昵称 / 头像）
 * @param {object} payload 只允许 { nickName, avatarUrl }
 */
export async function updateProfile(payload) {
  if (!userStore.profile) throw new Error('请先登录')

  const res = await callFunction(FN_USER, {
    action: 'updateProfile',
    payload
  })
  if (!res || res.code !== 0) {
    throw new Error((res && res.msg) || '更新资料失败')
  }

  // 云端更新成功后，同步本地状态与缓存，页面立即刷新
  patchProfile(payload)
  return res.data
}

/**
 * 上传头像并更新到数据库
 * @param {string} tempFilePath chooseAvatar 回调给的本地临时路径
 * @returns {Promise<string>} 云存储 fileID
 */
export async function uploadAvatar(tempFilePath) {
  const openid = (userStore.profile && userStore.profile._openid) || 'anonymous'
  // 从临时路径里抠出扩展名，保证云存储里的文件类型正确
  const match = tempFilePath.match(/\.(\w+)$/)
  const ext = match ? match[1] : 'png'
  // 用 openid + 时间戳命名，避免覆盖别人的头像
  const cloudPath = `avatars/${openid}_${Date.now()}.${ext}`

  const fileID = await uploadFile(tempFilePath, cloudPath)
  await updateProfile({ avatarUrl: fileID })
  return fileID
}
