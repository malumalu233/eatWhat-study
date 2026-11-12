<template>
  <view class="page">
    <!-- ============ 顶部标题栏 ============ -->
    <view class="top">
      <view class="top__text">
        <text class="top__title">今天吃什么</text>
        <text class="top__sub">{{ tabs.length }} 个分类 · 点一点就上桌</text>
      </view>
      <!-- 顺手留一个录入入口：从首页进来记完一道菜，可以在这里接着记 -->
      <view class="top__add" @tap="goCreate">
        <text class="top__add-text">＋ 录入</text>
      </view>
    </view>

    <!-- ============ 主体：左 Tab + 右列表 ============ -->
    <view class="body">
      <!--
        左侧分类栏
        tabs 来自 config 的 DISH_TABS = DISH_CATEGORIES + '爱吃'，
        所以「加一个类型只改 config 一处」这件事在这里自动成立。
      -->
      <scroll-view class="rail" scroll-y>
        <view
          v-for="tab in tabs"
          :key="tab"
          class="rail__item"
          :class="{ 'rail__item--active': activeTab === tab }"
          @tap="switchTab(tab)"
        >
          <text class="rail__text">{{ tab }}</text>
        </view>
      </scroll-view>

      <!--
        右侧菜品流
        scroll-y 必须配合「确定高度」才生效，这里用 flex:1 + height:100% 撑满，
        父级 .page 是 100vh，高度链一路确定下来。
      -->
      <scroll-view class="list" scroll-y @scrolltolower="loadMore">
        <!-- 首屏加载：用简笔插画代替干巴巴的空白 -->
        <view v-if="loading && list.length === 0" class="state">
          <LineArt type="plate" size="md" />
          <text class="t-helper state__text">正在翻找菜谱…</text>
        </view>

        <!-- 空状态 -->
        <view v-else-if="!loading && list.length === 0" class="state">
          <LineArt type="bowl" size="md" />
          <text class="t-helper state__text">{{ emptyText }}</text>
          <view v-if="activeTab !== FAVORITE_TAB" class="state__btn" @tap="goCreate">
            <text class="state__btn-text">去录入这道菜</text>
          </view>
        </view>

        <!-- 菜品卡片 -->
        <view
          v-for="dish in list"
          :key="dish._id"
          class="dish-card anim-up"
          @tap="goDetail(dish)"
        >
          <!-- 模块 1：图片区（占卡片约 80% 高度） -->
          <view class="media">
            <image class="media__img" :src="coverOf(dish)" mode="aspectFill" />

            <!--
              收藏组件：右上角悬浮
              @tap.stop 阻止冒泡 —— 否则点星标会同时触发卡片的「跳详情」
            -->
            <view class="fav" :class="{ 'fav--on': dish.isFavorite }" @tap.stop="onFavorite(dish)">
              <text class="fav__star">{{ dish.isFavorite ? '★' : '☆' }}</text>
              <text class="fav__count">{{ dish.favoriteCount || 0 }}</text>
            </view>
          </view>

          <!-- 模块 2：标题区（贴卡片底部） -->
          <view class="foot">
            <text class="foot__name">{{ dish.name }}</text>
            <view
              class="order"
              :class="{ 'order--on': isOrdered(dish) }"
              @tap.stop="toggleOrder(dish)"
            >
              <text class="order__text">{{ isOrdered(dish) ? '已点 ✓' : '点菜' }}</text>
            </view>
          </view>
        </view>

        <!-- 分页提示 -->
        <view v-if="list.length > 0" class="list__end">
          <text class="list__end-text">{{ loading ? '加载中…' : hasMore ? '上拉看看还有别的' : '— 就这些啦 —' }}</text>
        </view>
      </scroll-view>
    </view>

    <!-- ============ 底部点菜结算栏 ============ -->
    <!--
      层级要求：图标 > 结算按钮 > 主长条
      实现方式就是容器内 z-index：图标 3、结算按钮 2、长条 1，
      图标比长条高一点（128 vs 104），自然冒出边缘形成「悬浮」层次。
    -->
    <view class="cart">
      <!--
        cart__row 才是定位参照：图标、长条、胶囊按钮在同一行里对齐，
        底部安全区通过外层 .cart 的 padding 让开，胶囊不会因为安全区而偏移。
      -->
      <view class="cart__row">
        <!--
          左侧固定模块：碗筷图标
          现在用 LineArt（纯 CSS 线条小碗 + 筷子）占位，不拉伸、固定宽高。
          想换成设计稿图标时，把下面这行换成：
            <image class="cart__img" src="/static/icons/cart.png" mode="aspectFit" />
          再补一条 .cart__img { width: 100%; height: 100%; } 即可，外圈白底与投影不用动。
        -->
        <view class="cart__icon" @tap="openSheet">
          <LineArt type="bowl" size="sm" />
        </view>

        <!-- 中间弹性区域 -->
        <view class="cart__bar" :class="{ 'cart__bar--active': cartCount > 0 }" @tap="openSheet">
          <text class="cart__text">{{ cartCount > 0 ? `已点${cartCount}个菜` : '未点餐' }}</text>
        </view>

        <!-- 右侧固定模块：胶囊按钮，叠放在长条右端 -->
        <view
          class="cart__action"
          :class="{ 'cart__action--on': cartCount > 0 }"
          @tap="goCheckout"
        >
          <text class="cart__action-text">{{ cartCount > 0 ? '去结算' : '未点菜' }}</text>
        </view>
      </view>
    </view>

    <!-- ============ 已点菜品抽屉 ============ -->
    <!-- 遮罩：点一下关闭。z-index 高于结算栏，所以抽屉打开时结算栏被盖住 -->
    <view v-if="sheetVisible" class="mask anim-fade" @tap="closeSheet"></view>
    <view v-if="sheetVisible" class="sheet">
      <view class="sheet__handle"></view>
      <view class="sheet__head">
        <text class="sheet__title">已点的菜</text>
        <text class="sheet__count">共 {{ cartCount }} 个</text>
      </view>

      <scroll-view class="sheet__list" scroll-y>
        <view v-for="item in cart" :key="item._id" class="cart-item">
          <image class="cart-item__img" :src="item.cover" mode="aspectFill" />
          <text class="cart-item__name">{{ item.name }}</text>
          <!-- 在抽屉里也能取消：点菜/取消是同一个动作，只是换了个入口 -->
          <text class="cart-item__del" @tap.stop="removeFromCart(item._id)">移除</text>
        </view>
      </scroll-view>

      <view class="sheet__foot">
        <text class="t-helper">结算功能会在后续步骤开放，先把想吃的记下来</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import LineArt from '@/components/LineArt.vue'
