<template>
  <view class="page">
    <!-- ============ 用户信息卡 ============ -->
    <view class="user-card anim-up">
      <!--
        头像必须是 <button open-type="chooseAvatar">：
        2022 年 10 月之后，wx.getUserInfo / wx.getUserProfile 已经拿不到真实头像昵称，
        官方唯一合规的获取方式是「头像昵称填写能力」——点击按钮由用户主动选择。
      -->
      <button class="avatar-btn" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
        <image v-if="avatarUrl" class="avatar" :src="avatarUrl" mode="aspectFill" />
        <!-- 没有头像时用简笔小碗占位，而不是灰色小人 -->
        <view v-else class="avatar avatar--empty">
          <LineArt type="bowl" size="sm" />
        </view>
        <text class="avatar-btn__badge">换</text>
      </button>

      <view class="user-card__info">
        <view class="user-card__name-row" @tap="onEditNickname">
          <text class="user-card__name">{{ nickName }}</text>
          <text class="user-card__edit">修改</text>
        </view>
        <text class="t-helper user-card__status">{{ statusText }}</text>
      </view>
    </view>

    <!-- 未登录时的引导 -->
    <view v-if="!userStore.logged" class="login-card anim-up anim-up--delay1">
      <text class="t-helper">登录后可以保存你的菜品、点餐记录与家庭组</text>
      <button class="btn login-card__btn" :loading="userStore.loading" @tap="handleLogin">
        微信快捷登录
      </button>
    </view>

    <!-- ============ 功能列表（第一步只占位） ============ -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">我的</text>
      </view>

      <view class="menu">
        <view v-for="item in menus" :key="item.key" class="menu__item" @tap="onTodo(item.title)">
          <text class="menu__label">{{ item.title }}</text>
          <view class="menu__right">
            <text class="t-helper">{{ item.desc }}</text>
            <text class="menu__arrow">›</text>
          </view>
        </view>
      </view>
    </view>

    <!-- ============ 调试信息（学习期很方便定位问题） ============ -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">调试信息</text>
        <text class="t-helper">正式上线可删除</text>
      </view>
      <view class="debug">
        <view class="debug__row">
          <text class="t-helper">云环境</text>
          <text class="debug__value">{{ envId }}</text>
        </view>
        <view class="debug__row">
          <text class="t-helper">openid</text>
          <text class="debug__value">{{ maskedOpenid }}</text>
        </view>
      </view>
    </view>

    <!-- ============ 修改昵称弹窗 ============ -->
    <view v-if="showNicknameModal" class="mask anim-fade" @tap="closeNicknameModal">
      <view class="modal anim-up" @tap.stop>
        <text class="modal__title">修改昵称</text>
        <text class="t-helper modal__desc">
          可以直接输入，也可以点键盘上方的「使用微信昵称」一键填入
        </text>
        <!-- type="nickname" 是微信提供的昵称填写能力，会带出「使用微信昵称」按钮 -->
        <input
          class="modal__input"
          type="nickname"
          maxlength="20"
          v-model="nicknameDraft"
          placeholder="请输入昵称"
          placeholder-class="modal__placeholder"
          confirm-type="done"
          @confirm="saveNickname"
        />
        <view class="modal__actions">
          <button class="btn btn--ghost modal__btn" @tap="closeNicknameModal">取消</button>
          <button class="btn modal__btn" :loading="saving" @tap="saveNickname">保存</button>
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
import { loginSilently, updateProfile, uploadAvatar } from '@/api/user'
import { CLOUD_ENV_ID } from '@/config'

/** 是否显示昵称弹窗 */
const showNicknameModal = ref(false)
/** 弹窗里的昵称草稿 */
const nicknameDraft = ref('')
/** 保存中标记，防止重复点击提交 */
const saving = ref(false)

const avatarUrl = computed(() => (userStore.profile && userStore.profile.avatarUrl) || '')
const nickName = computed(() => displayName.value)
const envId = CLOUD_ENV_ID

