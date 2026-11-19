"use client"

import { useSyncExternalStore } from "react"

type Modal = { element: HTMLDialogElement; focus: HTMLElement }
const modals: Modal[] = []
const listeners = new Set<() => void>()
const emit = () => { for (const listener of listeners) listener() }
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Keep retained portals inside the active native modal's interaction tree. */
export function registerNativeModal(element: HTMLDialogElement) {
  const active = element.ownerDocument.activeElement
  const modal: Modal = { element, focus: active instanceof HTMLElement && element.contains(active) ? active : element }
  const remember = (event: FocusEvent) => {
    const target = event.target
    if (target instanceof HTMLElement && target.closest("dialog") === element && !target.closest('[role="alertdialog"]')) modal.focus = target
  }
  element.addEventListener("focusin", remember, true)
  modals.push(modal)
  emit()
  return () => {
    element.removeEventListener("focusin", remember, true)
    const index = modals.indexOf(modal)
    if (index >= 0) modals.splice(index, 1)
    emit()
  }
}

export function nativeModalContainer() {
  return modals.findLast(modal => modal.element.isConnected)?.element
}

export function nativeModalFocus(element: HTMLDialogElement) {
  return modals.findLast(modal => modal.element === element)?.focus ?? element
}

export function useNativeModalContainer() {
  return useSyncExternalStore(subscribe, nativeModalContainer, () => undefined)
}
