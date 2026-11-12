/**
 * 云函数：dish（菜品）
 * ------------------------------------------------------------------
 * 支持的 action：
 *   createDish     新增菜品
 *   updateDish     更新菜品（只能改自己录的菜）
 *   listDishes     查询菜品列表（支持按类型 / 减脂标识 /「爱吃」收藏过滤）
 *   getDish        查询单条菜品详情
 *   toggleFavorite 收藏 / 取消收藏（同一个 action 切换一次）
 *
 * 部署方式：微信开发者工具 → 右键 cloudfunctions/dish → 「上传并部署：云端安装依赖」
 * 前置条件：数据库里要有两个集合
 *   dishes     菜品   权限：仅创建者可读写
 *   favorites  收藏   权限：仅创建者可读写
 *   两个集合都需要建 createTime 降序索引（数据量小的时候不建也能跑，但养成习惯）
 */
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const dishes = db.collection('dishes')
/* 第三步新增：用户收藏表。一条记录 = 「某个用户收藏了某道菜」 */
const favorites = db.collection('favorites')
/**
 * 数据库指令集合，等价于 SQL 里的运算符：
 *   _.inc(1)  → 原子自增（不是「先读出来 +1 再写回去」，不会有并发丢数问题）
 *   _.in([..])→ WHERE id IN (...)
 * 注意：指令对象只能在「交给数据库的请求」里用，不能自己 JSON 打印出来看。
 */
const _ = db.command

/* 与前端 src/config/index.js 里的 DISH_LIMITS 保持一致 */
const NAME_MAX = 50
const STEPS_MAX = 500
const MAX_IMAGES = 9
const CATEGORY_MAX = 20
/* 一个人最多能收藏多少道菜：防止异常数据把内存和查询次数拉满 */
const FAVORITES_MAX = 200

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
      case 'getDish':
        return await getDish(OPENID, event.data || {})
      case 'toggleFavorite':
        return await toggleFavorite(OPENID, event.data || {})
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
    // 收藏数从 0 开始；「爱吃」Tab 与卡片右上角星标都读它
    favoriteCount: 0,
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
 * @param {object} filter { category?, isDietFriendly?, onlyFavorite?, page?, pageSize? }
 *
 * 为什么默认只查 _openid = 自己？
 * 云函数是管理员权限，不加条件就会把所有人的菜品都返回给前端，
 * 这是最常见的越权漏洞。等「家庭组 / 饭圈」那一步再显式放开 scope。
 */