/** 登录状态文案 */
const statusText = computed(() => {
  if (!userStore.logged) return '未登录'
  if (!userStore.profile.nickName || userStore.profile.nickName === '美食爱好者') {
    return '已登录 · 点击上方可以换个昵称'
  }
  return '已登录 · 头像昵称随时可改'
})

/** openid 脱敏展示：只留头尾，避免截图泄露 */
const maskedOpenid = computed(() => {
  const openid = (userStore.profile && userStore.profile._openid) || ''
  if (!openid) return '—'
  return `${openid.slice(0, 6)}****${openid.slice(-4)}`
})

/** 功能列表数据（第一步全部是占位项） */
const menus = ref([
  { key: 'family', title: '我的家庭', desc: '下一步开放' },
  { key: 'favorite', title: '我的收藏', desc: '下一步开放' },
  { key: 'about', title: '关于小程序', desc: '第一步' }
])

onShow(() => {
  if (!userStore.logged && !userStore.loading) {
    loginSilently()
  }
})

async function handleLogin() {
  const profile = await loginSilently()
  uni.showToast({
    title: profile ? '登录成功' : '登录失败，请检查云开发配置',
    icon: 'none'
  })
}

/* ---------------- 头像 ---------------- */
/**
 * 用户从相册 / 相机选完头像后触发
 * e.detail.avatarUrl = 本地临时文件路径（小程序重启后就失效，所以必须上传到云存储）
 */
async function onChooseAvatar(e) {
  const tempPath = e.detail && e.detail.avatarUrl
  if (!tempPath) return

  if (!userStore.logged) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    return
  }

  uni.showLoading({ title: '头像上传中', mask: true })
  try {
    await uploadAvatar(tempPath)
    uni.hideLoading()
    uni.showToast({ title: '头像已更新', icon: 'none' })
  } catch (err) {
    uni.hideLoading()
    console.error('[profile] 头像上传失败：', err)
    uni.showToast({ title: '头像上传失败，请重试', icon: 'none' })
  }
}

/* ---------------- 昵称 ---------------- */
function onEditNickname() {
  if (!userStore.logged) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    return
  }
  nicknameDraft.value = nickName.value
  showNicknameModal.value = true
}

function closeNicknameModal() {
  showNicknameModal.value = false
}

