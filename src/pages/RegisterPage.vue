<template>
  <div class="register-page">
    <div class="register-card">
      <h1 class="register-title">MockupStudio</h1>
      <p class="register-subtitle">创建新账号</p>
      <a-form :model="form" @submit-success="onRegister" layout="vertical">
        <a-form-item field="name" :rules="[{ required: true, message: '请输入姓名' }]" hide-label>
          <a-input v-model="form.name" placeholder="姓名" size="large" />
        </a-form-item>
        <a-form-item field="email" :rules="[{ required: true, message: '请输入邮箱' }]" hide-label>
          <a-input v-model="form.email" placeholder="邮箱" size="large" />
        </a-form-item>
        <a-form-item field="password" :rules="[{ required: true, message: '请输入密码' }]" hide-label>
          <a-input-password v-model="form.password" placeholder="密码" size="large" />
        </a-form-item>
        <a-form-item field="role" hide-label>
          <a-radio-group v-model="form.role" type="button" size="large">
            <a-radio value="user">用户</a-radio>
            <a-radio value="designer">设计师</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-button
          type="primary"
          html-type="submit"
          long
          size="large"
          :loading="loading"
        >
          注册
        </a-button>
      </a-form>
      <div class="register-footer">
        已有账号？<router-link to="/login" class="text-[#007AFF]">登录</router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Message } from '@arco-design/web-vue'

const auth = useAuthStore()
const router = useRouter()
const loading = ref(false)
const form = reactive({ name: '', email: '', password: '', role: 'user' })

async function onRegister() {
  loading.value = true
  try {
    await auth.register(form.email, form.password, form.name)
    Message.success('注册成功')
    router.push('/')
  } catch (e: any) {
    Message.error(e.message || '注册失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.register-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-secondary);
}
.register-card {
  width: 380px;
  background: var(--color-bg);
  border-radius: var(--radius-md);
  padding: 40px 32px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}
.register-title {
  font-size: 24px;
  font-weight: 700;
  text-align: center;
  margin: 0 0 4px;
  color: var(--color-text);
}
.register-subtitle {
  text-align: center;
  color: var(--color-text-secondary);
  margin: 0 0 28px;
  font-size: 14px;
}
.register-footer {
  text-align: center;
  margin-top: 20px;
  font-size: 14px;
  color: var(--color-text-secondary);
}
</style>
