<template>
  <view class="page">
    <!-- ============ 整页加载态 ============ -->
    <view v-if="loading" class="state">
      <LineArt type="plate" size="md" />
      <text class="t-helper state__text">正在翻开这道菜…</text>
    </view>

    <!-- ============ 加载失败 / 菜品不存在 ============ -->
    <view v-else-if="!dish" class="state">
      <LineArt type="bowl" size="md" />
      <text class="t-helper state__text">没有找到这道菜，可能已经被删掉了</text>
      <view class="state__btn" @tap="goBack">
        <text class="state__btn-text">返回列表</text>
      </view>
    </view>

    <!-- ============ 正文 ============ -->
    <block v-else>
      <!-- 图片轮播 -->
      <view class="gallery anim-fade">
        <swiper
          class="gallery__swiper"
          :circular="images.length > 1"
          :indicator-dots="images.length > 1"
          indicator-color="rgba(255, 255, 255, 0.5)"
          indicator-active-color="#ffb88c"
          @change="onSwiperChange"
        >
          <swiper-item v-for="(img, index) in images" :key="index">
            <!-- 点击看大图：fileID 可以直接给 image / previewImage 用 -->
            <image class="gallery__img" :src="img" mode="aspectFill" @tap="preview(index)" />
          </swiper-item>
        </swiper>

        <!-- 张数角标：轮播自带的小圆点在全屏图上看不清，这里再补一个明确的 -->
        <view v-if="images.length > 1" class="gallery__count">
          <text class="gallery__count-text">{{ current + 1 }} / {{ images.length }}</text>
        </view>
      </view>

      <!-- 标题与标签 -->
      <view class="head anim-up">
        <view class="head__top">
          <text class="head__name">{{ dish.name }}</text>

          <!-- 收藏：与列表页的星标是同一个接口，状态互通 -->
          <view class="fav" :class="{ 'fav--on': dish.isFavorite }" @tap="onToggleFavorite">
            <text class="fav__star">{{ dish.isFavorite ? '★' : '☆' }}</text>
            <text class="fav__count">{{ dish.favoriteCount || 0 }}</text>
          </view>
        </view>

        <view class="tags">
          <text class="tag tag--category">{{ dish.category }}</text>
          <text v-if="dish.isDietFriendly" class="tag tag--diet">✓ 减脂友好</text>
        </view>

        <text class="t-helper head__meta">{{ dateText }}</text>
      </view>

      <!-- 制作步骤 -->
      <view class="block anim-up anim-up--delay1">
        <view class="block__head">
          <text class="block__title">制作步骤</text>
          <LineArt type="bowl" size="sm" />
        </view>

        <!-- 步骤用 text 而不是 view：text 会保留换行，从录入页敲的回车能原样显示 -->
        <view v-if="dish.steps" class="steps">
          <text class="steps__text">{{ dish.steps }}</text>
        </view>
        <text v-else class="t-helper">这道菜还没有写步骤，下次做的时候可以补上</text>
      </view>
    </block>

    <!-- ============ 底部操作条：只有自己录的菜才出现「修改」 ============ -->
    <view v-if="dish && canEdit" class="footer">
      <button class="btn footer__btn" @tap="goEdit">修改菜品</button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import LineArt from '@/components/LineArt.vue'
import { getDish, toggleFavorite } from '@/api/dish'
import { userStore } from '@/store/user'

/** 菜品 _id：从页面路径 ?_id=xxx 拿，不依赖上一页传对象 */
const dishId = ref('')

/** 菜品数据；null 表示没查到 */
const dish = ref(null)

/** 首次加载标记：只有第一次进页面才显示整页 loading，从修改页返回时静默刷新 */
const loading = ref(true)

/** 收藏请求进行中，防连点 */
const favBusy = ref(false)

/** 当前轮播到第几张，用于右下角 1/3 角标 */
const current = ref(0)

const images = computed(() => {
  if (!dish.value || !Array.isArray(dish.value.images)) return []
  return dish.value.images
})

/**
 * 能不能修改？
 *
 * 现在dish只对自己可见，所以「自己的菜」= 能改。
 * 等家庭组开放后，这里换成服务端返回的 canEdit（谁能改谁不能改必须由服务端说了算，
 * 前端这个判断只决定「按钮显不显示」，真正的拦截在 updateDish 的归属校验里）。
 */
const canEdit = computed(() => {
  if (!dish.value || !userStore.profile) return false
  return dish.value._openid === userStore.profile._openid
})

/** 收录日期：createTime 是数字时间戳，直接 new Date 就能格式化 */
const dateText = computed(() => {
  if (!dish.value || !dish.value.createTime) return ''
  const d = new Date(dish.value.createTime)
  return `收录于 ${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`
})

/* ==================== 数据 ==================== */

async function load() {
  if (!dishId.value) return

  try {
    dish.value = await getDish(dishId.value)
  } catch (err) {
    console.error('[dish-detail] 加载失败：', err)
    dish.value = null
    uni.showToast({ title: err.message || '加载失败，请稍后重试', icon: 'none' })
  } finally {
    loading.value = false
  }
}

/* ==================== 交互 ==================== */

function onSwiperChange(e) {
  current.value = e.detail.current
}

/** 全屏预览：urls 传整组，才能左右滑动看其它图 */
function preview(index) {
  uni.previewImage({
    urls: images.value,
    current: images.value[index]
  })
}

