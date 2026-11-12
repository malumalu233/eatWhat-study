<template>
  <view class="page">
    <!-- ============ 顶部提示 ============ -->
    <view class="notice anim-up">
      <view class="notice__text">
        <text class="notice__title">{{ isEdit ? '把这道菜改好' : '把这道菜记下来' }}</text>
        <text class="t-helper notice__desc">
          {{ isEdit ? '改完记得保存，家里人看到的就同步了' : '填好之后，家里人点餐时就能看到' }}
        </text>
      </view>
      <LineArt type="plate" size="sm" />
    </view>

    <!-- ==================== 1. 菜名 ==================== -->
    <view id="field-name" class="field">
      <view class="field__head">
        <text class="field__label">菜名</text>
        <text class="field__required">必填</text>
        <text class="field__counter">{{ form.name.length }}/{{ limits.nameMax }}</text>
      </view>
      <input
        class="input"
        :class="{ 'input--active': activeField === 'name' }"
        type="text"
        v-model="form.name"
        :maxlength="limits.nameMax"
        placeholder="请输入菜名，如红烧肉"
        placeholder-class="input__ph"
        confirm-type="done"
        @focus="activeField = 'name'"
        @blur="activeField = ''"
      />
      <text v-if="errors.name" class="error">{{ errors.name }}</text>
    </view>

    <!-- ==================== 2. 图片集 ==================== -->
    <view id="field-images" class="field">
      <view class="field__head">
        <text class="field__label">图片集</text>
        <text class="field__required">必填</text>
        <text class="field__counter">{{ imageList.length }}/{{ limits.maxImages }}</text>
      </view>

      <view class="photos">
        <view
          v-for="(img, index) in imageList"
          :key="img.key"
          class="photo"
          :style="photoStyle(index)"
        >
          <image class="photo__img" :src="img.path" mode="aspectFill" @tap="previewImage(index)" />

          <!-- 单张图片上传中的遮罩 + 转圈 -->
          <view v-if="img.status === 'uploading'" class="photo__mask">
            <view class="spinner"></view>
          </view>

          <!-- 右上角删除 -->
          <view class="photo__del" @tap.stop="removeImage(index)">×</view>
        </view>

        <!-- 添加按钮：占位插画复用 LineArt 简笔小碗 -->
        <view
          v-if="imageList.length < limits.maxImages"
          class="photo photo--add"
          :style="photoStyle(imageList.length)"
          @tap="chooseImages"
        >
          <LineArt type="bowl" size="sm" />
          <text class="photo__add-text">添加图片</text>
        </view>
      </view>

      <text class="field__hint">最多 {{ limits.maxImages }} 张，第一张会作为封面；点击图片可全屏查看</text>
      <text v-if="errors.images" class="error">{{ errors.images }}</text>
    </view>

    <!-- ==================== 3. 制作步骤 ==================== -->
    <view id="field-steps" class="field">
      <view class="field__head">
        <text class="field__label">制作步骤</text>
        <!-- <text class="field__required">必填</text> -->
        <text class="field__counter">{{ form.steps.length }}/{{ limits.stepsMax }}</text>
      </view>
      <textarea
        class="textarea"
        :class="{ 'textarea--active': activeField === 'steps' }"
        v-model="form.steps"
        :maxlength="limits.stepsMax"
        auto-height
        :cursor-spacing="120"
        placeholder="请详细描述制作步骤，例如：1. 准备食材… 2. 热锅凉油…"
        placeholder-class="input__ph"
        @focus="activeField = 'steps'"
        @blur="activeField = ''"
      />
      <text v-if="errors.steps" class="error">{{ errors.steps }}</text>
    </view>

    <!-- ==================== 4. 类型 ==================== -->
    <view id="field-category" class="field">
      <view class="field__head">
        <text class="field__label">类型</text>
        <text class="field__required">必填</text>
      </view>
      <view class="pills">
        <view
          v-for="item in categories"
          :key="item"
          class="pill"
          :class="{ 'pill--active': form.category === item }"
          @tap="selectCategory(item)"
        >
          <text class="pill__text">{{ item }}</text>
        </view>
      </view>
      <text class="field__hint">后续开放管理员自定义类型，这里会自动同步</text>
      <text v-if="errors.category" class="error">{{ errors.category }}</text>
    </view>

    <!-- ==================== 5. 减脂期可吃 ==================== -->
    <view class="field">
      <view class="field__head">
        <text class="field__label">减脂期可吃</text>
      </view>
      <view class="diet" :class="{ 'diet--on': form.isDietFriendly }" @tap="toggleDiet">
        <view class="diet__text">
          <text class="diet__label">{{ form.isDietFriendly ? '✓ 减脂友好' : '○ 非减脂' }}</text>
          <text class="diet__hint">标注后可在减脂期筛选此菜品</text>
        </view>
        <!-- 自绘开关：原生 switch 只能改一个 color，做不出「抹茶绿 + 文案联动」的效果 -->
        <view class="switch" :class="{ 'switch--on': form.isDietFriendly }">
          <view class="switch__knob"></view>
        </view>
      </view>
    </view>

    <!-- ==================== 底部保存栏 ==================== -->
    <view class="footer">
      <button class="btn footer__btn" :loading="saving" :disabled="saving" @tap="submit">
        {{ submitText }}
      </button>
    </view>
  </view>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import LineArt from '@/components/LineArt.vue'
