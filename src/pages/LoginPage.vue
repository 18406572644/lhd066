<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="login-title">MockupStudio</h1>
      <p class="login-subtitle">登录你的账号</p>
      <a-form :model="form" @submit-success="onLogin" layout="vertical">
        <a-form-item field="email" :rules="[{ required: true, message: '请输入邮箱' }]" hide-label>
          <a-input v-model="form.email" placeholder="邮箱" size="large" />
        </a-form-item>
        <a-form-item field="password" :rules="[{ required: true, message: '请输入密码' }]" hide-label>
          <a-input-password v-model="form.password" placeholder="密码" size="large" />
        </a-form-item>
        <a-button
          type="primary"
          html-type="submit"
          long
          size="large"
          :loading="loading"
        >
          登录
        </a-button>
      </a-form>
      <div class="login-footer">
        还没有账号？<router-link to="/register" class="text-[#007AFF]">注册</router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Message } from '@arco-design/web-vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const loading = ref(false)
const form = reactive({ email: '', password: '' })

async function onLogin() {
  loading.value = true
  try {
    await auth.login(form.email, form.password)
    Message.success('登录成功')
    const redirect = (route.query.redirect as string) || '/'
    router.push(redirect)
  } catch (e: any) {
    Message.error(e.message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-secondary);
}
.login-card {
  width: 380px;
  background: var(--color-bg);
  border-radius: var(--radius-md);
  padding: 40px 32px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}
.login-title {
  font-size: 24px;
  font-weight: 700;
  text-align: center;
  margin: 0 0 4px;
  color: var(--color-text);
}
.login-subtitle {
  text-align: center;
  color: var(--color-text-secondary);
  margin: 0 0 28px;
  font-size: 14px;
}
.login-footer {
  text-align: center;
  margin-top: 20px;
  font-size: 14px;
  color: var(--color-text-secondary);
}
</style>