import { DISH_TABS, FAVORITE_TAB } from '@/config'
import { listDishes, toggleFavorite } from '@/api/dish'
import { userStore } from '@/store/user'
import { loginSilently } from '@/api/user'

/** 一页拉多少条：云函数端默认 20、上限 50，这里与默认值对齐 */
const PAGE_SIZE = 20

/** Tab 序列（硬菜/软菜/素菜/汤/爱吃）：唯一来源是 config，页面不重复写死 */
const tabs = DISH_TABS

/** 当前选中的分类 */
const activeTab = ref(tabs[0])

/* ---------------- 列表数据 ---------------- */
const list = ref([]) // 当前分类已加载的菜品
const total = ref(0) // 当前分类的总条数（云函数 count 出来的）
const page = ref(1) // 已加载到第几页
const loading = ref(false) // 请求进行中：防抖 + 显示加载文案

/**
 * 「回到本页需要刷新」的标记
 * 在录入/修改页保存成功后会 uni.$emit('dish:list-dirty')，
 * 这里收到只做标记，等用户返回本页（onShow）再真正拉数据，
 * 避免页面还在后台时就发请求、白耗流量。
 */
const dirty = ref(false)

/** 正在请求收藏接口的菜品 id：防止连续点击把收藏/取消收藏点乱 */
const favBusyId = ref('')

/** 已点菜品。只放在页面内存里，退出页面就清空（真正的订单要等后续步骤） */
const cart = ref([])

/** 抽屉是否展开 */
const sheetVisible = ref(false)

/** 已点数量 */
const cartCount = computed(() => cart.value.length)

/** 还有没有下一页 */
const hasMore = computed(() => list.value.length < total.value)

/** 空状态文案随分类变化 */
const emptyText = computed(() => {
  if (activeTab.value === FAVORITE_TAB) return '还没有收藏的菜，点卡片右上角的星标试试'
  return `「${activeTab.value}」还空着，先记两道菜吧`
})

/* ==================== 数据加载 ==================== */

