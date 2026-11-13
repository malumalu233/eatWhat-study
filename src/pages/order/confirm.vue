<template>
  <view class="page confirm">
    <!-- ============ 顶部标题 ============ -->
    <view class="head anim-up">
      <view class="head__text">
        <text class="head__title">确认下单</text>
        <text class="head__sub">看一眼菜单，就交给厨房啦</text>
      </view>
      <!-- 与小碗插画呼应，右侧留白不影响阅读节奏 -->
      <LineArt type="bowl" size="sm" />
    </view>

    <!-- ============ 已选菜品 ============ -->
    <!--
      数据来自列表页：navigateTo 时把 cart 用 JSON.stringify + encodeURIComponent 塞在 URL 里。
      这里不再去云函数查一遍 —— 用户已经点完了，列表页那份就是「他要点的菜」；
      真正的菜名与封面由云函数在 createOrder 里以数据库为准重新生成快照。
    -->
    <view class="block anim-up anim-up--delay1">
      <view class="block__head">
        <text class="block__title">已选菜品</text>
        <text class="block__extra">共 {{ dishes.length }} 道</text>
      </view>

      <view v-if="dishes.length === 0" class="empty">
        <text class="empty__text">没有拿到已选的菜品，回列表页再点点看</text>
      </view>

      <view v-else class="dish-list">
        <view v-for="(item, index) in dishes" :key="item._id" class="dish-row">
          <!-- cover 是云存储 fileID，可以直接给 <image src> 用 -->
          <image class="dish-row__img" :src="item.cover" mode="aspectFill" />
          <view class="dish-row__text">
            <text class="dish-row__name">{{ item.name }}</text>
            <text class="dish-row__idx">第 {{ index + 1 }} 道</text>
          </view>
        </view>
      </view>
    </view>

    <!-- ============ 用餐时段 ============ -->
    <view class="block anim-up anim-up--delay2">
      <view class="block__head">
        <text class="block__title">用餐时段</text>
        <text class="block__extra">已按当前时间选好</text>
      </view>

      <!--
        单选组：4 个选项平铺。
        选中态用「该餐次自己的主题色」铺底，和首页「最近点菜」的标签是同一套颜色，
        用户看完这页回到首页，一眼就能对上号。
      -->
      <view class="meal-group">
        <view
          v-for="meal in meals"
          :key="meal.value"
          class="meal"
          :class="{ 'meal--on': mealTime === meal.value }"
          :style="mealTime === meal.value ? { backgroundColor: meal.color, borderColor: meal.color } : {}"
          @tap="selectMeal(meal.value)"
        >
          <text class="meal__text" :class="{ 'meal__text--on': mealTime === meal.value }">{{ meal.label }}</text>
        </view>
      </view>
    </view>

    <!-- ============ 备注 ============ -->
    <view class="block anim-up anim-up--delay3">
      <view class="block__head">
        <text class="block__title">备注</text>
        <!-- 字数提示：maxlength 会在地输入到上限时自动截断，这里只是让用户知道还剩多少 -->
        <text class="block__extra">{{ remark.length }}/{{ REMARK_MAX }}</text>
      </view>

      <textarea
        v-model="remark"
        class="remark"
        :maxlength="REMARK_MAX"
        placeholder="比如：少放辣、不要香菜"
        placeholder-class="remark__ph"
        :show-confirm-bar="false"
        :cursor-spacing="48"
      />
    </view>

    <!-- ============ 底部浮动提交栏 ============ -->
    <view class="footer">
      <view class="footer__row">
        <view class="footer__info">
          <text class="footer__count">{{ dishes.length }} 道菜</text>
          <text class="footer__extra">{{ currentMeal.label }} · 现在就做</text>
        </view>

        <!-- 胶囊形主按钮：主题色暖橘杏底 + 深咖字，右侧留 40rpx，形成「右下角浮动」的观感 -->
        <view class="footer__btn" :class="{ 'footer__btn--busy': submitting }" @tap="onSubmit">
          <text class="footer__btn-text">{{ submitting ? '下单中…' : '确认下单' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import LineArt from '@/components/LineArt.vue'
import { MEAL_TIMES, ORDER_LIMITS, getMealMeta } from '@/config'
import { createOrder } from '@/api/dish'

/** 备注上限：与云函数里的 REMARK_MAX 保持一致（改 config 一处即可） */
const REMARK_MAX = ORDER_LIMITS.remarkMax

/** 餐次选项：来自 config，首页标签、这里的选择器共用同一份数据 */
const meals = MEAL_TIMES

/** 从上一页带过来的菜（只包含 _id / name / cover 三个字段） */
const dishes = ref([])

/** 当前选中的餐次 */
const mealTime = ref(detectMealTime())

/** 备注内容 */
const remark = ref('')

/** 提交中：防重复点击（连点两次会生成两个订单） */
const submitting = ref(false)

/** 当前餐次的完整配置（用于底部文案、颜色） */
const currentMeal = computed(() => getMealMeta(mealTime.value))

/**
 * 根据当前小时猜一个默认餐次
 *
 * 规则来自需求：6:00-9:59 早餐、11:00-13:59 午餐、17:00-19:59 晚餐，其余宵夜。
 * 注意 10 点、14-16 点、20 点以后都会落到宵夜 —— 这是需求定义的边界，
 * 用户觉得不对随时可以点上面的单选按钮改，默认值只是「少点一次」的便利。
 *
 * 为什么允许传 hour？方便以后写单测直接验证每个时间点的结果。
 */
function detectMealTime(hour = new Date().getHours()) {
  if (hour >= 6 && hour < 10) return 'breakfast'
  if (hour >= 11 && hour < 14) return 'lunch'
  if (hour >= 17 && hour < 20) return 'dinner'
  return 'supper'
}

/**
 * 解析 URL 里带过来的 items
 *
 * 这里为什么要写得这么啰嗦？
 * 页面参数是字符串，传数组只能序列化。而「序列化 + 编码 + 小程序自动解码」这条链路上
 * 任何一环都可能多包一层或少包一层，一旦 JSON.parse 抛错，整个结算页就是白屏。
 * 所以按「先直接 parse，再解一层编码重试，最后兜底空数组」三级降级处理。
 */
function parseItems(raw) {
  if (!raw) return []

  // 成功的 parse 返回数组；失败返回 null（用来与「解析出空数组」区分开）
  const attempt = (text) => {
    try {
      const parsed = JSON.parse(text)
      return Array.isArray(parsed) ? parsed : null
    } catch (err) {
      return null
    }
  }

  // ① 常规情况：小程序把 query 解码过一次，直接 parse 就能成
  const direct = attempt(raw)
  if (direct) return direct

  // ② 上游多编码了一层（或者参数里带了 + % 这类会被二次解码的字符）
  try {
    const decoded = attempt(decodeURIComponent(raw))
    if (decoded) return decoded
  } catch (err) {
    // decodeURIComponent 遇到残缺的 % 序列会抛错，忽略即可
  }

  // ③ URL 被截断、参数被手改：当作没点菜，由页面提示用户返回
  return []
}

/** 返回上一页；如果没有上一页（比如从分享卡片直接打开），回首页 */
function goBack() {
  if (getCurrentPages().length > 1) {
    uni.navigateBack()
    return
  }
  uni.switchTab({ url: '/pages/index/index' })
}

/** 选中餐次 */
function selectMeal(value) {
  mealTime.value = value
}

/**
 * 提交订单
 *
 * 注意：这里传给云函数的 items 只有 dishId。
 * 菜名和封面由服务端从数据库读出来做快照 —— 既防伪造，也保证「下单那一刻」的数据是真的。
 */
async function onSubmit() {
  if (submitting.value) return

  if (dishes.value.length === 0) {
    uni.showToast({ title: '没有可结算的菜品', icon: 'none' })
    return
  }

  submitting.value = true
  uni.showLoading({ title: '正在下单', mask: true })

  try {
    await createOrder({
      items: dishes.value.map((item) => ({ dishId: item._id })),
      mealTime: mealTime.value,
      remark: remark.value.trim()
    })

    uni.hideLoading()
    uni.showToast({ title: '下单成功', icon: 'success' })

    /*
     * 为什么不是 uni.redirectTo('/pages/index/index')？
     * 首页是 tabBar 页面，redirectTo 只能跳非 tabBar 页，否则直接失败
     * （控制台会报 redirectTo:fail can not redirectTo a tabbar page）。
     * 必须用 switchTab。
     *
     * switchTab 的副作用正好是我们想要的：它会关掉所有非 tabBar 页面
     * （列表页 + 本页一起销毁），列表页里的 cart 数组随之释放，
     * 回到首页就是「干净的、刚下完单」的状态。
     *
     * 延迟 900ms 是为了让 toast 能被看见：立刻跳转会把提示一起盖掉。
     */
    setTimeout(() => {
      uni.switchTab({ url: '/pages/index/index' })
    }, 900)
  } catch (err) {
    uni.hideLoading()
    console.error('[order-confirm] 下单失败：', err)
    uni.showToast({ title: err.message || '下单失败，请重试', icon: 'none' })
    // 失败后要把按钮放开，让用户可以改完备注/餐次再试一次
    submitting.value = false
  }
}

/* ==================== 生命周期 ==================== */

onLoad((query) => {
  const parsed = parseItems(query && query.items)

  // 只保留具备 _id 的项：脏数据不该把结算页搞崩
  dishes.value = parsed
    .filter((item) => item && item._id)
    .map((item) => ({
      _id: item._id,
      name: item.name || '未命名菜品',
      cover: item.cover || ''
    }))

  if (dishes.value.length === 0) {
    uni.showToast({ title: '没有可结算的菜品', icon: 'none' })
    // 等 toast 露个面再退回列表页，避免用户只看到一闪而过的白屏
    setTimeout(() => {
      goBack()
    }, 900)
  }
})
</script>

<style lang="scss" scoped>
/* 底部固定提交栏占位：用 padding 让内容不被挡住（不是 height，否则安全区会算重） */
.page {
  padding-bottom: calc(200rpx + env(safe-area-inset-bottom));
}

/* ---------------- 顶部标题 ---------------- */
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $gap-xs 0 $gap-lg;
}
.head__text {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-right: $gap-md;
}
.head__title {
  font-size: 40rpx;
  font-weight: 600;
  line-height: 1.3;
  color: $c-coffee;
}
.head__sub {
  margin-top: $gap-xs;
  font-size: 22rpx;
  color: $c-text-sub;
}

/* ---------------- 内容区块 ---------------- */
.block {
  margin-bottom: $gap-md;
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
  font-size: $f-title;
  font-weight: 600;
  color: $c-coffee;
}
.block__extra {
  font-size: 22rpx;
  color: $c-text-sub;
}

/* ---------------- 菜品行 ---------------- */
.dish-list {
  display: flex;
  flex-direction: column;
}
.dish-row {
  display: flex;
  align-items: center;
  padding: $gap-sm 0;
  /* 用极淡的分割线分隔，最后一行不画线，避免和卡片圆角撞在一起 */
  border-bottom: 1rpx solid rgba(234, 234, 234, 0.8);

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
  &:first-child {
    padding-top: 0;
  }
}
.dish-row__img {
  width: 96rpx;
  height: 96rpx;
  flex-shrink: 0;
  border-radius: $r-sm;
  background-color: #f6f1ea;
}
.dish-row__text {
  flex: 1;
  min-width: 0; /* flex 子项默认 min-width:auto，不加这行超长菜名会把行撑破 */
  display: flex;
  flex-direction: column;
  margin-left: $gap-md;
}
.dish-row__name {
  font-size: $f-body;
  font-weight: 500;
  color: $c-coffee;
  @include ellipsis;
}
.dish-row__idx {
  margin-top: 4rpx;
  font-size: 22rpx;
  color: $c-text-sub;
}

/* ---------------- 餐次单选 ---------------- */
.meal-group {
  display: flex;
}
.meal {
  flex: 1;
  height: 76rpx;
  margin-right: 16rpx;
  border-radius: $r-sm;
  /* 未选中：白底 + 极浅灰描边，视觉上「安静」但不至于看不见 */
  background-color: #fffdf9;
  border: 2rpx solid $c-gray;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.16s ease;

  &:last-child {
    margin-right: 0;
  }
  &:active {
    transform: scale(0.96);
  }
}
/* 选中：底色由 :style 绑定成该餐次的主题色，这里只负责「抬起来一点」的层次感 */
.meal--on {
  box-shadow: 0 6rpx 16rpx rgba(92, 75, 62, 0.12);
}
.meal__text {
  font-size: 26rpx;
  color: $c-text-sub;
}
/* 选中：底色由 :style 绑定成该餐次的主题色，文字统一深咖加粗保证对比度 */
.meal__text--on {
  color: $c-coffee;
  font-weight: 600;
}

/* ---------------- 备注 ---------------- */
.remark {
  width: 100%;
  height: 180rpx;
  padding: $gap-md;
  /* 输入框基准圆角 12rpx */
  border-radius: $r-sm;
  background-color: #fffdf9;
  border: 2rpx solid $c-gray;
  font-size: $f-body;
  line-height: $lh-body;
  color: $c-coffee;
  box-sizing: border-box;
}
.remark__ph {
  color: #c3b8ae;
}

/* ---------------- 空状态 ---------------- */
.empty {
  padding: $gap-lg 0;
  text-align: center;
}
.empty__text {
  font-size: $f-helper;
  color: $c-text-sub;
  line-height: 1.8;
}

/* ========================================================================
   底部浮动提交栏（外卖 APP 风格：左侧信息 + 右侧胶囊主按钮）
   ======================================================================== */
.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  padding: 0 $gap-lg calc(24rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  /* 渐变收边：内容滚到栏下时是「渐隐」而不是被硬切一刀 */
  background: linear-gradient(180deg, rgba(255, 249, 240, 0) 0%, rgba(255, 249, 240, 0.94) 42%, #fff9f0 100%);
}
.footer__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 120rpx;
}
.footer__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.footer__count {
  font-size: 30rpx;
  font-weight: 600;
  color: $c-coffee;
}
.footer__extra {
  margin-top: 2rpx;
  font-size: 22rpx;
  color: $c-text-sub;
}
/* 胶囊主按钮：两端全圆角 */
.footer__btn {
  height: 88rpx;
  padding: 0 48rpx;
  flex-shrink: 0;
  border-radius: $r-pill;
  background-color: $c-apricot;
  box-shadow: 0 10rpx 24rpx rgba(255, 184, 140, 0.42);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.16s ease, opacity 0.2s ease;

  &:active {
    transform: scale(0.96);
  }
}
.footer__btn-text {
  font-size: 30rpx;
  font-weight: 600;
  color: $c-coffee;
}
/* 提交中：降低不透明度做出「不可点」的观感（逻辑上由 submitting 拦截） */
.footer__btn--busy {
  opacity: 0.6;
  pointer-events: none;
}
</style>
