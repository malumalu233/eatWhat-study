<template>
  <!--
    LineArt：纯 CSS 画的「简笔线条插画」（小碗 / 小盘）
    为什么不用图片？
    1. 小程序包体积按 KB 计，矢量级线条比 PNG 更省；
    2. 不依赖设计素材，随时改颜色；
    3. 分辨率无关，不会糊。
    后续接入设计师的手绘插画时，可以直接把本组件换成 <image src="/static/xxx.png" />。
  -->
  <view class="line-art" :class="[`line-art--${type}`, `line-art--${size}`]">
    <!-- 筷子：只在小碗上出现，先渲染以便压在碗身后面 -->
    <view v-if="type === 'bowl'" class="chopsticks">
      <view class="chopstick"></view>
      <view class="chopstick chopstick--2"></view>
    </view>
    <!-- 碗/盘的口沿 -->
    <view class="rim"></view>
    <!-- 碗/盘的器身 -->
    <view class="body"></view>
  </view>
</template>

<script setup>
/**
 * props
 * - type: 'bowl' 小碗 | 'plate' 小盘
 * - size: 'sm' | 'md' | 'lg'
 */
defineProps({
  type: {
    type: String,
    default: 'bowl'
  },
  size: {
    type: String,
    default: 'md'
  }
})
</script>

<style lang="scss" scoped>
/* 线条统一用「深咖 + 低透明度」，比纯黑更柔和，符合日系治愈风 */
$line: rgba(92, 75, 62, 0.42);

.line-art {
  position: relative;
  flex-shrink: 0;
  /* 尺寸由修饰类决定，这里只做缩放基准 */
  width: 140rpx;
  height: 116rpx;
}

/* ---------- 尺寸 ---------- */
/* 只做缩放，不改变布局盒子大小，避免绝对定位的子元素溢出 */
.line-art--sm {
  transform: scale(0.72);
  transform-origin: center;
}
.line-art--lg {
  transform: scale(1.3);
  transform-origin: center;
}

/* ---------- 口沿（椭圆） ---------- */
.rim {
  position: absolute;
  top: 18rpx;
  left: 10rpx;
  width: 120rpx;
  height: 26rpx;
  border: 2rpx solid $line;
  border-radius: 50%;
  /* 碗里盛着的「抹茶绿」，作为唯一一处彩色点缀 */
  background-color: rgba(214, 228, 208, 0.75);
  z-index: 2;
}

/* ---------- 器身 ---------- */
.body {
  position: absolute;
  top: 30rpx;
  left: 10rpx;
  width: 120rpx;
  height: 66rpx;
  border: 2rpx solid $line;
  border-top: none;
  /* 下方两角大圆角 = 碗底弧度，拒绝直角 */
  border-radius: 0 0 62rpx 62rpx;
  background-color: rgba(255, 184, 140, 0.28);
}

/* ---------- 盘子：更扁 ---------- */
.line-art--plate .body {
  height: 34rpx;
  border-radius: 0 0 40rpx 40rpx;
}
.line-art--plate .rim {
  background-color: rgba(255, 184, 140, 0.3);
}

/* ---------- 筷子 ---------- */
.chopsticks {
  position: absolute;
  top: 0;
  right: 6rpx;
  width: 90rpx;
  height: 70rpx;
  z-index: 1;
}
.chopstick {
  position: absolute;
  top: 24rpx;
  left: 0;
  width: 96rpx;
  height: 3rpx;
  border-radius: 3rpx;
  background-color: $line;
  transform: rotate(-32deg);
  transform-origin: left center;
}
.chopstick--2 {
  top: 36rpx;
  transform: rotate(-24deg);
}
</style>