import { DISH_CATEGORIES, DISH_LIMITS } from '@/config'
import { uploadDishImages, createDish, updateDish, getDish, cleanupImages } from '@/api/dish'

/**
 * 制作步骤是否必填
 *
 * 需求文档二.3 写「必填」，四.1 写「可以为空」，两处冲突。
 * 这里默认按「必填」执行（菜谱缺了步骤就没意义）；
 * 想改成可选，把下面这行改成 false 即可，校验逻辑会自动放行。
 */
const REQUIRE_STEPS = false

const limits = DISH_LIMITS

/** 类型选项：现在来自本地常量，将来改成云端 categories 集合即可 */
const categories = ref(DISH_CATEGORIES.slice())

/** 表单数据 */
const form = reactive({
  name: '',
  steps: '',
  category: '',
  isDietFriendly: false
})

/** 各字段的错误提示（空字符串 = 没有错误） */
const errors = reactive({
  name: '',
  images: '',
  steps: '',
  category: ''
})

/**
 * 图片列表：每一项是
 * { key: 唯一标识, path: 本地临时路径（用于预览）, fileID: 云存储ID, status: 'local'|'uploading'|'done' }
 *
 * 为什么不在选图时就上传？
 * 用户可能选了又删，先上传会白占云存储空间与流量；统一在「保存」时上传更省。
 * 代价是保存要等一会儿，所以配了全局 Loading + 单图转圈。
 */
const imageList = ref([])

/** 当前聚焦的字段名，用来做暖橘杏高亮 */
const activeField = ref('')

/** 保存中（禁用按钮 + 显示 loading） */
const saving = ref(false)

/**
 * 编辑模式
 * ------------------------------------------------------------------
 * 本页同时承担「新增」与「修改」两件事：
 *   /pages/dish/edit          → 新增（第三步之前就是这个模式）
 *   /pages/dish/edit?_id=xxx  → 修改（第三步详情页的「修改」入口会这样打开）
 * 两个模式共用表单、校验、上传逻辑，差别只在「保存时调哪个云函数」和「按钮文案」。
 */
const editId = ref('')

/** 编辑模式下被删掉、但还没保存的云存储 fileID（保存成功后才真正删除） */
const removedFileIDs = []

const isEdit = computed(() => !!editId.value)

/** 底部按钮文案 */
const submitText = computed(() => {
  if (saving.value) return '保存中…'
  return isEdit.value ? '保存修改' : '保存菜品'
})