async function saveNickname() {
  const name = (nicknameDraft.value || '').trim()

  if (!name) {
    uni.showToast({ title: '昵称不能为空', icon: 'none' })
    return
  }
  if (name.length > 20) {
    uni.showToast({ title: '昵称最多 20 个字', icon: 'none' })
    return
  }
  if (saving.value) return

  saving.value = true
  try {
    await updateProfile({ nickName: name })
    showNicknameModal.value = false
    uni.showToast({ title: '昵称已更新', icon: 'none' })
  } catch (err) {
    console.error('[profile] 昵称更新失败：', err)
    uni.showToast({ title: err.message || '更新失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}

/** 占位功能统一提示 */
function onTodo(title) {
  if (title === '关于小程序') {
    uni.showModal({
      title: '今天吃什么',
      content: 'uni-app + 微信云开发 学习项目\n当前进度：第一步（脚手架 / 登录 / 基础 UI）',
      showCancel: false,
      confirmText: '好的'
    })
    return
  }
  uni.showToast({ title: `「${title}」将在后续步骤实现`, icon: 'none' })
}
</script>

<style lang="scss" scoped>
/* ---------------- 用户信息卡 ---------------- */
.user-card {
  display: flex;
  align-items: center;
  padding: $gap-lg;
  border-radius: $r-lg;
  background: linear-gradient(140deg, #fffdf9 0%, #fff1e3 100%);
  box-shadow: $shadow-soft;
}

/* 头像按钮：去掉小程序 button 的所有默认样式，只保留一个圆形区域 */
.avatar-btn {
  position: relative;
  width: 132rpx;
  height: 132rpx;
  padding: 0;
  margin: 0;
  border: none;
  border-radius: $r-pill;
  background-color: transparent;
  line-height: 1;
  flex-shrink: 0;

  &::after {
    border: none;
  }
}
.avatar {
  width: 132rpx;
  height: 132rpx;
  border-radius: $r-pill;
  background-color: $c-white;
  box-shadow: inset 0 0 0 2rpx rgba(92, 75, 62, 0.08);
}
.avatar--empty {
  display: flex;
  align-items: center;
  justify-content: center;
}
/* 右下角的小圆点提示「可以换」 */
.avatar-btn__badge {
  position: absolute;
  right: -4rpx;
  bottom: -4rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: $r-pill;
  background-color: $c-apricot;
  color: $c-coffee;
  font-size: 20rpx;
  line-height: 40rpx;
  text-align: center;
}

.user-card__info {
  flex: 1;
  padding-left: $gap-md;
  display: flex;
  flex-direction: column;
}
.user-card__name-row {
  display: flex;
  align-items: center;
}
.user-card__name {
  font-size: 36rpx;
  font-weight: 600;
  color: $c-coffee;
  max-width: 320rpx;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.user-card__edit {
  margin-left: $gap-sm;
  padding: 0 $gap-sm;
  height: 40rpx;
  line-height: 40rpx;
  border-radius: $r-sm;
  font-size: 22rpx;
  color: $c-coffee;
  background-color: rgba(255, 184, 140, 0.5);
}
.user-card__status {
  margin-top: $gap-xs;
}

/* ---------------- 登录引导 ---------------- */
.login-card {
  margin-top: $gap-md;
  padding: $gap-lg;
  border-radius: $r-lg;
  background-color: $c-white;
  box-shadow: $shadow-soft;
}
.login-card__btn {
  margin-top: $gap-md;
  width: 100%;
}

/* ---------------- 菜单列表 ---------------- */
.menu {
  background-color: $c-white;
  border-radius: $r-lg;
  box-shadow: $shadow-soft;
  overflow: hidden;
}
.menu__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $gap-md $gap-lg;
  border-bottom: 1rpx solid $c-gray;

  &:last-child {
    border-bottom: none;
  }
  &:active {
    background-color: #fdf7ef;
  }
}
.menu__label {
  font-size: $f-body;
  color: $c-coffee;
}
.menu__right {
  display: flex;
  align-items: center;
}
.menu__arrow {
  margin-left: $gap-sm;
  font-size: 32rpx;
  color: $c-text-sub;
}

/* ---------------- 调试信息 ---------------- */
.debug {
  padding: $gap-md $gap-lg;
  border-radius: $r-lg;
  background-color: rgba(234, 234, 234, 0.45);
}
.debug__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $gap-xs 0;
}
.debug__value {
  font-size: $f-helper;
  color: $c-coffee;
}

/* ---------------- 弹窗 ---------------- */
.mask {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 99;
  background-color: rgba(92, 75, 62, 0.35);
  display: flex;
  align-items: flex-end;
}
.modal {
  width: 100%;
  padding: $gap-lg $gap-lg calc(#{$gap-lg} + env(safe-area-inset-bottom));
  border-radius: $r-lg $r-lg 0 0;
  background-color: $c-white;
  box-sizing: border-box;
}
.modal__title {
  display: block;
  font-size: 34rpx;
  font-weight: 600;
  color: $c-coffee;
}
.modal__desc {
  display: block;
  margin-top: $gap-xs;
}
.modal__input {
  height: 96rpx;
  margin-top: $gap-md;
  padding: 0 $gap-md;
  border-radius: $r-sm;
  background-color: #faf5ee;
  font-size: 30rpx;
  color: $c-coffee;
  box-sizing: border-box;
}
.modal__placeholder {
  color: #c1b6ac;
  font-size: 28rpx;
}
.modal__actions {
  display: flex;
  margin-top: $gap-lg;
}
.modal__btn {
  flex: 1;
  margin-left: $gap-sm;

  &:first-child {
    margin-left: 0;
  }
}
</style>
