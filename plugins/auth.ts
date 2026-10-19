export default defineNuxtPlugin(async () => { if (!useMe().value.user) await refreshMe() })
