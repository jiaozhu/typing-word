import http from '@/utils/http.ts'

// 用户登录接口
export interface LoginParams {
  account?: string
  password?: string
  phone?: string
  code?: string
  type: 'code' | 'pwd'
}

export interface LoginResponse {
  token: string
  user: {
    id: string
    email?: string
    phone?: string
    nickname?: string
    avatar?: string
  }
}

// 用户注册接口
export interface RegisterParams {
  email?: string
  phone: string
  password: string
  code: string
  nickname?: string
}

export interface RegisterResponse {
  token: string
  user: {
    id: string
    email?: string
    phone: string
    nickname?: string
    avatar?: string
  }
}

// 发送验证码接口
export interface SendCodeParams {
  email?: string
  phone: string
  type: 'login' | 'register' | 'reset_password'
}

// 重置密码接口
export interface ResetPasswordParams {
  email?: string
  phone: string
  code: string
  newPassword: string
}

// 微信登录接口
export interface WechatLoginParams {
  code: string
  state?: string
}

// API 函数定义
export function loginApi(params: LoginParams) {
  // 暂时直接返回成功响应，等待后端接入
  // return Promise.resolve({
  //   success: true,
  //   code: 200,
  //   msg: '登录成功',
  //   data: {
  //     token: 'mock_token_' + Date.now(),
  //     user: {
  //       id: '1',
  //       account: params.account ?? 'account',
  //       phone: params.phone ?? 'phone',
  //       nickname: '测试用户',
  //       avatar: ''
  //     }
  //   }
  // })
  return http<LoginResponse>('user/login', params, null, 'post')
}

export function registerApi(params: RegisterParams) {
  return http<RegisterResponse>('user/register', params, null, 'post')
}

export function sendCode(params: SendCodeParams) {
  return http<boolean>('user/sendCode', null, params, 'get')
}

export function resetPasswordApi(params: ResetPasswordParams) {
  return http<boolean>('user/resetPassword', params, null, 'post')
}

export function wechatLogin(params: WechatLoginParams) {
  return http<LoginResponse>('user/wechatLogin', params, null, 'post')
}

export function logoutApi() {
  return http<boolean>('user/logout', null, null, 'post')
}

export function refreshToken() {
  return http<{ token: string }>('user/refreshToken', null, null, 'post')
}

// 获取用户信息
export function getUserInfo() {
  return http<LoginResponse['user']>('user/userInfo', null, null, 'get')
}