/* 用户开始修改时，立刻清掉对应字段的红色提示，避免一直挂着错 */
watch(
  () => form.name,
  () => {
    if (errors.name) errors.name = ''
  }
)
watch(
  () => form.steps,
  () => {
    if (errors.steps) errors.steps = ''
  }
)

/* ==================== 选图 / 预览 / 删除 ==================== */

/**
 * 选择图片（Promise 化）
 *
 * 关于 API 选择：
 * uni.chooseImage 底层调用的是 wx.chooseImage，该接口已被微信标记「停止维护」，
 * 官方推荐 wx.chooseMedia。这里在小程序端用 chooseMedia、其它端回退到 chooseImage，
 * 用条件编译把两端分开，产物里只会保留当前平台那一份代码。
 *
 * @param {number} count 还能选几张
 * @returns {Promise<string[]>} 本地临时路径数组
 */
function pickImages(count) {
  return new Promise((resolve, reject) => {
    // #ifdef MP-WEIXIN
    wx.chooseMedia({
      count,
      mediaType: ['image'],
      // compressed：菜谱图不需要原图，压缩后体积能小一个数量级
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        // chooseMedia 返回的是对象数组，字段名是 tempFilePath
        resolve(res.tempFiles.map((file) => file.tempFilePath))
      },
      fail: reject
    })
    return
    // #endif

    // #ifndef MP-WEIXIN
    uni.chooseImage({
      count,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => resolve(res.tempFilePaths),
      fail: reject
    })
    // #endif
  })
}

async function chooseImages() {
  const remain = limits.maxImages - imageList.value.length
  if (remain <= 0) return

  try {
    const paths = await pickImages(remain)
    const now = Date.now()
    const added = paths.map((path, i) => ({
      key: `${now}_${i}_${Math.random().toString(36).slice(2, 8)}`,
      path,
      fileID: '',
      status: 'local'
    }))
    // 用 concat 生成新数组，保证 ref 的响应式更新被视图感知
    imageList.value = imageList.value.concat(added)
    errors.images = ''
  } catch (err) {
    // 用户点「取消」也会走到 fail，这里不打扰用户，只打日志
    console.log('[dish] 取消选择图片：', err && err.errMsg)
  }
}

/** 点击图片全屏预览（urls 传整组，可以左右滑动切换） */
function previewImage(index) {
  const urls = imageList.value.map((item) => item.path)
  uni.previewImage({
    urls,
    current: urls[index]
  })
}

/** 删除某张图片 */
function removeImage(index) {
  const removed = imageList.value[index]
  imageList.value.splice(index, 1)

  if (removed && removed.fileID) {
    if (isEdit.value) {
      // 修改模式：先记下来，等「保存修改」成功后再删云文件。
      // 现在就删的话，用户删完图直接返回，数据库里还指着这张图，详情页就会裂图。
      removedFileIDs.push(removed.fileID)
    } else {
      // 新增模式：这张图是之前保存失败时已经传到云上的，属于孤儿文件，可以立即清理
      cleanupImages([removed.fileID])
    }
  }
}

/* ==================== 类型 / 减脂开关 ==================== */

function selectCategory(item) {
  form.category = item
  errors.category = ''
}

function toggleDiet() {
  form.isDietFriendly = !form.isDietFriendly
}

/* ==================== 校验 ==================== */

/**
 * 校验表单，把错误写进 errors，返回第一个出错的字段名
 * @returns {string} 空字符串表示校验通过
 */
function validate() {
  errors.name = ''
  errors.images = ''
  errors.steps = ''
  errors.category = ''

  const name = form.name.trim()
  if (!name) {
    errors.name = '请填写菜名'
  } else if (name.length > limits.nameMax) {
    errors.name = `菜名不能超过 ${limits.nameMax} 个字`
  }

  if (imageList.value.length === 0) {
    errors.images = '请至少上传 1 张图片'
  }

  if (REQUIRE_STEPS && !form.steps.trim()) {
    errors.steps = '请填写制作步骤'
  }

  if (!form.category) {
    errors.category = '请选择菜品类型'
  }

  const firstErrorKey = Object.keys(errors).find((key) => errors[key])
  return firstErrorKey || ''
}

