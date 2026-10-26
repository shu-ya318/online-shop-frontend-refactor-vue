import { nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'

/** label 讀出來的文字：不含 aria-hidden 的部分（例如必填星號），和螢幕閱讀器唸的一樣 */
function labelText(label: HTMLLabelElement): string {
  const clone = label.cloneNode(true)
  if (!(clone instanceof HTMLElement)) return ''
  clone.querySelectorAll('[aria-hidden="true"]').forEach((el) => el.remove())
  return clone.textContent?.trim() ?? ''
}

/** 用 label 文字找輸入框：label 的 for 要等於 input 的 id，input 的 aria-labelledby 也要指回這個 label */
export function getInputByLabel(text: string, root: ParentNode = document): HTMLInputElement {
  const label = [...root.querySelectorAll('label')].find((el) => labelText(el) === text)
  if (!label) throw new Error(`找不到 label「${text}」`)

  const input = document.getElementById(label.htmlFor)
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`label「${text}」的 for="${label.htmlFor}" 沒有對到 <input>`)
  }

  if (input.getAttribute('aria-labelledby') !== label.id) {
    throw new Error(`輸入框的 aria-labelledby 沒有指回 label「${text}」`)
  }

  return input
}

/** 在 label 對應的輸入框輸入值並離開欄位（觸發 touched 與驗證），等畫面更新 */
export async function fillField(label: string, value: string): Promise<HTMLInputElement> {
  const input = getInputByLabel(label)
  input.focus()
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick() // 真實瀏覽器裡輸入與離開欄位不會在同一個 tick
  input.blur()
  await flushPromises()
  return input
}

/** 讀出 aria-describedby 指到的文字（錯誤訊息或說明）；沒有就回傳 null */
export function getDescription(input: HTMLElement): string | null {
  const id = input.getAttribute('aria-describedby')
  if (!id) return null
  return document.getElementById(id)?.textContent?.trim() ?? null
}

/**
 * 在輸入框按 Enter，並模擬瀏覽器的「Enter 送出表單」：
 * keydown 的預設動作沒有被取消，瀏覽器就會送出表單（jsdom 沒有這個行為，這裡用 requestSubmit 補上）。
 * 回傳 keydown 事件，測試可以檢查 defaultPrevented。
 */
export function pressEnter(
  input: HTMLInputElement,
  init: Pick<KeyboardEventInit, 'isComposing' | 'keyCode'> = {},
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
    ...init,
  })
  input.dispatchEvent(event)
  if (!event.defaultPrevented) {
    input.form?.requestSubmit()
  }
  return event
}
