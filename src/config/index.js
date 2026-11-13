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

/**
 * 用餐时段（第四步新增）——「唯一数据源」的又一个例子
 *
 * 这一份数据同时被三个地方使用：
 *   ① 结算页 `pages/order/confirm.vue` 的单选按钮组（文字 + 选中底色）
 *   ② 首页「最近点菜」的餐次标签（文字 + 底色 + 文字色）
 *   ③ 云函数 `createOrder` 的合法值校验
 *
 * ⚠️ 云函数跑在 Node.js 里，不能 import 前端这份文件（构建产物不在一起），
 * 所以 `cloudfunctions/dish/index.js` 顶部维护了一份 MEAL_TIMES 字符串数组。
 * 加餐次时两边一起改 —— 这是「前后端各自构建」导致的必要重复，不是疏忽。
 *
 * 颜色取值来自需求：早餐暖橘杏 #FFB88C、午餐抹茶绿 #D6E4D0、
 * 晚餐浅灰 #EAEAEA、宵夜深抹茶 #C4D9BA。
 * textColor 是配套的文字色：浅底必须配深字，否则对比度不足、长辈看不清。
 */
export const MEAL_TIMES = [
  { value: 'breakfast', label: '早餐', color: '#FFB88C', textColor: '#8a5a2b' },
  { value: 'lunch', label: '午餐', color: '#D6E4D0', textColor: '#4c5c44' },
  { value: 'dinner', label: '晚餐', color: '#EAEAEA', textColor: '#6b6157' },
  { value: 'supper', label: '宵夜', color: '#C4D9BA', textColor: '#43553c' }
]

/**
 * 按 value 找餐次配置
 * 传入非法值时兜底返回「宵夜」而不是 undefined，
 * 这样页面上永远不会出现 `undefined` 或空白标签（老数据 / 手改数据库都可能造出脏值）。
 */
export function getMealMeta(value) {
  const found = MEAL_TIMES.find((item) => item.value === value)
  return found || MEAL_TIMES[MEAL_TIMES.length - 1]
}

/**
 * 订单状态枚举（第四步新增）
 *
 * 状态机：pending（待处理）→ completed（已完成）
 *                          ↘ cancelled（已取消）
 * 只允许「待处理」被取消，已完成的订单不能回退 —— 校验放在云函数里。
 * 本步只用到 pending 与 cancelled（取消入口留给后续的订单管理页）。
 */
export const ORDER_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
}

/** 订单相关限制（与云函数里的常量保持一致） */
export const ORDER_LIMITS = {
  /** 备注最多多少个字 */
  remarkMax: 200,
  /** 一单最多点几道菜：防止异常请求把数据库文档撑爆 */
  itemsMax: 50
}
