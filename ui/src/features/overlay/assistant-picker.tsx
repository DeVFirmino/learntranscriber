import { useEffect, useRef, useState } from 'react'
import './assistant-picker.css'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { Select as SelectPrimitive } from 'radix-ui'
import { BrandAssistants, BrandSettings } from '@/components/brand-icon'
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select'
import { categoryOf, isBuiltIn, paginate } from '@/features/assistant-catalog'
import { AssistantGlyph } from '@/features/assistants/assistant-glyph'
import { PICKER_PAGE_SIZE, assistantPickerOptions, pickerPageOf } from '@/features/assistants/picker-options'
import { useCategoryLabel } from '@/features/assistants/use-category-label'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { afterNativeResize } from './native-resize'

const MANAGE = '__manage_assistants__',
  PREVIOUS = '__previous_assistants__',
  NEXT = '__next_assistants__'

// The floating assistant's picker: a header, three assistants per page with
// their source and category, previous and next page, and a footer that opens assistant management in the workspace.
export function AssistantPicker() {
  const ws = useWorkspace()
  const { t } = useT()
  const categoryLabel = useCategoryLabel()
  const state = ws.state
  const options = state ? assistantPickerOptions(state.assistants, state.settings.assistantId) : []
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const change = useRef(0)
  // Choosing previous or next is a Select item so arrows and Enter reach it; Radix then asks to close, which is kept.
  const turningPage = useRef(false)
  const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  const changeOpen = (value: boolean) => {
    if (!value && turningPage.current) {
      turningPage.current = false
      return
    }
    if (value && state) setPage(pickerPageOf(options, state.settings.assistantId))
    const version = ++change.current
    if (!value) setOpen(false)
    void ws.act(async () => {
      if (value) {
        // Radix Select dismisses on resize, so its popup mounts only after the grown window reaches this page.
        const heightBefore = window.innerHeight
        await ws.api.setBarPopoverOpen(true)
        await afterNativeResize(heightBefore)
      } else {
        await nextFrame()
        await nextFrame()
      }
      if (version !== change.current) return
      if (value) setOpen(true)
      else await ws.api.setBarPopoverOpen(false)
    })
  }
  useEffect(
    () => () => {
      change.current += 1
      void ws.api.setBarPopoverOpen(false).catch(() => {})
    },
    [ws.api],
  )
  if (!state) return null
  const shown = paginate(options, PICKER_PAGE_SIZE, page)
  const selected = state.assistants.find((assistant) => assistant.id === state.settings.assistantId)
  return (
    <Select
      open={open}
      onOpenChange={changeOpen}
      value={state.settings.assistantId}
      onValueChange={(id) => {
        if (id === PREVIOUS || id === NEXT) {
          turningPage.current = true
          setPage(shown.page + (id === NEXT ? 1 : -1))
        } else if (id === MANAGE)
          void ws.act(async () => {
            await ws.api.openAssistantLibrary()
          })
        else
          void ws.act(async () => {
            await ws.api.settings({ assistantId: id })
          })
      }}
    >
      <SelectTrigger
        aria-label={t('overlay.assistant')}
        title={t('overlay.assistantHint')}
        className="assistant-picker-trigger h-8 max-w-56 gap-2 rounded-full px-3 text-xs"
      >
        <BrandAssistants className="size-4 shrink-0 text-foreground [--brand-icon-accent:#2581ff]" aria-hidden="true" />
        <SelectValue>{selected?.name}</SelectValue>
      </SelectTrigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          side="top"
          align="center"
          sideOffset={6}
          className="assistant-picker-menu z-50 grid w-64 max-w-[calc(100vw-24px)] overflow-hidden rounded-lg duration-100 data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-2 motion-reduce:animate-none"
        >
          <div className="assistant-picker-header">
            <BrandAssistants className="size-4 [--brand-icon-accent:#2581ff]" aria-hidden="true" />
            {t('overlay.selectAssistant')}
          </div>
          {/* Paging and Manage assistants stay inside the viewport, where Radix lets arrow keys reach them. */}
          <SelectPrimitive.Viewport className="p-1">
            {shown.items.map((assistant) => (
              <SelectPrimitive.Item
                key={assistant.id}
                value={assistant.id}
                data-assistant-option
                className="assistant-picker-item"
              >
                <AssistantGlyph
                  id={assistant.id}
                  className="size-5 shrink-0 text-foreground [--brand-icon-accent:#2581ff]"
                />
                <span className="grid min-w-0 flex-1">
                  <SelectPrimitive.ItemText>{assistant.name}</SelectPrimitive.ItemText>
                  <span className="assistant-picker-source">
                    {isBuiltIn(assistant) ? t('overlay.builtIn') : t('assistants.custom')} ·{' '}
                    {categoryLabel(categoryOf(assistant))}
                  </span>
                </span>
                <SelectPrimitive.ItemIndicator>
                  <Check className="size-4 text-[#2581ff]" aria-hidden="true" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
            {shown.pageCount > 1 ? (
              <div className="assistant-picker-pager">
                <SelectPrimitive.Item
                  value={PREVIOUS}
                  disabled={shown.page <= 1}
                  aria-label={t('overlay.previousAssistants')}
                  className="assistant-picker-page-button"
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </SelectPrimitive.Item>
                <span className="assistant-picker-page" aria-live="polite">
                  {t('overlay.assistantPage', { page: shown.page, count: shown.pageCount })}
                </span>
                <SelectPrimitive.Item
                  value={NEXT}
                  disabled={shown.page >= shown.pageCount}
                  aria-label={t('overlay.nextAssistants')}
                  className="assistant-picker-page-button"
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </SelectPrimitive.Item>
              </div>
            ) : null}
            <div className="assistant-picker-footer">
              <SelectPrimitive.Item value={MANAGE} className="assistant-picker-item assistant-picker-manage">
                <BrandSettings className="size-4 shrink-0" aria-hidden="true" />
                <SelectPrimitive.ItemText>{t('overlay.manageAssistants')}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            </div>
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </Select>
  )
}
