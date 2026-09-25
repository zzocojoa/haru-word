'use client';
import { createContext, useCallback, useContext, useId, useLayoutEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { useNavigationGuard } from './navigation';
import { installSheetSwipe } from './sheet-swipe';

type Protection = { dirty: boolean; blocked: boolean };
type SheetContext = { register: (id: string, value: Protection) => () => void; close: () => Promise<boolean>; blocked: () => boolean; disabled: boolean };
const Context = createContext<SheetContext | null>(null);

/** UI dismissal only. Saved state and successful submit commands keep their existing paths. */
export function SheetDialog({ navigationKey, blocked = false, dirty = false, open, onOpenChange, children, ...props }:
  ComponentProps<typeof Dialog> & { navigationKey: string; blocked?: boolean; dirty?: boolean }) {
  const guards = useRef(new Map<string, Protection>());
  const [childrenBlocked, setChildrenBlocked] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const pending = useRef<{ promise: Promise<boolean>; resolve: (answer: boolean) => void } | null>(null);
  const alive = useRef(true);
  const latest = useRef({ open, blocked, dirty, onOpenChange });
  useLayoutEffect(() => { latest.current = { open, blocked, dirty, onOpenChange }; });
  const isBlocked = useCallback(() => latest.current.blocked || [...guards.current.values()].some(g => g.blocked), []);
  const settle = useCallback((answer: boolean) => {
    pending.current?.resolve(answer); pending.current = null; setConfirm(false);
  }, []);
  useLayoutEffect(() => { alive.current = true; return () => { alive.current = false; pending.current?.resolve(false); pending.current = null; }; }, []);
  useLayoutEffect(() => { if (!open) { pending.current?.resolve(false); pending.current = null; } }, [open]);
  if (!open && confirm) setConfirm(false);
  const permit = useCallback(async () => {
    if (!alive.current || !latest.current.open || isBlocked()) return false;
    if (!(latest.current.dirty || [...guards.current.values()].some(g => g.dirty))) return true;
    if (!pending.current) {
      let resolve!: (answer: boolean) => void;
      const promise = new Promise<boolean>(done => { resolve = done; });
      pending.current = { promise, resolve }; setConfirm(true);
    }
    return await pending.current.promise && alive.current && !!latest.current.open && !isBlocked();
  }, [isBlocked]);
  const close = useCallback(async () => {
    if (!await permit()) return false;
    latest.current.onOpenChange?.(false); return true;
  }, [permit]);
  const register = useCallback((id: string, value: Protection) => {
    guards.current.set(id, value); setChildrenBlocked([...guards.current.values()].some(g => g.blocked));
    return () => { guards.current.delete(id); setChildrenBlocked([...guards.current.values()].some(g => g.blocked)); };
  }, []);
  const disabled = blocked || childrenBlocked;
  const context = useMemo(() => ({ register, close, blocked: isBlocked, disabled }), [register, close, isBlocked, disabled]);
  useNavigationGuard(changed => !open || !changed.has(navigationKey) ? true : permit());
  return <Context.Provider value={context}>
    <Dialog {...props} open={open} onOpenChange={value => { if (value) onOpenChange?.(true); else void close(); }}>{children}</Dialog>
    <AlertDialog open={confirm} onOpenChange={value => { if (!value) settle(false); }}>
      <AlertDialogContent className="sheet-discard-confirm"><AlertDialogHeader><AlertDialogTitle>변경 내용을 버릴까요?</AlertDialogTitle><AlertDialogDescription>저장하지 않은 입력은 사라져요.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel onClick={() => settle(false)}>계속 편집</AlertDialogCancel><AlertDialogAction disabled={disabled} onClick={() => settle(true)}>변경 버리고 닫기</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </Context.Provider>;
}

export function useSheetProtection(dirty: boolean, blocked = false) {
  const context = useContext(Context), id = useId();
  const register = context?.register;
  useLayoutEffect(() => register?.(id, { dirty, blocked }), [register, id, dirty, blocked]);
}

export function SheetDialogContent({ children, className = '', ...props }: ComponentProps<typeof DialogContent>) {
  const context = useContext(Context);
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => element && context ? installSheetSwipe(element, context.close, context.blocked) : undefined, [element, context]);
  return <DialogContent {...props} ref={setElement} className={`sheet-dialog ${className}`}>
    <button className="sheet-handle" data-sheet-handle type="button" disabled={context?.disabled} aria-label="아래로 쓸거나 눌러 닫기" onClick={() => void context?.close()}><span aria-hidden="true"/></button>
    {children}
  </DialogContent>;
}