/** 把页面滚动到出错的字段，避免用户在长表单里找不到红字 */
function scrollToField(field) {
  const map = {
    name: '#field-name',
    images: '#field-images',
    steps: '#field-steps',
    category: '#field-category'
  }
  if (!map[field]) return
  try {
    uni.pageScrollTo({ selector: map[field], duration: 260, offsetTop: -20 })
  } catch (err) {
    console.log('[dish] 滚动定位失败（忽略）：', err)
  }
}

/* ==================== 提交 ==================== */

async function submit() {
  if (saving.value) return

  const firstError = validate()
  if (firstError) {
    scrollToField(firstError)
    uni.showToast({ title: errors[firstError], icon: 'none' })
    return
  }

  saving.value = true
  // 成功后就不要再把按钮恢复成可点：留出 700ms 的返回动画窗口，
  // 这期间如果按钮可点，用户连点两下就会存出两条重复菜品
  let succeeded = false

  try {
    let imageIDs = []

    if (imageList.value.length > 0) {
      // ① 上传图片：逐张上传，页面据此显示单图转圈
      uni.showLoading({ title: '正在上传图片', mask: true })
      imageIDs = await uploadDishImages(
        imageList.value,
        (index) => {
          imageList.value[index].status = 'uploading'
        },
        () => {}
      )
      // 全部传完，统一标记为完成
      imageList.value.forEach((item) => {
        item.status = 'done'
      })
    }

    // ② 写数据库
    const payload = {
      name: form.name.trim(),
      images: imageIDs,
      steps: form.steps.trim(),
      category: form.category,
      isDietFriendly: form.isDietFriendly
    }

    uni.showLoading({ title: '正在保存', mask: true })
    if (isEdit.value) {
      // 修改模式：云函数会校验归属，不是自己录的菜会返回 403
      await updateDish({ _id: editId.value, ...payload })
      // 保存成功之后才清理被删掉的旧图，避免中途失败造成「图没了、记录还指着它」
      if (removedFileIDs.length > 0) cleanupImages(removedFileIDs)
    } else {
      await createDish(payload)
    }

    uni.hideLoading()
    uni.showToast({ title: isEdit.value ? '修改成功' : '保存成功', icon: 'none' })
    // 通知列表页：数据变了，回到列表时记得刷新（列表页收到后只做标记，不立即请求）
    uni.$emit('dish:list-dirty')
    succeeded = true

    // ③ 返回上一页（给 toast 留一点展示时间，体验更顺）
    setTimeout(() => {
      uni.navigateBack({ delta: 1 })
    }, 700)
  } catch (err) {
    uni.hideLoading()
    console.error('[dish] 保存失败：', err)

    // 区分「超时」和其它错误，给出的建议才有用
    const isTimeout = err && err.message && err.message.indexOf('超时') > -1
    uni.showToast({
      title: isTimeout ? '图片上传超时，请检查网络后重试' : '网络繁忙，请稍后重试',
      icon: 'none',
      duration: 2200
    })
  } finally {
    // 只有失败时才解锁按钮，让用户能重试；成功时保持禁用直到页面关闭
    if (!succeeded) saving.value = false
  }
}

/* ==================== 修改模式：回填原数据 ==================== */

/**
 * 把云端的菜品回填到表单
 * @param {string} id 菜品 _id
 */
