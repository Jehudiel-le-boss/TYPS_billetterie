export default defineNuxtRouteMiddleware(async (to) => {
  const me = useMe(); if (!me.value.user) await refreshMe()
  if (!me.value.user) return navigateTo({ path: '/auth/login', query: { next: to.fullPath } })
})
