import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
type Notice = { id: number; message: string; kind: "info" | "error" };
const Context = createContext<(message: string, kind?: Notice["kind"]) => void>(() => undefined);
export function Notifications({ children }: { children: ReactNode }) { const [items, setItems] = useState<Notice[]>([]); const notify = useCallback((message: string, kind: Notice["kind"] = "info") => { const id = Date.now(); setItems((current) => [...current, { id, message, kind }]); window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4000); }, []); const value = useMemo(() => notify, [notify]); return <Context.Provider value={value}>{children}<aside className="notifications" aria-live="polite">{items.map((item) => <div className={item.kind} key={item.id}>{item.message}</div>)}</aside></Context.Provider>; }
export const useNotify = () => useContext(Context);
