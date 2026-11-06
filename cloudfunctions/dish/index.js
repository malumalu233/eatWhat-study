/**
 * 云函数：dish（菜品）
 * ------------------------------------------------------------------
 * 支持的 action：
 *   createDish   新增菜品（第二步只启用这一个）
 *   updateDish   更新菜品（预留，第三步做完列表页后启用）
 *   listDishes   查询菜品列表（支持按类型/减脂标识过滤）
 *
 * 部署方式：微信开发者工具 → 右键 cloudfunctions/dish → 「上传并部署：云端安装依赖」
 * 前置条件：数据库里要有 dishes 集合（权限建议「仅创建者可读写」）
 */
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const dishes = db.collection('dishes')

/* 与前端 src/config/index.js 里的 DISH_LIMITS 保持一致 */
const NAME_MAX = 50
const STEPS_MAX = 500
const MAX_IMAGES = 9
const CATEGORY_MAX = 20

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()

  // 云函数拿到的 OPENID 由微信后台注入，前端无法伪造，可以直接当作用户身份
  if (!OPENID) {
    return { code: 401, msg: '无法获取用户身份，请在小程序内调用' }
  }

  const action = event.action

  try {
    switch (action) {
      case 'createDish':
        return await createDish(OPENID, event.data || {})
      case 'updateDish':
        return await updateDish(OPENID, event.data || {})
      case 'listDishes':
        return await listDishes(OPENID, event.filter || {})
      default:
        return { code: 400, msg: `未知的 action：${action}` }
    }
  } catch (err) {
    // 完整堆栈进云函数日志，前端只拿到可读提示
    console.error(`[dish] ${action} 执行失败：`, err)
    return { code: 500, msg: err.message || '服务端异常' }
  }
}

/* ==================== 新增 ==================== */

async function createDish(openid, data) {
  // ---------- 服务端再校验一遍 ----------
  // 前端校验只是为了体验，真正的防线必须在服务端：
  // 别人可以直接用 wx.cloud.callFunction 跳过你的表单。
  const name = typeof data.name === 'string' ? data.name.trim() : ''
  if (!name) return { code: 400, msg: '菜名不能为空' }
  if (name.length > NAME_MAX) return { code: 400, msg: `菜名不能超过 ${NAME_MAX} 个字` }

  const steps = typeof data.steps === 'string' ? data.steps.trim() : ''
  if (steps.length > STEPS_MAX) return { code: 400, msg: `制作步骤不能超过 ${STEPS_MAX} 个字` }

  const category = typeof data.category === 'string' ? data.category.trim() : ''
  if (!category) return { code: 400, msg: '请选择菜品类型' }
  if (category.length > CATEGORY_MAX) return { code: 400, msg: '菜品类型名称过长' }

  const images = Array.isArray(data.images) ? data.images : []
  if (images.length === 0) return { code: 400, msg: '请至少上传 1 张图片' }
  if (images.length > MAX_IMAGES) return { code: 400, msg: `最多上传 ${MAX_IMAGES} 张图片` }

  // 必须是云存储 fileID：防止前端塞外链（外链会过期，还会被当成图床滥用）
  const invalid = images.find((item) => typeof item !== 'string' || !item.startsWith('cloud://'))
  if (invalid !== undefined) return { code: 400, msg: '图片格式不合法，请重新上传' }

  const now = Date.now()
  const doc = {
    // 云函数里 add() 不会自动补 _openid，必须手动写，否则以后按 _openid 查不到自己的数据
    _openid: openid,
    name,
    images,
    steps,
    category,
    // 强制转布尔，避免前端传 "false" 字符串被当成 true
    isDietFriendly: data.isDietFriendly === true,
    createTime: now, // 数字时间戳，前端直接 new Date(createTime) 就能格式化
    updateTime: now
  }

  const res = await dishes.add({ data: doc })
  return { code: 0, data: { _id: res._id, ...doc } }
}

/* ==================== 更新（预留） ==================== */

/**
 * 注意：第二步还没有编辑页，这里先把「归属校验」写好，
 * 第三步直接调用即可，不用再回头补权限判断。
 */
async function updateDish(openid, data) {
  const _id = data._id
  if (!_id) return { code: 400, msg: '缺少菜品 _id' }

  let old
  try {
    const res = await dishes.doc(_id).get()
    old = res.data
  } catch (err) {
    // 文档不存在时 doc().get() 会抛错，这里统一转成友好的 404
    return { code: 404, msg: '菜品不存在' }
  }

  // 归属校验：只能改自己录的菜
  if (old._openid !== openid) {
    return { code: 403, msg: '只能修改自己录入的菜品' }
  }

  const patch = {}

  if (typeof data.name === 'string') {
    const name = data.name.trim()
    if (!name || name.length > NAME_MAX) return { code: 400, msg: '菜名不合法' }
    patch.name = name
  }
  if (typeof data.steps === 'string') {
    const steps = data.steps.trim()
    if (steps.length > STEPS_MAX) return { code: 400, msg: '制作步骤过长' }
    patch.steps = steps
  }
  if (typeof data.category === 'string' && data.category.trim()) {
    patch.category = data.category.trim()
  }
  if (Array.isArray(data.images) && data.images.length > 0) {
    if (data.images.length > MAX_IMAGES) return { code: 400, msg: '图片数量超出限制' }
    patch.images = data.images
  }
  if (typeof data.isDietFriendly === 'boolean') {
    patch.isDietFriendly = data.isDietFriendly
  }

  if (Object.keys(patch).length === 0) return { code: 400, msg: '没有需要更新的字段' }

  patch.updateTime = Date.now()
  await dishes.doc(_id).update({ data: patch })
  return { code: 0, data: { ...old, ...patch } }
}

/* ==================== 查询 ==================== */

/**
 * 列表查询
 * @param {string} openid 调用者
 * @param {object} filter { category?, isDietFriendly?, page?, pageSize? }
 *
 * 为什么默认只查 _openid = 自己？
 * 云函数是管理员权限，不加条件就会把所有人的菜品都返回给前端，
 * 这是最常见的越权漏洞。等「饭圈」那一步再显式放开 scope。
 */
async function listDishes(openid, filter = {}) {
  const where = { _openid: openid }

  if (filter.category) where.category = filter.category
  if (typeof filter.isDietFriendly === 'boolean') where.isDietFriendly = filter.isDietFriendly

  const page = Math.max(1, Number(filter.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(filter.pageSize) || 20))

  const { data } = await dishes
    .where(where)
    .orderBy('createTime', 'desc') // 新的在前
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  const { total } = await dishes.where(where).count()

  return { code: 0, data: { list: data, total, page, pageSize } }
}
