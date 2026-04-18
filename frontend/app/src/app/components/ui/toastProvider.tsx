import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
} from "react";

import {v4 as uuid} from "uuid";

type ToastVariant = "default" | "success" | "destructive" | "loading";

type Toast = {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastPromiseMessages = {
  loading: string;
  success: string;
  error: string | ((e: unknown) => string);
};

type ToastContextType = {
  toast: (t: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
  toastPromise: <T>
    (promise: Promise<T>, 
     msgs: ToastPromiseMessages
    ) => Promise<T>;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = uuid();

    const toastObj: Toast = {
      id,
      duration: 3000,
      ...t,
    };

    setToasts((prev) => [...prev, toastObj]);

    if (toastObj.duration !== Infinity) {
      setTimeout(() => dismiss(id), toastObj.duration);
    }

    return id;
  }, [dismiss]);
    
  const toastPromise = useCallback(
    async <T,>(
      promise: Promise<T>,
      msgs: ToastPromiseMessages
    ) => {
      const id = toast({
        title: "Loading",
        description: msgs.loading,
        variant: "loading",
        duration: Infinity,
      });

      try {
        const res = await promise;

        dismiss(id);

        toast({
          title: "Success",
          description: msgs.success,
          variant: "success",
        });

        return res;
    }   catch (e) {
        dismiss(id);

      const errorMessage =
        typeof msgs.error === "function"
          ? msgs.error(e)
          : msgs.error;

       toast({
        title: "Error",
         description: errorMessage,
        variant: "destructive",
        });
  
        throw e;
      }
  },
  [toast, dismiss]
);
try{
  return (
    <ToastContext.Provider value={{ toast, dismiss, toastPromise }}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}catch(e){
  console.error("Error rendering ToastProvider:",e);
}

  function ToastViewport({
  toasts,
  dismiss,
}: {
  toasts: Toast[];
  dismiss: (id: string) => void;
}) {
  return (
    <div className="h-auto fixed bottom-4 left-1/2 -translate-x-1/2 w-[90%] max-w-md flex flex-col-reverse gap-2 z-50">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} dismiss={dismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  dismiss,
}: {
  toast: Toast;
  dismiss: (id: string) => void;
}) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const lockedDirection = useRef<"horizontal" | "vertical" | null>(null);

  const DISMISS_THRESHOLD = 100;

  const onTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    lockedDirection.current = null;
    setIsDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null || startY.current === null) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - startX.current;
    const deltaY = touch.clientY - startY.current;

    if (!lockedDirection.current) {
      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        lockedDirection.current =
          Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
      }
    }

    if (lockedDirection.current !== "horizontal") return;

    setDragX(deltaX);
  };

  const resetGesture = () => {
    startX.current = null;
    startY.current = null;
    lockedDirection.current = null;
    setIsDragging(false);
  };

  const onTouchEnd = () => {
    if (lockedDirection.current === "horizontal") {
      if (Math.abs(dragX) > DISMISS_THRESHOLD) {
        dismiss(toast.id);
        resetGesture();
        return;
      }
    }

    setDragX(0);
    resetGesture();
  };

  const onTouchCancel = () => {
    setDragX(0);
    resetGesture();
  };

  const variantStyles = {
    default: "bg-gray-900 text-white",
    success: "bg-green-500 text-white",
    destructive: "bg-red-500 text-white",
    loading: "bg-blue-500 text-white",
  };

  const opacity = Math.max(0.4, 1 - Math.abs(dragX) / 220);

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      style={{
        transform: `translateX(${dragX}px)`,
        opacity,
        transition: isDragging ? "none" : "transform 0.2s ease, opacity 0.2s ease",
        touchAction: "pan-y",
      }}
      className={`px-4 py-3 rounded-lg shadow-lg will-change-transform
        animate-in slide-in-from-bottom fade-in
        ${variantStyles[toast.variant || "default"]}
      `}
    >
      <div className="flex justify-between items-start gap-3">
        <div>
          {toast.title && <div className="font-semibold">{toast.title}</div>}
          {toast.description && (
            <div className="text-sm opacity-90">{toast.description}</div>
          )}
        </div>

        <button
          onClick={() => dismiss(toast.id)}
          className="opacity-70 hover:opacity-100 shrink-0"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
}