async function loadDish(id) {
  uni.showLoading({ title: '加载中', mask: true })

  try {
    const dish = await getDish(id)

    form.name = dish.name || ''
    form.steps = dish.steps || ''
    form.category = dish.category || ''
    form.isDietFriendly = dish.isDietFriendly === true

    // 云存储 fileID 可以直接当图片地址用（基础库 2.2.3 起），不需要先换临时链接；
    // 把 fileID 同时写进 item.fileID，上传函数就会跳过它，不会重复上传。
    imageList.value = (dish.images || []).map((fileID, index) => ({
      key: `cloud_${index}_${fileID.slice(-10)}`,
      path: fileID,
      fileID,
      status: 'done'
    }))
  } catch (err) {
    console.error('[dish] 加载待修改菜品失败：', err)
    uni.showToast({ title: err.message || '加载失败，请稍后重试', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 800)
  } finally {
    uni.hideLoading()
  }
}

onLoad((query) => {
  // 带 _id 进来就是「修改」，什么都没带就是「新增」
  if (query && query._id) {
    editId.value = query._id
    // pages.json 里登记的是「录入菜品」，修改模式下换个标题更贴合语境
    uni.setNavigationBarTitle({ title: '修改菜品' })
    loadDish(query._id)
  }
})

/* ==================== 图片九宫格布局 ==================== */

/**
 * 每张图固定 212rpx 宽，一行 3 张，用 17rpx 撑开：
 * 3 * 212 + 2 * 17 = 670rpx（页面左右各 40rpx 内边距后的可用宽度）
 * 第 3、6、9 张的右边距设为 0，否则会换行。
 * 这里用内联 style 而不是 :nth-child，是因为 WXSS 对选择器的支持不如浏览器完整。
 */
function photoStyle(index) {
  const isRowEnd = (index + 1) % 3 === 0
  return {
    marginRight: isRowEnd ? '0' : '17rpx'
  }
}
</script>

<style lang="scss" scoped>
/* 底部固定保存栏会盖住内容，这里多留出 220rpx 的滚动空间 */
.page {
  padding-bottom: calc(220rpx + env(safe-area-inset-bottom));
}

/* ---------------- 顶部提示 ---------------- */
.notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $gap-md $gap-lg;
  margin-bottom: $gap-lg;
  border-radius: $r-lg;
  background: linear-gradient(135deg, #fffdf9 0%, #fff2e4 100%);
  box-shadow: $shadow-soft;
}
.notice__text {
  display: flex;
  flex-direction: column;
  padding-right: $gap-md;
}
.notice__title {
  font-size: 32rpx;
  font-weight: 600;
  color: $c-coffee;
}
.notice__desc {
  margin-top: 4rpx;
}

/* ---------------- 字段通用 ---------------- */
.field {
  margin-bottom: $gap-md;
}
.field__head {
  display: flex;
  align-items: center;
  margin-bottom: $gap-sm;
}
.field__label {
  font-size: 28rpx;
  font-weight: 600;
  color: $c-coffee;
}
.field__required {
  margin-left: $gap-xs;
  padding: 0 10rpx;
  height: 34rpx;
  line-height: 34rpx;
  border-radius: 8rpx;
  font-size: 20rpx;
  color: #a9713f;
  background-color: rgba(255, 184, 140, 0.35);
}
.field__counter {
  margin-left: auto;
  font-size: 22rpx;
  color: $c-text-sub;
}
.field__hint {
  display: block;
  margin-top: $gap-xs;
  font-size: 22rpx;
  line-height: 1.6;
  color: $c-text-sub;
}

/* 错误提示：柔和砖红 + 圆角小标签，不用刺眼的荧光红 */
.error {
  display: inline-block;
  margin-top: $gap-xs;
  padding: 6rpx $gap-sm;
  border-radius: $r-sm;
  font-size: 22rpx;
  line-height: 1.5;
  color: #c1614f;
  background-color: rgba(193, 97, 79, 0.1);
}

/* ---------------- 输入框 ---------------- */
.input {
  width: 100%;
  height: 96rpx;
  padding: 0 $gap-md;
  border: 2rpx solid $c-gray;
  border-radius: $r-sm;
  background-color: $c-white;
  font-size: 30rpx;
  color: $c-coffee;
  box-sizing: border-box;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
/* 聚焦时暖橘杏高亮 */
.input--active {
  border-color: $c-apricot;
  box-shadow: 0 0 0 4rpx rgba(255, 184, 140, 0.22);
}
.input__ph {
  color: #c1b6ac;
  font-size: 28rpx;
}

/* ---------------- 文本域 ---------------- */
.textarea {
  width: 100%;
  min-height: 300rpx;
  padding: $gap-md;
  border: 2rpx solid $c-gray;
  border-radius: $r-sm;
  background-color: #faf7f2;
  font-size: 28rpx;
  line-height: 1.9;
  color: $c-coffee;
  box-sizing: border-box;
  transition: border-color 0.2s ease;
}
.textarea--active {
  border-color: $c-apricot;
}

/* ---------------- 图片九宫格 ---------------- */
.photos {
  display: flex;
  flex-wrap: wrap;
}
.photo {
  position: relative;
  width: 212rpx;
  height: 212rpx;
  margin-bottom: 17rpx;
  border-radius: $r-md;
  background-color: $c-white;
  /* 裁掉直角，让图片四角也是圆角 */
  overflow: hidden;
}
.photo__img {
  display: block;
  width: 100%;
  height: 100%;
}
.photo--add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #fffaf3;
  border: 2rpx dashed rgba(92, 75, 62, 0.16);
  box-sizing: border-box;
}
.photo__add-text {
  margin-top: 2rpx;
  font-size: 22rpx;
  color: $c-text-sub;
}
.photo__del {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  width: 44rpx;
  height: 44rpx;
  border-radius: $r-pill;
  background-color: rgba(92, 75, 62, 0.55);
  color: #fff;
  font-size: 30rpx;
  line-height: 42rpx;
  text-align: center;
}
.photo__mask {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 249, 240, 0.78);
}