/** 按当前分类拼查询参数，页面其它地方就不用关心 onlyFavorite 这类细节 */
function requestList(nextPage) {
  if (activeTab.value === FAVORITE_TAB) {
    return listDishes({ onlyFavorite: true, page: nextPage, pageSize: PAGE_SIZE })
  }
  return listDishes({ category: activeTab.value, page: nextPage, pageSize: PAGE_SIZE })
}

/**
 * 请求序号
 *
 * 场景：用户在上一个分类还在加载时就切到了另一个分类。
 * 如果不做处理，两个请求会互相覆盖（后回来的未必是最新点击的那个），
 * 甚至第一个请求会把 loading 提前置回 false，让第二个请求的守卫放行/报错。
 * 做法：每次请求领一个递增序号，回来时发现「我不是最新的」就直接丢掉结果。
 */
let requestSeq = 0

/**
 * 拉数据
 * @param {boolean} isLoadMore true=上拉加载下一页，false=重新加载第一页
 * @param {boolean} force true=即使正在加载也发起（切分类时用）
 */
async function fetchPage(isLoadMore = false, force = false) {
  // 上拉触底会连续触发，这里靠 loading 防抖；切分类必须能穿透，否则新分类永远加载不出来
  if (loading.value && !force) return

  const mySeq = ++requestSeq
  loading.value = true

  const nextPage = isLoadMore ? page.value + 1 : 1

  try {
    const res = await requestList(nextPage)

    // 已经又发了新请求：本次结果已过期，直接丢弃
    if (mySeq !== requestSeq) return

    if (isLoadMore) {
      // 去重：翻页期间如果有新菜插入，同一条可能被返回两次，key 会打架
      const existIds = {}
      list.value.forEach((item) => {
        existIds[item._id] = true
      })
      list.value = list.value.concat(res.list.filter((item) => !existIds[item._id]))
    } else {
      list.value = res.list
    }

    total.value = res.total
    page.value = nextPage
  } catch (err) {
    if (mySeq !== requestSeq) return
    console.error('[dish-list] 加载失败：', err)
    uni.showToast({ title: '网络繁忙，请稍后重试', icon: 'none' })
  } finally {
    // 只有最新的那次请求才有资格关掉 loading
    if (mySeq === requestSeq) loading.value = false
  }
}

/** 上拉触底 */
function loadMore() {
  if (loading.value || !hasMore.value) return
  fetchPage(true)
}

/** 切换分类：清空当前列表、重新拉第一页 */
function switchTab(tab) {
  if (activeTab.value === tab) return
  activeTab.value = tab
  list.value = []
  total.value = 0
  page.value = 1
  // 先把列表清空，scroll-view 的内容高度归零，滚动位置会自动回到顶部
  // 注意：cart（已点的菜）不随分类清空 —— 点的是「菜」，不是「分类」
  // force=true：上一个分类的请求还在飞，也要把这个分类的请求发出去
  fetchPage(false, true)
}

/* ==================== 收藏 ==================== */

async function onFavorite(dish) {
  if (favBusyId.value) return // 上一笔还没回来，先别叠加请求
  favBusyId.value = dish._id

  try {
    const res = await toggleFavorite(dish._id)

    // 用服务端返回的最新值覆盖本地，不用前端自己 +1/-1 猜
    dish.isFavorite = res.isFavorite
    dish.favoriteCount = res.favoriteCount

    // 在「爱吃」里取消收藏，这条菜就不该再出现在当前列表
    if (activeTab.value === FAVORITE_TAB && !res.isFavorite) {
      list.value = list.value.filter((item) => item._id !== dish._id)
      total.value = Math.max(0, total.value - 1)
    }
  } catch (err) {
    console.error('[dish-list] 收藏失败：', err)
    uni.showToast({ title: err.message || '操作失败，请重试', icon: 'none' })
  } finally {
    favBusyId.value = ''
  }
}

/* ==================== 点菜 ==================== */

/** 这道菜点了没有 */
function isOrdered(dish) {
  return cart.value.some((item) => item._id === dish._id)
}

/** 点菜 / 取消点菜（同一个按钮来回切） */
function toggleOrder(dish) {
  const index = cart.value.findIndex((item) => item._id === dish._id)

  if (index > -1) {
    cart.value.splice(index, 1)
    // 最后一个菜被取消时，抽屉没必要继续开着
    if (cart.value.length === 0) sheetVisible.value = false
    return
  }

  // 抽屉里要展示缩略图与菜名，所以这里存一份快照，而不是只存 id
  cart.value.push({
    _id: dish._id,
    name: dish.name,
    cover: coverOf(dish)
  })
}