async function onToggleFavorite() {
  if (favBusy.value || !dish.value) return
  favBusy.value = true

  try {
    const res = await toggleFavorite(dish.value._id)
    // 用服务端返回的最新值覆盖，前端不自己算加减
    dish.value.isFavorite = res.isFavorite
    dish.value.favoriteCount = res.favoriteCount

    // 通知列表页把这一条同步更新，返回时不用整页重拉
    uni.$emit('dish:favorite-changed', {
      _id: dish.value._id,
      isFavorite: res.isFavorite,
      favoriteCount: res.favoriteCount
    })
  } catch (err) {
    console.error('[dish-detail] 收藏失败：', err)
    uni.showToast({ title: err.message || '操作失败，请重试', icon: 'none' })
  } finally {
    favBusy.value = false
  }
}

/** 去修改：把 _id 带过去，编辑页会自动切换到「修改模式」 */
function goEdit() {
  if (!dish.value) return
  uni.navigateTo({ url: `/pages/dish/edit?_id=${dish.value._id}` })
}

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    // 直接从分享卡片 / 消息打开时没有上一页，回到列表
    uni.redirectTo({ url: '/pages/dish/list' })
  }
}

/* ==================== 生命周期 ==================== */

onLoad((query) => {
  dishId.value = (query && query._id) || ''
  if (!dishId.value) {
    loading.value = false
    uni.showToast({ title: '缺少菜品参数', icon: 'none' })
  }
})

onShow(() => {
  // onShow 会在 onLoad 之后触发，也覆盖「从修改页返回」这一次，
  // 所以数据加载只写在这里，不用再在 onLoad 里重复一遍。
  load()
})
</script>

<style lang="scss" scoped>
/* 底部有固定操作条时多留一点滚动空间 */
.page {
  padding-bottom: calc(200rpx + env(safe-area-inset-bottom));
}

/* ---------------- 加载 / 空状态 ---------------- */
.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 160rpx $gap-lg;
  background-color: $c-white;
  border-radius: $r-lg;
  box-shadow: $shadow-soft;
}
.state__text {
  margin-top: $gap-md;
  text-align: center;
}
.state__btn {
  margin-top: $gap-md;
  height: 64rpx;
  padding: 0 28rpx;
  border-radius: $r-pill;
  background-color: $c-apricot;
  display: flex;
  align-items: center;
}
.state__btn-text {
  font-size: 24rpx;
  color: $c-coffee;
}

/* ---------------- 图片轮播 ---------------- */
.gallery {
  position: relative;
  border-radius: $r-lg;
  /* 大圆角必须配合 overflow:hidden，否则图片四角还是直角 */
  overflow: hidden;
  box-shadow: $shadow-card;
}
.gallery__swiper {
  width: 100%;
  height: 520rpx;
}
.gallery__img {
  display: block;
  width: 100%;
  height: 100%;
  background-color: #f6f1ea;
}
.gallery__count {
  position: absolute;
  right: $gap-md;
  bottom: $gap-md;
  height: 44rpx;
  padding: 0 18rpx;
  border-radius: $r-pill;
  background-color: rgba(92, 75, 62, 0.55);
  display: flex;
  align-items: center;
}
.gallery__count-text {
  font-size: 22rpx;
  line-height: 1;
  color: #fff9f0;
}

/* ---------------- 标题卡 ---------------- */
.head {
  margin-top: $gap-md;
  padding: $gap-lg;
  border-radius: $r-lg;
  background-color: $c-white;
  box-shadow: $shadow-soft;
}
.head__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.head__name {
  flex: 1;
  padding-right: $gap-md;
  font-size: 42rpx;
  font-weight: 700;
  line-height: 1.35;
  color: $c-coffee;
}

/* 收藏胶囊 */
.fav {
  flex-shrink: 0;
  height: 60rpx;
  padding: 0 20rpx;
  border-radius: $r-pill;
  background-color: rgba(234, 234, 234, 0.7);
  display: flex;
  align-items: center;
  transition: background-color 0.2s ease, transform 0.16s ease;

  &:active {
    transform: scale(0.92);
  }
}
.fav__star {
  font-size: 30rpx;
  line-height: 1;
  color: #b9aea4;
}
.fav__count {
  margin-left: 8rpx;
  font-size: 24rpx;
  line-height: 1;
  color: #8d837a;
}
.fav--on {
  background-color: rgba(255, 184, 140, 0.35);

  .fav__star {
    color: #f0a35e;
  }
  .fav__count {
    color: #a9713f;
    font-weight: 600;
  }
}

/* 标签 */
.tags {
  display: flex;
  flex-wrap: wrap;
  margin-top: $gap-md;
}
.tag--category {
  margin-right: $gap-sm;
  background-color: rgba(255, 184, 140, 0.35);
  color: #a9713f;
}
.tag--diet {
  background-color: rgba(214, 228, 208, 0.9);
  color: #5d7a51;
}

.head__meta {
  display: block;
  margin-top: $gap-md;
}

/* ---------------- 步骤区 ---------------- */
.block {
  margin-top: $gap-md;
  padding: $gap-lg;
  border-radius: $r-lg;
  background-color: $c-white;
  box-shadow: $shadow-soft;
}
.block__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $gap-md;
}
.block__title {
  font-size: 32rpx;
  font-weight: 600;
  color: $c-coffee;
}

.steps {
  padding: $gap-md;
  border-radius: $r-sm;
  background-color: #faf7f2;
}
.steps__text {
  /* 行高放到 2.0：步骤是长文本，行距松一点眼睛不累 */
  font-size: $f-body;
  line-height: 2;
  color: $c-coffee;
  /* 允许在任意字符处换行，避免长英文串把布局撑破 */
  word-break: break-all;
}

/* ---------------- 底部操作条 ---------------- */
.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  padding: $gap-sm $gap-lg calc(#{$gap-sm} + env(safe-area-inset-bottom));
  background-color: rgba(255, 249, 240, 0.97);
  box-shadow: 0 -8rpx 24rpx rgba(92, 75, 62, 0.06);
}
.footer__btn {
  width: 100%;
  height: 96rpx;
}
</style>
