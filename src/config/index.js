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
  user: 'user',
  dish: 'dish'
}

/**
 * 菜品类型（第二步固定这 4 个）
 *
 * ⚠️ 这是「唯一数据源」：录入页的类型 pill、列表页左侧的 Tab 都由它派生，
 * 想加一个「凉菜」只改这一行，两个页面会同时生效，不用改第二处。
 *
 * 预留的扩展方式：后续做「管理员自定义类型」时，
 * 在这里改为从云数据库 categories 集合拉取：
 *   const { data } = await getDB().collection('categories').get()
 * 页面只依赖这个数组，改数据源不用动 UI 代码。
 */
export const DISH_CATEGORIES = ['硬菜', '软菜', '素菜', '汤']

/**
 * 「爱吃」Tab：不是菜品的真实类型，只用于展示我收藏过的菜
 *
 * 为什么不把它塞进 DISH_CATEGORIES？
 * 因为录入菜品时绝不希望用户把一道菜的类型选成「爱吃」。
 * 所以它单独存在，只在列表页拼到 Tab 末尾。
 */
export const FAVORITE_TAB = '爱吃'

/**
 * 列表页左侧的 Tab 序列 = 录入页的全部类型 + 「爱吃」
 * 数组成员的顺序就是 Tab 的显示顺序。
 */
export const DISH_TABS = DISH_CATEGORIES.concat(FAVORITE_TAB)

/** 菜品表单的各类限制（前后端共用一份常量，改一处即可） */
export const DISH_LIMITS = {
  /** 最多上传几张图片（微信九宫格） */
  maxImages: 9,
  /** 菜名最大长度 */
  nameMax: 50,
  /** 制作步骤最大长度 */
  stepsMax: 500
}