async function listDishes(openid, filter = {}) {
  const page = Math.max(1, Number(filter.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(filter.pageSize) || 20))

  // ---------- 分支一：「爱吃」Tab（先查收藏表，再按 _id 批量取菜） ----------
  if (filter.onlyFavorite === true) {
    const favRes = await favorites
      .where({ _openid: openid })
      .orderBy('createTime', 'desc')
      .limit(FAVORITES_MAX)
      .get()

    const dishIds = favRes.data.map((item) => item.dishId).filter(Boolean)
    // 一条收藏都没有：直接返回空数组，省掉一次数据库查询
    if (dishIds.length === 0) {
      return { code: 0, data: { list: [], total: 0, page, pageSize } }
    }

    // 这里的 in 查询就是 SQL 的 WHERE _id IN (...)；
    // 同时带上 _openid，避免把别人的菜查出来
    const where = { _openid: openid, _id: _.in(dishIds) }

    const { data } = await dishes
      .where(where)
      .orderBy('createTime', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    const { total } = await dishes.where(where).count()

    // 走到这里的菜一定都收藏过，直接把 dishIds 当成「已收藏列表」打标记
    return { code: 0, data: { list: withFavoriteState(data, dishIds), total, page, pageSize } }
  }

  // ---------- 分支二：普通分类 ----------
  const where = { _openid: openid }

  if (filter.category) where.category = filter.category
  if (typeof filter.isDietFriendly === 'boolean') where.isDietFriendly = filter.isDietFriendly

  const { data } = await dishes
    .where(where)
    .orderBy('createTime', 'desc') // 新的在前
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  const { total } = await dishes.where(where).count()

  // 再查一次收藏表，给当前这一页的菜标上「我有没有收藏」
  const favoriteIds = await findMyFavoriteIds(openid, data.map((item) => item._id))

  return { code: 0, data: { list: withFavoriteState(data, favoriteIds), total, page, pageSize } }
}

/* ==================== 详情 ==================== */

async function getDish(openid, data) {
  const _id = data._id
  if (!_id) return { code: 400, msg: '缺少菜品 _id' }

  let doc
  try {
    // 注意：doc().get() 查不到会抛异常，这里转成友好的 404
    const res = await dishes.doc(_id).get()
    doc = res.data
  } catch (err) {
    return { code: 404, msg: '菜品不存在' }
  }

  // 可见性校验：暂定只能看自己录的菜（家庭组开放后这里改成「同组成员」判断）
  if (doc._openid !== openid) {
    return { code: 403, msg: '无权查看该菜品' }
  }

  const favoriteIds = await findMyFavoriteIds(openid, [_id])
  return { code: 0, data: withFavoriteState([doc], favoriteIds)[0] }
}

/* ==================== 收藏 ==================== */

/**
 * 收藏 / 取消收藏
 *
 * 两步写操作必须按顺序做：先动收藏表，再动菜品表的计数。
 * 中途失败的极端情况可能导致计数与实际收藏条数不一致，
 * 家庭场景下影响很小（相当于少一个星标数），不值得引入事务的复杂度。
 */
async function toggleFavorite(openid, data) {
  const dishId = data.dishId
  if (!dishId) return { code: 400, msg: '缺少菜品 id' }

  let dish
  try {
    const res = await dishes.doc(dishId).get()
    dish = res.data
  } catch (err) {
    return { code: 404, msg: '菜品不存在' }
  }

  // 只能收藏自己看得见的菜（以后放开家庭组时，这里换成同组校验）
  if (dish._openid !== openid) {
    return { code: 403, msg: '无权收藏该菜品' }
  }

  const currentCount = typeof dish.favoriteCount === 'number' ? dish.favoriteCount : 0

  // 先看收藏表里有没有这条记录，有就取消，没有就新增
  const existed = await favorites.where({ _openid: openid, dishId }).limit(1).get()

  if (existed.data.length > 0) {
    await favorites.doc(existed.data[0]._id).remove()
    // 原子自减，避免「读出来 3 → 减 1 → 写回 2」覆盖掉别人刚加的 1
    await dishes.doc(dishId).update({ data: { favoriteCount: _.inc(-1) } })
    return {
      code: 0,
      data: { isFavorite: false, favoriteCount: Math.max(0, currentCount - 1) }
    }
  }

  await favorites.add({
    data: {
      // 同样要手动写 _openid，理由同 createDish
      _openid: openid,
      dishId,
      createTime: Date.now()
    }
  })
  await dishes.doc(dishId).update({ data: { favoriteCount: _.inc(1) } })

  return { code: 0, data: { isFavorite: true, favoriteCount: currentCount + 1 } }
}

/* ==================== 收藏相关小工具 ==================== */

/** 查「我」收藏了 dishIds 里的哪几道菜 */
async function findMyFavoriteIds(openid, dishIds = []) {
  if (!dishIds || dishIds.length === 0) return []

  const { data } = await favorites
    .where({ _openid: openid, dishId: _.in(dishIds) })
    .limit(100)
    .get()

  return data.map((item) => item.dishId)
}

/**
 * 给菜品补上收藏相关的两个字段
 * - favoriteCount：第二步录入的老数据没有这个字段，读出来是 undefined，兜底成 0
 * - isFavorite：当前用户是否收藏过（决定星标是 ★ 还是 ☆）
 */
function withFavoriteState(list = [], favoriteIds = []) {
  return list.map((doc) => ({
    ...doc,
    favoriteCount: typeof doc.favoriteCount === 'number' ? doc.favoriteCount : 0,
    isFavorite: favoriteIds.indexOf(doc._id) > -1
  }))
}
