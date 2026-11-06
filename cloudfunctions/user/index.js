/**
 * 云函数：user
 * ------------------------------------------------------------------
 * 负责用户身份相关的所有服务端逻辑：
 *   action = 'login'          静默登录：拿到 openid，查/建用户记录
 *   action = 'updateProfile'  更新昵称 / 头像
 *   action = 'getProfile'     主动拉取最新资料
 *
 * 为什么登录要放在云函数里？
 * 因为只有云函数（服务端）能通过 cloud.getWXContext() 安全地拿到调用者的 OPENID，
 * 前端拿不到、也伪造不了。这是小程序「免鉴权登录」的核心机制。
 *
 * 部署方式：微信开发者工具 → 右键 cloudfunctions/user → 「上传并部署：云端安装依赖」
 */
const cloud = require('wx-server-sdk')

// DYNAMIC_CURRENT_ENV = 使用「当前云函数所在环境」，这样换环境（测试/正式）不用改代码
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const users = db.collection('users')

/** 新用户默认昵称 */
const DEFAULT_NICKNAME = '美食爱好者'
/** 昵称长度限制（小程序昵称输入框一般限制 4-30 字符，这里取更宽松的 1-20） */
const NICKNAME_MIN = 1
const NICKNAME_MAX = 20

/**
 * 入口函数
 * @param {object} event 前端 wx.cloud.callFunction({ data }) 传进来的参数
 */
exports.main = async (event = {}) => {
  // getWXContext() 在云函数里永远可信：由微信后台注入，前端无法篡改
  const { OPENID, APPID, UNIONID } = cloud.getWXContext()

  if (!OPENID) {
    return { code: 401, msg: '无法获取用户身份，请在小程序内调用' }
  }

  const action = event.action || 'login'

  try {
    switch (action) {
      case 'login':
        return await login(OPENID, { APPID, UNIONID })
      case 'updateProfile':
        return await updateProfile(OPENID, event.payload || {})
      case 'getProfile':
        return await getProfile(OPENID)
      default:
        return { code: 400, msg: `未知的 action：${action}` }
    }
  } catch (err) {
    // 打印完整错误到云函数日志，前端只拿到可读的提示
    console.error(`[user] ${action} 执行失败：`, err)
    return { code: 500, msg: err.message || '服务端异常' }
  }
}

/**
 * 登录：查不到就创建
 * 注意：云函数用的是「管理员权限」，add() 不会像小程序端那样自动补 _openid 字段，
 *      所以必须自己把 _openid 写进文档里，否则前端按 _openid 查不到自己的数据。
 */
async function login(openid, extra = {}) {
  const { data } = await users.where({ _openid: openid }).limit(1).get()

  // ---------- 老用户 ----------
  if (data.length > 0) {
    const user = data[0]
    // 顺手更新一下最后登录时间（用服务端时间，避免手机时间不准）
    await users.doc(user._id).update({
      data: { lastLoginTime: db.serverDate() }
    })
    return { code: 0, data: { ...user, lastLoginTime: new Date() }, isNew: false }
  }

  // ---------- 新用户 ----------
  const newUser = {
    _openid: openid, // 关键：手动写入，作为本项目的「用户唯一标识」
    appid: extra.APPID || '',
    unionid: extra.UNIONID || '',
    nickName: DEFAULT_NICKNAME, // 用户还没授权昵称时先用默认值
    avatarUrl: '', // 空字符串代表「暂无头像」，前端用占位插画兜底
    role: 'normal', // normal = 普通成员；后续家庭组里会有 parent（家长）
    familyId: '', // 所属家庭组，第一步留空
    createTime: db.serverDate(), // 服务端时间戳（Date 类型）
    lastLoginTime: db.serverDate()
  }

  const addRes = await users.add({ data: newUser })
  // add() 只返回 _id，重新查一次拿到带 _openid 的完整文档给前端
  const { data: created } = await users.doc(addRes._id).get()

  return { code: 0, data: created, isNew: true }
}

/**
 * 更新资料：只允许改白名单字段，防止前端顺手把 role / familyId 改掉
 */
async function updateProfile(openid, payload) {
  const patch = {}

  if (typeof payload.nickName === 'string') {
    const nickName = payload.nickName.trim()
    if (nickName.length < NICKNAME_MIN || nickName.length > NICKNAME_MAX) {
      return { code: 400, msg: `昵称长度需在 ${NICKNAME_MIN}-${NICKNAME_MAX} 个字符之间` }
    }
    patch.nickName = nickName
  }

  if (typeof payload.avatarUrl === 'string' && payload.avatarUrl !== '') {
    patch.avatarUrl = payload.avatarUrl
  }

  if (Object.keys(patch).length === 0) {
    return { code: 400, msg: '没有需要更新的字段' }
  }

  patch.updateTime = db.serverDate()

  const { data } = await users.where({ _openid: openid }).limit(1).get()
  if (data.length === 0) {
    return { code: 404, msg: '用户不存在，请重新进入小程序' }
  }

  await users.doc(data[0]._id).update({ data: patch })
  return { code: 0, data: { ...data[0], ...patch } }
}

/** 拉取最新资料（换手机登录 / 多端同步时用） */
async function getProfile(openid) {
  const { data } = await users.where({ _openid: openid }).limit(1).get()
  if (data.length === 0) return { code: 404, msg: '用户不存在' }
  return { code: 0, data: data[0] }
}