/** 抽屉里移除某个菜（等价于再次点击该菜的点菜按钮） */
function removeFromCart(id) {
  cart.value = cart.value.filter((item) => item._id !== id)
  if (cart.value.length === 0) sheetVisible.value = false
}

/* ==================== 抽屉 / 跳转 ==================== */

function openSheet() {
  if (cartCount.value === 0) return // 没点菜时长条不可点，符合「未点餐」的视觉暗示
  sheetVisible.value = true
}

function closeSheet() {
  sheetVisible.value = false
}

/** 去结算：本步不实现，只给一个明确的提示 */
function goCheckout() {
  if (cartCount.value === 0) return
  uni.showToast({ title: '结算功能将在后续步骤开放', icon: 'none' })
}

/** 点卡片空白处进详情；点收藏/点菜时已用 .stop 拦下，不会走到这里 */
function goDetail(dish) {
  uni.navigateTo({ url: `/pages/dish/detail?_id=${dish._id}` })
}

function goCreate() {
  uni.navigateTo({ url: '/pages/dish/edit' })
}

/** 取封面图：约定第一张图作封面 */
function coverOf(dish) {
  if (!dish || !Array.isArray(dish.images) || dish.images.length === 0) return ''
  return dish.images[0]
}

/* ==================== 跨页面通信 ==================== */

/** 录入/修改页保存成功后 → 标记待刷新 */
function markDirty() {
  dirty.value = true
}

/**
 * 详情页收藏后 → 直接改本地这一条
 * 之所以不重新拉整个列表：用户从详情页返回时滚到哪儿还是哪儿，体验更稳。
 */
function onFavoriteChanged(payload) {
  if (!payload || !payload._id) return

  const item = list.value.find((dish) => dish._id === payload._id)
  if (!item) return

  item.isFavorite = payload.isFavorite
  item.favoriteCount = payload.favoriteCount

  if (activeTab.value === FAVORITE_TAB && !payload.isFavorite) {
    list.value = list.value.filter((dish) => dish._id !== payload._id)
    total.value = Math.max(0, total.value - 1)
  }
}

/* 事件登记：setup 里执行一次，页面销毁时在 onUnload 里注销 */
uni.$on('dish:list-dirty', markDirty)
uni.$on('dish:favorite-changed', onFavoriteChanged)

/* ==================== 生命周期 ==================== */

onLoad(async () => {
  // 正常从首页进来时已经登录过；这里兜一层，防止直接打开本页
  if (!userStore.logged && !userStore.loading) {
    await loginSilently()
  }
  fetchPage(false)
})

onShow(() => {
  // 从录入/修改页回来时才刷新，避免每次切前后台都发一次请求
  if (dirty.value) {
    dirty.value = false
    fetchPage(false)
  }
})

onUnload(() => {
  // 不注销的话，页面销毁后事件还会回调到旧实例，既报错也占内存
  uni.$off('dish:list-dirty', markDirty)
  uni.$off('dish:favorite-changed', onFavoriteChanged)
})
</script>

<style lang="scss" scoped>
/* ========================================================================
   列表页布局：100vh 纵向三段
   顶部标题 / 中间可滚动主体 / 底部固定结算栏
   ======================================================================== */
