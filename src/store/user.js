import { reactive, computed } from 'vue'

/**
 * 极简「用户状态仓库」
 *
 * 为什么不用 Pinia / Vuex？
 * 第一步只有「当前登录用户」这一份共享状态，用 Vue3 的 reactive 全局单例就足够，
 * 不用额外装包、也不用在 main.js 里 app.use()。
 * 后续状态变多（菜品列表、点餐记录…）时再平滑迁移到 Pinia 也不迟。
 *
 * reactive 返回的对象在小程序端也是响应式的：
 * 页面模板里读了 userStore.profile，profile 变化时视图会自动更新。
 */
export const userStore = reactive({
  /** 云端用户记录（含 _id / _openid / nickName / avatarUrl ...），未登录为 null */
  profile: null,
  /** 是否已拿到云端身份 */
  logged: false,
  /** 请求进行中标记，用来做按钮 loading 与防抖 */
  loading: false
})

/** 展示用昵称：没登录或没昵称时给一个兜底文案 */
export const displayName = computed(() => {
  const name = userStore.profile && userStore.profile.nickName
  return name || '未登录'
})

/** 写入用户信息（同时写一份到本地缓存，下次冷启动先展示旧数据，避免白屏） */
export function setProfile(profile) {
  userStore.profile = profile
  userStore.logged = !!profile
  if (profile) {
    uni.setStorageSync('userProfile', profile)
  } else {
    uni.removeStorageSync('userProfile')
  }
}

/** 局部更新用户信息（改昵称/头像后只需更新变化的字段） */
export function patchProfile(patch) {
  if (!userStore.profile) return
  userStore.profile = { ...userStore.profile, ...patch }
  uni.setStorageSync('userProfile', userStore.profile)
}

/** 清空本地登录态（云开发没有「注销」接口，这里只是清本地缓存） */
export function clearProfile() {
  userStore.profile = null
  userStore.logged = false
  uni.removeStorageSync('userProfile')
}
