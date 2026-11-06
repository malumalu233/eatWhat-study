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
      <view class="action-card anim-up anim-up--delay1" @tap="onTodo('录入菜品')">
        <view class="action-card__art">
          <LineArt type="plate" size="sm" />
        </view>
        <text class="action-card__title">录入菜品</text>
        <text class="action-card__desc">把家里的拿手菜存起来</text>
      </view>

      <view class="action-card action-card--accent anim-up anim-up--delay2" @tap="onTodo('今天吃什么')">
        <view class="action-card__art">
          <LineArt type="bowl" size="sm" />
        </view>
        <text class="action-card__title">今天吃什么</text>
        <text class="action-card__desc">纠结的时候交给它决定</text>
      </view>
    </view>

    <!-- ============ 历史点菜记录 ============ -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">最近点菜</text>
      </view>

      <view v-if="records.length === 0" class="empty anim-fade">
        <LineArt type="bowl" size="sm" />
        <text class="empty__text">还没有点菜记录</text>
      </view>

      <!-- 后续步骤会渲染真实记录，这里保留列表结构方便你对照 -->
      <view v-else class="record-list">
        <view v-for="item in records" :key="item._id" class="record-item">
          <text class="record-item__name">{{ item.name }}</text>
          <text class="t-helper">{{ item.time }}</text>
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

/** 点菜记录：第一步只留空数组，等第五步再接云数据库 */
const records = ref([])

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
 * 每次页面显示时检查登录态：
 * 如果首屏登录失败（比如云环境还没配好），用户重进页面会自动重试
 */
onShow(() => {
  if (!userStore.logged && !userStore.loading) {
    loginSilently()
  }
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

/** 第一步只搭骨架，后续功能用 toast 占位，避免误以为已经实现 */
function onTodo(name) {
  uni.showToast({
    title: `「${name}」将在后续步骤实现`,
    icon: 'none'
  })
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

/* ---------------- 点菜记录 ---------------- */
.record-list {
  background-color: $c-white;
  border-radius: $r-lg;
  box-shadow: $shadow-soft;
  overflow: hidden;
}
.record-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $gap-md $gap-lg;
  border-bottom: 1rpx solid $c-gray;

  &:last-child {
    border-bottom: none;
  }
}
.record-item__name {
  font-size: $f-body;
  color: $c-coffee;
}
/* empty 里的两行文案需要贴紧一点，覆盖全局 12rpx 的间距 */
.empty__text + .empty__text {
  margin-top: 0;
}
</style>