/* 转圈动画：云存储上传没有进度回调，只能用这种「不确定态」动画 */
.spinner {
  width: 44rpx;
  height: 44rpx;
  border: 4rpx solid rgba(92, 75, 62, 0.15);
  border-top-color: $c-apricot;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ---------------- 类型标签 ---------------- */
.pills {
  display: flex;
  flex-wrap: wrap;
}
.pill {
  height: 68rpx;
  padding: 0 32rpx;
  margin: 0 $gap-sm $gap-sm 0;
  border-radius: $r-pill;
  background-color: $c-gray;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease, transform 0.16s ease;

  &:active {
    transform: scale(0.96);
  }
}
.pill__text {
  font-size: 26rpx;
  color: #7d746d;
}
/* 选中：暖橘杏底 + 深咖字 */
.pill--active {
  background-color: $c-apricot;

  .pill__text {
    color: $c-coffee;
    font-weight: 600;
  }
}

/* ---------------- 减脂开关行 ---------------- */
.diet {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $gap-md $gap-lg;
  border-radius: $r-sm;
  background-color: rgba(234, 234, 234, 0.55);
  transition: background-color 0.25s ease;
}
.diet--on {
  background-color: rgba(214, 228, 208, 0.8);
}
.diet__text {
  display: flex;
  flex-direction: column;
}
.diet__label {
  font-size: 28rpx;
  font-weight: 600;
  color: $c-coffee;
}
.diet__hint {
  margin-top: 4rpx;
  font-size: 22rpx;
  color: $c-text-sub;
}

/* 自绘开关 */
.switch {
  flex-shrink: 0;
  width: 92rpx;
  height: 52rpx;
  padding: 4rpx;
  border-radius: $r-pill;
  background-color: rgba(92, 75, 62, 0.18);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  transition: background-color 0.25s ease;
}
.switch--on {
  background-color: #9dbb8f;
}
.switch__knob {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background-color: $c-white;
  box-shadow: 0 2rpx 6rpx rgba(92, 75, 62, 0.18);
  transition: transform 0.25s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.switch--on .switch__knob {
  transform: translateX(40rpx);
}

/* ---------------- 底部保存栏 ---------------- */
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
