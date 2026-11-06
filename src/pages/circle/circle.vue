<template>
  <view class="page">
    <!-- ============ 顶部说明 ============ -->
    <view class="intro anim-up">
      <text class="t-title">饭圈</text>
      <text class="t-helper intro__desc">
        这里会展示全网用户公开分享的家常菜，按「收藏数 + 评论数」加权排序
      </text>
      <view class="intro__tags">
        <text class="tag">公开分享</text>
        <text class="tag tag--apricot">收藏 / 评论</text>
        <text class="tag">智能排序</text>
      </view>
    </view>

    <!-- ============ 空状态 ============ -->
    <view class="empty anim-up anim-up--delay1 section">
      <LineArt type="plate" size="md" />
      <text class="empty__text">饭圈还在准备中</text>
      <text class="empty__text">等你的第一道公开菜品上桌</text>
    </view>

    <!-- ============ 骨架卡片：预告后续真实卡片的布局 ============ -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">即将上桌</text>
        <text class="t-helper">占位预览</text>
      </view>

      <view v-for="n in 2" :key="n" class="food-card anim-up" :class="`anim-up--delay${n}`">
        <!-- 图片位：后续放菜品缩略图 -->
        <view class="food-card__thumb">
          <LineArt :type="n === 1 ? 'bowl' : 'plate'" size="sm" />
        </view>
        <view class="food-card__body">
          <text class="food-card__name">{{ n === 1 ? '番茄炖牛腩' : '清炒时蔬' }}</text>
          <text class="t-helper food-card__meta">菜品卡片占位 · 收藏 0 · 评论 0</text>
          <view class="food-card__tags">
            <text class="tag">{{ n === 1 ? '硬菜' : '素菜' }}</text>
            <text class="tag tag--apricot">减脂期可吃</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
/**
 * 饭圈页（社区）
 *
 * 第一步只做「页面骨架 + 视觉规范落地」，
 * 列表数据、排序算法、收藏评论都放在后面步骤实现。
 */
import LineArt from '@/components/LineArt.vue'
</script>

<style lang="scss" scoped>
/* ---------------- 顶部说明 ---------------- */
.intro {
  padding: $gap-lg;
  border-radius: $r-lg;
  background: linear-gradient(140deg, #fffdf9 0%, #f1f6ee 100%);
  box-shadow: $shadow-soft;
  display: flex;
  flex-direction: column;
}
.intro__desc {
  margin-top: $gap-sm;
}
.intro__tags {
  display: flex;
  margin-top: $gap-md;
}
.intro__tags .tag {
  margin-right: $gap-sm;
}
/* 暖橘杏标签，用于强调「受欢迎」这类信息 */
.tag--apricot {
  background-color: rgba(255, 184, 140, 0.45);
}

/* ---------------- 菜品卡片骨架 ---------------- */
.food-card {
  display: flex;
  padding: $gap-md;
  margin-bottom: $gap-md;
  border-radius: $r-lg;
  background-color: $c-white;
  box-shadow: $shadow-soft;
}
.food-card__thumb {
  width: 150rpx;
  height: 150rpx;
  border-radius: $r-md;
  background-color: #fbf3e8;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.food-card__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-left: $gap-md;
}
.food-card__name {
  font-size: 30rpx;
  font-weight: 600;
  color: $c-coffee;
}
.food-card__meta {
  margin-top: $gap-xs;
}
.food-card__tags {
  display: flex;
  margin-top: $gap-sm;
}
.food-card__tags .tag {
  margin-right: $gap-xs;
}
</style>