.page {
  /* 覆盖全局 .page 的左右内边距：这里要自己算栏宽 */
  height: 100vh;
  padding: 0 24rpx calc(190rpx + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

/* ---------------- 顶部标题 ---------------- */
.top {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 8rpx 20rpx;
}
.top__text {
  display: flex;
  flex-direction: column;
}
.top__title {
  font-size: 40rpx;
  font-weight: 600;
  line-height: 1.3;
  color: $c-coffee;
}
.top__sub {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: $c-text-sub;
}
.top__add {
  height: 60rpx;
  padding: 0 24rpx;
  border-radius: $r-pill;
  background-color: rgba(255, 184, 140, 0.28);
  display: flex;
  align-items: center;
  transition: transform 0.16s ease;

  &:active {
    transform: scale(0.94);
  }
}
.top__add-text {
  font-size: 24rpx;
  color: #a9713f;
}

/* ---------------- 主体两栏 ---------------- */
.body {
  flex: 1;
  /* min-height:0 是关键：不加的话 flex 子项最小高度为内容高度，
     scroll-view 会被内容顶开、滚不动 */
  min-height: 0;
  display: flex;
}

/* 左侧分类栏 */
.rail {
  width: 128rpx;
  height: 100%;
  flex-shrink: 0;
  margin-right: 24rpx;
}
.rail__item {
  height: 104rpx;
  margin-bottom: 16rpx;
  border-radius: $r-md;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.6);
  transition: background-color 0.2s ease, transform 0.16s ease;

  &:active {
    transform: scale(0.96);
  }
}
.rail__text {
  font-size: 26rpx;
  color: #8d837a;
}
/* 选中：暖橘杏底 + 深咖加粗，是全页最亮的一块 */
.rail__item--active {
  background-color: $c-apricot;
  box-shadow: 0 8rpx 20rpx rgba(255, 184, 140, 0.35);

  .rail__text {
    color: $c-coffee;
    font-weight: 600;
  }
}

/* 右侧列表 */
.list {
  /* 750 - 24*2（页面左右内边距）- 128（分类栏）- 24（间距）= 550rpx */
  width: 550rpx;
  height: 100%;
}

/* ---------------- 菜品卡片 ---------------- */
.dish-card {
  /* 固定宽度 + 垂直流式排列，滚动时节奏稳定 */
  width: 550rpx;
  height: 440rpx;
  margin-bottom: $gap-md;
  border-radius: $r-lg;
  background-color: $c-white;
  box-shadow: $shadow-soft;
  /* 裁掉直角，让图片四角跟着卡片一起圆 */
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: transform 0.16s ease;

  /* 按下时轻微下沉，替代系统灰底高亮 */
  &:active {
    transform: scale(0.985);
  }
}

/* 模块 1：图片区 —— 352 / 440 ≈ 80% */
.media {
  position: relative;
  height: 352rpx;
  background-color: #f6f1ea;
}
.media__img {
  display: block;
  width: 100%;
  height: 100%;
}

/* 收藏组件：右上角悬浮 */
.fav {
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  height: 56rpx;
  padding: 0 18rpx;
  border-radius: $r-pill;
  background-color: rgba(255, 255, 255, 0.86);
  box-shadow: 0 4rpx 12rpx rgba(92, 75, 62, 0.12);
  display: flex;
  align-items: center;
  transition: transform 0.16s ease, background-color 0.2s ease;

  &:active {
    transform: scale(0.9);
  }
}
.fav__star {
  font-size: 30rpx;
  line-height: 1;
  color: #b9aea4;
}
.fav__count {
  margin-left: 8rpx;
  font-size: 22rpx;
  line-height: 1;
  color: #8d837a;
}
/* 已收藏：星标换成暖橘杏，数字同步加深 */
.fav--on {
  background-color: rgba(255, 255, 255, 0.96);

  .fav__star {
    color: #f0a35e;
  }
  .fav__count {
    color: #a9713f;
    font-weight: 600;
  }
}

/* 模块 2：标题区 —— 贴在卡片底部 */
.foot {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 $gap-md;
}
.foot__name {
  max-width: 360rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: $c-coffee;
  @include ellipsis;
}

/* 点菜按钮 */
.order {
  height: 60rpx;
  padding: 0 26rpx;
  border-radius: $r-pill;
  background-color: $c-apricot;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  transition: background-color 0.2s ease, transform 0.16s ease;

  &:active {
    transform: scale(0.94);
  }
}
.order__text {
  font-size: 24rpx;
  font-weight: 600;
  color: $c-coffee;
}
/* 已点：换成抹茶绿，与「未点」形成一眼可辨的状态差 */
.order--on {
  background-color: $c-matcha;
}

/* ---------------- 加载 / 空状态 ---------------- */
.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx $gap-md;
  background-color: rgba(255, 255, 255, 0.7);
  border-radius: $r-lg;
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

.list__end {
  padding: $gap-md 0 $gap-lg;
  text-align: center;
}
.list__end-text {
  font-size: 22rpx;
  color: #b9aea4;
}

/* ========================================================================
   底部点菜结算栏（外卖 APP 风格通栏）
   ======================================================================== */
.cart {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  padding: 0 32rpx calc(24rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  /* 渐变遮罩：让结算栏压在列表上有「浮起来」的感觉，而不是硬切一刀 */
  background: linear-gradient(180deg, rgba(255, 249, 240, 0) 0%, rgba(255, 249, 240, 0.92) 46%, #fff9f0 100%);
}
/* 三个模块的公共行：高度取图标高度，保证图标能把长条压在下面 */
.cart__row {
  position: relative;
  display: flex;
  align-items: center;
  height: 128rpx;
}

/* 左侧固定模块：图标。固定宽高、不参与拉伸 */
.cart__icon {
  position: relative;
  z-index: 3;
  width: 128rpx;
  height: 128rpx;
  flex-shrink: 0;
  /* 往右压一点，让长条钻到图标下面，形成叠压层次 */
  margin-right: -36rpx;
  border-radius: $r-pill;
  background-color: #fffdf9;
  box-shadow: 0 14rpx 28rpx rgba(92, 75, 62, 0.18), 0 2rpx 6rpx rgba(92, 75, 62, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;

  &:active {
    transform: scale(0.95);
  }
}

/* 中间弹性区域：深炭黑长条 */
.cart__bar {
  position: relative;
  z-index: 1;
  flex: 1;
  height: 104rpx;
  border-radius: $r-pill;
  background-color: #3d3631;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.25s ease;
}
.cart__text {
  font-size: 26rpx;
  color: #a49b93;
  transition: color 0.25s ease;
}
/* 点餐后：容器与文字一起换成主题色（抹茶绿底 + 深咖字） */
.cart__bar--active {
  background: linear-gradient(135deg, #d6e4d0 0%, #c4d9ba 100%);

  .cart__text {
    color: $c-coffee;
    font-weight: 600;
  }
}

/* 右侧固定模块：胶囊按钮，绝对定位叠在长条右端 */
.cart__action {
  position: absolute;
  right: 48rpx;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  height: 76rpx;
  padding: 0 34rpx;
  border-radius: $r-pill;
  background-color: $c-gray;
  display: flex;
  align-items: center;
  transition: background-color 0.25s ease, transform 0.16s ease;
}
.cart__action-text {
  font-size: 26rpx;
  color: #b3aaa2;
  transition: color 0.25s ease;
}
/* 可结算：暖橘杏底 + 深咖字 + 一点柔光，明确告诉用户「这里能点」 */
.cart__action--on {
  background-color: $c-apricot;
  box-shadow: 0 8rpx 18rpx rgba(255, 184, 140, 0.4);

  .cart__action-text {
    color: $c-coffee;
    font-weight: 600;
  }

  &:active {
    transform: translateY(-50%) scale(0.95);
  }
}

/* ========================================================================
   已点菜品抽屉
   ======================================================================== */
.mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 150;
  background-color: rgba(92, 75, 62, 0.38);
}

.sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 200;
  max-height: 72vh;
  padding: 16rpx $gap-lg calc(24rpx + env(safe-area-inset-bottom));
  border-radius: $r-lg $r-lg 0 0;
  background-color: $c-cream;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  /* 自下而上的上滑动画，0.28s 足够轻，不拖沓 */
  animation: sheetUp 0.28s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}
@keyframes sheetUp {
  from {
    opacity: 0.4;
    transform: translateY(100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 顶部小把手：提示「这是可以下滑关闭的抽屉」 */
.sheet__handle {
  width: 72rpx;
  height: 8rpx;
  margin: 0 auto $gap-sm;
  border-radius: $r-pill;
  background-color: rgba(92, 75, 62, 0.16);
}
.sheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: $gap-sm;
}
.sheet__title {
  font-size: 32rpx;
  font-weight: 600;
  color: $c-coffee;
}
.sheet__count {
  font-size: 24rpx;
  color: $c-text-sub;
}
.sheet__list {
  max-height: 44vh;
}

/* 抽屉里的单个菜品行 */
.cart-item {
  display: flex;
  align-items: center;
  padding: $gap-sm 0;
  border-bottom: 1rpx solid rgba(234, 234, 234, 0.9);

  &:last-child {
    border-bottom: none;
  }
}
.cart-item__img {
  width: 88rpx;
  height: 88rpx;
  border-radius: $r-sm;
  background-color: #f6f1ea;
  flex-shrink: 0;
}
.cart-item__name {
  flex: 1;
  margin: 0 $gap-md;
  font-size: 28rpx;
  color: $c-coffee;
  @include ellipsis;
}
.cart-item__del {
  flex-shrink: 0;
  padding: 8rpx 20rpx;
  border-radius: $r-sm;
  font-size: 22rpx;
  color: #c1614f;
  background-color: rgba(193, 97, 79, 0.1);
}

.sheet__foot {
  padding-top: $gap-sm;
  text-align: center;
}
</style>
