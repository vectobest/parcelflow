import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue } from 'motion/react';
import { projectRest, releaseVelocity } from '../utils/gesture.js';

const ToastContext = createContext(null);

const TOAST_SPRING = { type: 'spring', visualDuration: 0.4, bounce: 0 };
const TOAST_FLING = { type: 'spring', visualDuration: 0.2, bounce: 0 };
const TONE_CLASSES = {
  error: 'bg-error-container text-error border-error',
  warning: 'bg-secondary-container text-secondary border-secondary',
  default: 'bg-surface-container-high text-on-surface border-tertiary'
};

function Toast({ toast, onDismiss }) {
  const x = useMotionValue(0);
  const lastDragMoveAt = useRef(0);

  function onDragEnd(_event, info) {
    const velocity = releaseVelocity(info.velocity.x, lastDragMoveAt.current);
    if (projectRest(info.offset.x, velocity) > 100) {
      // Keep the finger's speed so the toast leaves at the pace it was thrown; loose rest thresholds since it's off-screen.
      animate(x, 480, { ...TOAST_FLING, velocity, restDelta: 20, restSpeed: 200, onComplete: () => onDismiss(toast.id) });
    } else {
      animate(x, 0, { ...TOAST_SPRING, velocity });
    }
  }

  return (
    <motion.div
      layout
      role={toast.type === 'error' ? 'alert' : 'status'}
      className={`px-space-md py-space-sm rounded-xl font-code-sm text-code-sm shadow-lg border-l-2 cursor-grab active:cursor-grabbing select-none ${TONE_CLASSES[toast.type] || TONE_CLASSES.default}`}
      style={{ x, touchAction: 'pan-y' }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={TOAST_SPRING}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0.1, right: 1 }}
      dragMomentum={false}
      onDrag={() => { lastDragMoveAt.current = performance.now(); }}
      onDragEnd={onDragEnd}
    >
      {toast.message}
    </motion.div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((item) => item.id !== id)), []);

  const toast = useCallback((message, type = '') => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => dismiss(id), type === 'error' ? 7000 : 4000);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-space-lg right-space-lg z-[100] flex flex-col gap-space-xs max-w-sm" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((t) => <Toast key={t.id} toast={t} onDismiss={dismiss} />)}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider.');
  return ctx;
}
