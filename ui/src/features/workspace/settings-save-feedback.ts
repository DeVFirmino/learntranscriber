import { toast } from 'sonner'
import { documentT } from '@/i18n'

export async function saveWithFeedback<T>(task: () => Promise<T>): Promise<T> {
  toast.loading(documentT('settingsPage.saving'), { id: 'settings-save', closeButton: false })
  try {
    const result = await task()
    toast.success(documentT('settingsPage.saved'), { id: 'settings-save', duration: 1800, closeButton: true })
    return result
  } catch (error) {
    toast.dismiss('settings-save')
    throw error
  }
}
