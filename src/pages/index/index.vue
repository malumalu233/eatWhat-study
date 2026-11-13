<template>
  <view class="page">
    <!-- ============ 顶部问候区 ============ -->
    <view class="hero anim-up">
      <view class="hero__text">
        <text class="hero__greeting">{{ greeting }}</text>
        <text class="hero__name">{{ nickName }}</text>
        <text class="hero__tip">{{ todayTip }}</text>
      </view>
      <!-- 手绘简笔小碗（纯 CSS 插画，替换设计素材时改这里即可） -->
      <LineArt type="bowl" size="md" />
    </view>

    <!-- ============ 登录引导（静默登录失败时才出现） ============ -->
    <view v-if="!userStore.logged" class="login-card anim-up anim-up--delay1">
      <text class="t-title">还没有登录</text>
      <text class="t-helper login-card__desc">
        登录后会为你建立一个云端的「美食档案」，头像昵称随时可以改
      </text>
      <button class="btn login-card__btn" :loading="userStore.loading" @tap="handleLogin">
        {{ userStore.loading ? '登录中…' : '微信快捷登录' }}
      </button>
    </view>

    <!-- ============ 两个核心功能入口 ============ -->
    <view class="actions">
      <view class="action-card anim-up anim-up--delay1" @tap="goCreateDish">
        <view class="action-card__art">
          <LineArt type="plate" size="sm" />
        </view>
        <text class="action-card__title">录入菜品</text>
        <text class="action-card__desc">把家里的拿手菜存起来</text>
      </view>

      <view class="action-card action-card--accent anim-up anim-up--delay2" @tap="goDishList">
        <view class="action-card__art">
          <LineArt type="bowl" size="sm" />
        </view>
        <text class="action-card__title">今天吃什么</text>
        <text class="action-card__desc">纠结的时候交给它决定</text>
      </view>
    </view>

    <!-- ============ 最近点菜（第四步接入真实数据） ============ -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">最近点菜</text>
        <text class="section__extra">最近 {{ RECENT_SIZE }} 次</text>
      </view>

      <view v-if="recentOrders.length === 0" class="empty anim-fade">
        <LineArt type="plate" size="sm" />
        <text class="empty__text">还没有点菜记录，先去「今天吃什么」选几道菜吧</text>
      </view>

      <view v-else class="record-list">
        <view v-for="order in recentOrders" :key="order._id" class="record-item anim-up">
          <!-- 左侧：餐次大标签，四餐各自一套主题色（与结算页的单选组同一份配置） -->
          <view class="meal-tag" :style="{ backgroundColor: mealOf(order).color }">
            <text class="meal-tag__text" :style="{ color: mealOf(order).textColor }">
              {{ mealOf(order).label }}
            </text>
          </view>

          <!-- 中间：菜名（超过两道用省略号截断） -->
          <text class="record-item__dishes">{{ dishesText(order) }}</text>

          <!-- 右侧：日期右对齐，灰色小号字 -->
          <text class="record-item__date">{{ dateText(order.createTime) }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import LineArt from '@/components/LineArt.vue'
import { userStore, displayName } from '@/store/user'
import { loginSilently } from '@/api/user'
import { listOrders } from '@/api/dish'
import { getMealMeta } from '@/config'

/** 首页只展示最近 3 条订单：多了会抢首页的呼吸感，也增加无关请求 */
const RECENT_SIZE = 3

/** 最近点菜列表（来自 orders 集合） */
const recentOrders = ref([])

/** 按时间段给一句问候，长辈也能一眼看懂 */
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

/** 顶部展示的称呼：登录后显示昵称，未登录显示暖场文案 */
const nickName = computed(() => {
  if (userStore.logged && userStore.profile) return displayName.value
  return '今天想吃点什么呢'
})

/** 每天换一句治愈系文案，让首页有呼吸感 */
const TIPS = [
  '好好吃饭，是件很温柔的事',
  '厨房里的烟火气，最治人心',
  '一碗热汤，就能把一天安顿好',
  '不着急，慢慢来，先想想吃什么',
  '今天的饭，也要好好吃呀'
]
const todayTip = computed(() => {
  const day = new Date().getDay()
  return TIPS[day % TIPS.length]
})

/**
 * 拉「最近点菜」
 *
 * 为什么只拉 3 条？
 * 首页是展示性的，用户真要管理订单时会去订单页（后续步骤）。
 * 3 条足够提醒「上一餐吃了什么」，同时把首屏请求压到最小。
 */
async function loadRecentOrders() {
  try {
    const res = await listOrders({ page: 1, pageSize: RECENT_SIZE })
    recentOrders.value = (res && res.list) || []
  } catch (err) {
    // 首页不能因为订单查询失败就白屏：记日志，静默降级成空列表
    console.error('[home] 加载最近点菜失败：', err)
    recentOrders.value = []
  }
}

/** 取餐次配置（文字 + 配色）；非法值由 getMealMeta 兜底成宵夜，页面不会出现空白标签 */
function mealOf(order) {
  return getMealMeta(order && order.mealTime)
}

/**
 * 中间那行的菜名
 * - 1~2 道：全部列出，颠号连接
 * - 超过 2 道：只留前两道 + 省略号 + 总数，否则一行文字会把日期挤掉
 */
function dishesText(order) {
  const names = ((order && order.items) || []).map((item) => item.name).filter(Boolean)
  if (names.length === 0) return '空订单'
  if (names.length <= 2) return names.join('、')
  return `${names.slice(0, 2).join('、')}…等${names.length}道`
}

/** 时间戳 → MM-dd（右侧灰色小字，长辈看日期比看时间更有用） */
function dateText(ts) {
  const date = new Date(ts || Date.now())
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`)
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * 每次页面显示时检查登录态：
 * 如果首屏登录失败（比如云环境还没配好），用户重进页面会自动重试
 *
 * 顺便刷新「最近点菜」：从结算页 switchTab 回来时必须能看到刚下的单，
 * 所以这里不做缓存、每次 onShow 都拉一次（就 3 条，开销可忽略）。
 */
onShow(async () => {
  if (!userStore.logged && !userStore.loading) {
    await loginSilently()
  }
  loadRecentOrders()
})

/** 手动点「微信快捷登录」 */
async function handleLogin() {
  const profile = await loginSilently()
  if (profile) {
    uni.showToast({ title: '登录成功', icon: 'none' })
  } else {
    uni.showToast({ title: '登录失败，请检查云开发配置', icon: 'none' })
  }
}

/**
 * 进入菜品录入页
 *
 * 为什么用 navigateTo 而不是 Tab / 弹窗？
 * navigateTo 打开的是「二级页面」：三个主 Tab 不受影响，原生导航栏自带上返回按钮，
 * 编辑完成后 navigateBack 就回到首页，状态还在。
 */
async function goCreateDish() {
  // 没登录时先尝试静默登录（拿 openid 用于图片目录与 _openid 归属）
  if (!userStore.logged && !userStore.loading) {
    await loginSilently()
  }
  uni.navigateTo({ url: '/pages/dish/edit' })
}

/**
 * 进入菜品列表页（第三步新增）
 *
 * 和录入页一样是「二级页面」：底部 Tab 不受影响，返回后首页状态还在。
 */
async function goDishList() {
  if (!userStore.logged && !userStore.loading) {
    // 列表要按 _openid 查自己的菜，没登录先静默登录一次
    await loginSilently()
  }
  uni.navigateTo({ url: '/pages/dish/list' })
}
</script>

<style lang="scss" scoped>
/* ---------------- 顶部问候 ---------------- */
.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $gap-lg;
  border-radius: $r-lg;
  /* 极浅的暖色渐变，营造晨光感 */
  background: linear-gradient(135deg, #fffdf9 0%, #fff2e4 100%);
  box-shadow: $shadow-soft;
}
.hero__text {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-right: $gap-md;
}
.hero__greeting {
  font-size: $f-helper;
  color: $c-text-sub;
}
.hero__name {
  margin-top: $gap-xs;
  font-size: 40rpx;
  font-weight: 600;
  line-height: 1.35;
  color: $c-coffee;
}
.hero__tip {
  margin-top: $gap-sm;
  font-size: $f-helper;
  color: $c-text-sub;
  line-height: 1.7;
}

/* ---------------- 登录引导 ---------------- */
.login-card {
  margin-top: $gap-md;
  padding: $gap-lg;
  border-radius: $r-lg;
  background-color: $c-white;
  box-shadow: $shadow-soft;
  display: flex;
  flex-direction: column;
}
.login-card__desc {
  margin-top: $gap-sm;
}
.login-card__btn {
  margin-top: $gap-md;
  width: 100%;
}

/* ---------------- 功能入口 ---------------- */
.actions {
  display: flex;
  justify-content: space-between;
  margin-top: $gap-md;
}
.action-card {
  width: 48%;
  padding: $gap-lg $gap-md;
  border-radius: $r-lg;
  background-color: $c-white;
  box-shadow: $shadow-soft;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  box-sizing: border-box;
  transition: transform 0.18s ease;

  &:active {
    transform: translateY(-4rpx) scale(0.985);
  }
}
/* 主要入口用抹茶绿轻铺底，与次入口拉开层次但不抢眼 */
.action-card--accent {
  background: linear-gradient(160deg, #f2f7ef 0%, #e3eedd 100%);
}
.action-card__art {
  height: 96rpx;
  display: flex;
  align-items: center;
}
.action-card__title {
  margin-top: $gap-sm;
  font-size: 30rpx;
  font-weight: 600;
  color: $c-coffee;
}
.action-card__desc {
  margin-top: $gap-xs;
  font-size: $f-helper;
  color: $c-text-sub;
  line-height: 1.6;
}

/* ---------------- 最近点菜 ---------------- */
/* 需求明确：单条记录是「圆角 12rpx 白底卡片 + 柔和投影」，垂直流式排列 */
.section__extra {
  font-size: 22rpx;
  color: $c-text-sub;
}
.record-list {
  display: flex;
  flex-direction: column;
}
.record-item {
  display: flex;
  align-items: center;
  margin-bottom: $gap-sm;
  padding: $gap-md;
  border-radius: $r-sm;
  background-color: $c-white;
  box-shadow: $shadow-soft;
  transition: transform 0.16s ease;

  &:last-child {
    margin-bottom: 0;
  }
  /* 轻微按下反馈，替代系统灰底高亮 */
  &:active {
    transform: scale(0.985);
  }
}

/* 左侧餐次大标签：固定宽高，四餐各自的主题色由 :style 绑定 */
.meal-tag {
  width: 96rpx;
  height: 56rpx;
  flex-shrink: 0;
  border-radius: $r-sm;
  display: flex;
  align-items: center;
  justify-content: center;
}
.meal-tag__text {
  font-size: 24rpx;
  font-weight: 600;
}

/* 中间菜名：flex:1 负责占满，min-width:0 才能让单行省略生效 */
.record-item__dishes {
  flex: 1;
  min-width: 0;
  margin: 0 $gap-sm;
  font-size: $f-body;
  color: $c-coffee;
  @include ellipsis;
}

/* 右侧日期：右对齐、灰色小号 22rpx */
.record-item__date {
  flex-shrink: 0;
  font-size: 22rpx;
  color: $c-text-sub;
}
/* empty 里的两行文案需要贴紧一点，覆盖全局 12rpx 的间距 */
.empty__text + .empty__text {
  margin-top: 0;
}
</style>
