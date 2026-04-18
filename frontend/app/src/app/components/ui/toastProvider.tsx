import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
} from "react";

type ToastVariant = "default" | "success" | "destructive" | "loading";

type Toast = {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastContextType = {
  toast: (t: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
  toastPromise: <T>
    (promise: Promise<T>, 
     msgs: { 
        loading: string; 
        success: string; 
        error: string }
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
    const id = crypto.randomUUID();

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
      msgs: {
        loading: string;
        success: string;
        error: string;
      }
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

        toast({
          title: "Error",
          description: msgs.error,
          variant: "destructive",
        });

        throw e;
      }
  },
  [toast, dismiss]
);
  return (
    <ToastContext.Provider value={{ toast, dismiss, toastPromise }}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
  function ToastViewport({
  toasts,
  dismiss,
}: {
  toasts: Toast[];
  dismiss: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[90%] max-w-md flex flex-col-reverse gap-2 z-50">
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
  const startX = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null) return;
    const delta = e.touches[0].clientX - startX.current;
    setDragX(delta);
  };

  const onTouchEnd = () => {
    if (Math.abs(dragX) > 100) {
      dismiss(toast.id);
    }
    setDragX(0);
    startX.current = null;
  };

  const variantStyles = {
    default: "bg-gray-900 text-white",
    success: "bg-green-500 text-white",
    destructive: "bg-red-500 text-white",
    loading: "bg-blue-500 text-white",
  };
  

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ transform: `translateX(${dragX}px)` }}
      className={`px-4 py-3 rounded-lg shadow-lg transition-all duration-300
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
          className="opacity-70 hover:opacity-100"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
}