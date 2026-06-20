<template>
  <div class="p-6 max-w-3xl mx-auto">
    <h2 class="text-lg font-semibold mb-6">账户设置</h2>

    <div class="setting-card mb-6">
      <div class="section-title mb-4">基本信息</div>
      <div class="flex items-center gap-6 mb-6">
        <div class="avatar-large">
          {{ authStore.user?.name?.charAt(0)?.toUpperCase() || 'U' }}
        </div>
        <div>
          <div class="text-lg font-medium">{{ authStore.user?.name }}</div>
          <div class="text-sm text-secondary">{{ authStore.user?.email }}</div>
          <a-tag size="small" :color="roleColor" class="mt-2">
            {{ roleLabel }}
          </a-tag>
        </div>
      </div>

      <a-form :model="profileForm" layout="vertical">
        <div class="grid grid-cols-2 gap-4">
          <a-form-item label="昵称">
            <a-input v-model="profileForm.name" placeholder="输入昵称" />
          </a-form-item>
          <a-form-item label="邮箱">
            <a-input :value="authStore.user?.email" disabled />
          </a-form-item>
        </div>
        <a-button
          type="primary"
          @click="onUpdateProfile"
          :loading="updating"
        >
          保存资料
        </a-button>
      </a-form>
    </div>

    <div class="setting-card mb-6">
      <div class="section-title mb-4">修改密码</div>
      <a-form :model="passwordForm" layout="vertical">
        <a-form-item label="当前密码" required>
          <a-input-password v-model="passwordForm.currentPassword" placeholder="请输入当前密码" />
        </a-form-item>
        <div class="grid grid-cols-2 gap-4">
          <a-form-item label="新密码" required>
            <a-input-password v-model="passwordForm.newPassword" placeholder="请输入新密码" />
          </a-form-item>
          <a-form-item label="确认新密码" required>
            <a-input-password v-model="passwordForm.confirmPassword" placeholder="请再次输入新密码" />
          </a-form-item>
        </div>
        <a-button
          type="primary"
          @click="onChangePassword"
          :loading="changingPassword"
        >
          修改密码
        </a-button>
      </a-form>
    </div>

    <div class="setting-card">
      <div class="section-title mb-4">账户操作</div>
      <div class="flex items-center justify-between p-4 bg-danger-light rounded-lg">
        <div>
          <div class="font-medium">退出登录</div>
          <div class="text-sm text-secondary">退出当前账户，返回登录页面</div>
        </div>
        <a-button status="danger" @click="onLogout">退出登录</a-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Message, Modal } from '@arco-design/web-vue'
import { post } from '@/utils/api'

const router = useRouter()
const authStore = useAuthStore()
const updating = ref(false)
const changingPassword = ref(false)

const profileForm = reactive({
  name: authStore.user?.name || ''
})

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const roleLabel = computed(() => {
  const map: Record<string, string> = {
    admin: '管理员',
    designer: '设计师',
    user: '普通用户'
  }
  return map[authStore.user?.role || 'user']
})

const roleColor = computed(() => {
  const map: Record<string, string> = {
    admin: 'red',
    designer: 'arcoblue',
    user: 'gray'
  }
  return map[authStore.user?.role || 'user']
})

async function onUpdateProfile() {
  if (!profileForm.name.trim()) {
    Message.warning('昵称不能为空')
    return
  }
  updating.value = true
  try {
    await post('/auth/profile', { name: profileForm.name })
    authStore.user!.name = profileForm.name
    Message.success('资料更新成功')
  } catch (e: any) {
    Message.error(e.message || '更新失败')
  } finally {
    updating.value = false
  }
}

async function onChangePassword() {
  if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
    Message.warning('请填写完整信息')
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    Message.warning('两次输入的新密码不一致')
    return
  }
  if (passwordForm.newPassword.length < 6) {
    Message.warning('新密码长度至少为6位')
    return
  }
  changingPassword.value = true
  try {
    await post('/auth/password', {
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword
    })
    Message.success('密码修改成功')
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
  } catch (e: any) {
    Message.error(e.message || '密码修改失败')
  } finally {
    changingPassword.value = false
  }
}

function onLogout() {
  Modal.confirm({
    title: '确认退出',
    content: '确定要退出当前账户吗？',
    okText: '确认退出',
    okButtonProps: { status: 'danger' },
    onOk: () => {
      authStore.logout()
      router.push('/login')
      Message.success('已退出登录')
    }
  })
}
</script>

<style scoped>
.setting-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 24px;
}
.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.avatar-large {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, #007AFF, #5856D6);
  color: #fff;
  font-size: 24px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.text-secondary {
  color: var(--color-text-secondary);
}
.grid {
  display: grid;
}
.grid-cols-2 {
  grid-template-columns: repeat(2, 1fr);
}
.gap-4 {
  gap: 16px;
}
.mb-4 {
  margin-bottom: 16px;
}
.mb-6 {
  margin-bottom: 24px;
}
.p-4 {
  padding: 16px;
}
.rounded-lg {
  border-radius: 8px;
}
.bg-danger-light {
  background: rgba(245, 63, 63, 0.08);
}
.font-medium {
  font-weight: 500;
}
.text-lg {
  font-size: 16px;
}
.text-sm {
  font-size: 13px;
}
.flex {
  display: flex;
}
.items-center {
  align-items: center;
}
.justify-between {
  justify-content: space-between;
}
.gap-6 {
  gap: 24px;
}
</style>
