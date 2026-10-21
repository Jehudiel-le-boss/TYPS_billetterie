export function useGuideVisibility() {
  const visible = useState<boolean>('guide-floating-button-visible', () => true)
  const me = useMe()
  const storageKey = computed(() => `typs-guide-floating-button:${me.value.user?.id ?? 'guest'}`)

  function load() {
    if (!import.meta.client) return
    try {
      visible.value = localStorage.getItem(storageKey.value) !== 'hidden'
    } catch {
      visible.value = true
    }
  }

  function setVisible(value: boolean) {
    visible.value = value
    if (!import.meta.client) return
    try {
      if (value) localStorage.removeItem(storageKey.value)
      else localStorage.setItem(storageKey.value, 'hidden')
    } catch {
      visible.value = true
      throw new Error('Impossible d’enregistrer ce réglage dans le navigateur.')
    }
  }

  return { visible, load, setVisible }
}
