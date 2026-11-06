<script>
import { initCloud } from '@/utils/cloud'
import { loginSilently } from '@/api/user'
import { userStore } from '@/store/user'

/**
 * App.vue 是「应用实例」，不是页面：
 * - 它没有 <template>，不会渲染任何 UI
 * - onLaunch 整个小程序生命周期内只触发一次（冷启动）
 * - 这里适合做「全局初始化」：初始化云开发、静默登录、读取本地缓存
 *
 * 注意：uni-app 的 App 级生命周期必须写在 export default 的选项式 API 里，
 * Vue3 的 <script setup> 不支持 onLaunch/onShow 这类小程序生命周期。
 */
export default {
  onLaunch() {
    console.log('[App] onLaunch —— 小程序冷启动')

    // ① 先把本地缓存的用户信息读出来，让首屏不至于空白
    const cached = uni.getStorageSync('userProfile')
    if (cached && cached._openid) {
      userStore.profile = cached
      userStore.logged = true
    }

    // ② 初始化微信云开发（必须在调用任何云函数 / 云数据库之前执行）
    const cloudReady = initCloud()
    if (!cloudReady) return

    // ③ 静默登录：云开发环境下拿到 openid 是「免鉴权」的，
    //    用户无感知，不需要点按钮，也不会有授权弹窗
    loginSilently()
  },

  onShow() {
    console.log('[App] onShow —— 小程序进入前台')
  },

  onHide() {
    console.log('[App] onHide —— 小程序进入后台')
  },

  // 全局兜底：任何未捕获的 Promise 异常都会走到这里，方便排查问题
  onError(err) {
    console.error('[App] 全局异常：', err)
  }
}
</script>

<style lang="scss">
/* ========================================================================
   全局样式（不加 scoped → 会编译进 app.wxss，对所有页面生效）
   设计语言：温馨日系治愈风 + 简约圆角扁平化
   ======================================================================== */

page {
  /* 用 CSS 变量再暴露一份色板：wxml 里可以直接写 var(--c-apricot)，
     方便日后做「夜间模式 / 主题换肤」时只改一处 */
  --c-cream: #fff9f0;
  --c-apricot: #ffb88c;
  --c-matcha: #d6e4d0;
  --c-gray: #eaeaea;
  --c-coffee: #5c4b3e;
  --c-text-sub: #9c9189;
  --c-white: #ffffff;
  --r-sm: 12rpx;
  --r-md: 24rpx;
  --r-lg: 32rpx;

  background-color: $c-cream;
  color: $c-coffee;
  /* 微信小程序默认就是 PingFang SC（iOS）/ 系统字体（安卓），显式声明更稳 */
  font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  font-size: $f-body;
  line-height: $lh-body;
  -webkit-font-smoothing: antialiased;
}

/* ---------------- 布局容器 ---------------- */
/* 每个页面最外层都用 .page：统一左右留白 + 底部安全区 */
.page {
  min-height: 100vh;
  padding: $gap-md $gap-lg calc(#{$gap-xl} + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

/* 卡片：白底 + 大圆角 + 极柔阴影，是全站最基础的视觉单元 */
.card {
  @include card;
  padding: $gap-lg;
}

/* ---------------- 文字层级 ---------------- */
/* 标题 18px 加粗 / 正文 14px / 辅助 12px，层级只靠字号+颜色区分，不靠花哨装饰 */
.t-title {
  font-size: $f-title;
  font-weight: 600;
  line-height: 1.4;
  color: $c-coffee;
}
.t-body {
  font-size: $f-body;
  color: $c-coffee;
}
.t-helper {
  font-size: $f-helper;
  color: $c-text-sub;
  line-height: 1.6;
}

/* ---------------- 按钮 ---------------- */
/* 小程序原生 <button> 自带边框、hover 灰底，这里统一重置成圆角扁平风 */
.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  padding: 0 $gap-lg;
  border: none;
  border-radius: $r-sm;
  font-size: 30rpx;
  font-weight: 500;
  line-height: 1;
  background-color: $c-apricot;
  color: $c-coffee; /* 暖橘杏底 + 深咖字：对比清晰又不刺眼 */
  transition: transform 0.18s ease, opacity 0.18s ease;

  /* 去掉小程序 button 默认的 1px 灰色边框（伪元素实现的） */
  &::after {
    border: none;
  }

  /* 按下时的轻微缩放，替代 iOS 的灰色高亮 */
  &:active {
    transform: scale(0.97);
    opacity: 0.88;
  }
}

/* 次要按钮：白底 + 柔和阴影，不使用硬边框 */
.btn--ghost {
  background-color: $c-white;
  color: $c-coffee;
  box-shadow: $shadow-soft;
}

/* 禁用态 */
.btn--disabled {
  background-color: $c-gray;
  color: $c-text-sub;
  pointer-events: none;
}

/* ---------------- 区块标题 ---------------- */
.section {
  margin-top: $gap-xl;
}
.section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $gap-md;
}
.section__title {
  font-size: 32rpx;
  font-weight: 600;
  color: $c-coffee;
}

/* ---------------- 空状态 ---------------- */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $gap-xl $gap-lg;
  background-color: $c-white;
  border-radius: $r-lg;
  box-shadow: $shadow-soft;
}
.empty__text {
  margin-top: $gap-md;
  font-size: $f-helper;
  color: $c-text-sub;
  text-align: center;
  line-height: 1.8;
}

/* ---------------- 标签 ---------------- */
.tag {
  display: inline-flex;
  align-items: center;
  height: 44rpx;
  padding: 0 $gap-sm;
  border-radius: $r-sm;
  font-size: $f-helper;
  color: $c-coffee;
  background-color: $c-matcha;
}

/* ---------------- 动效 ---------------- */
/* 规范要求：轻微淡入淡出、卡片上滑弹出，不要花哨动画 */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(28rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* both：动画结束后保持最后一帧，避免闪烁 */
.anim-fade {
  animation: fadeIn 0.45s ease both;
}
.anim-up {
  animation: fadeUp 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}
/* 用延迟做「依次出现」的节奏感 */
.anim-up--delay1 {
  animation-delay: 0.08s;
}
.anim-up--delay2 {
  animation-delay: 0.16s;
}
.anim-up--delay3 {
  animation-delay: 0.24s;
}
</style>
