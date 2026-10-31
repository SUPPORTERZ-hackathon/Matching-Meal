"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { BottomAction } from "@/components/common/bottom-action";
import styles from "./room-waiting.module.css";

type RoomFixedActionProps = { children: ReactNode; note: string };
export function RoomFixedAction({ children, note }: RoomFixedActionProps) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current, page = element?.closest<HTMLElement>(".meal-page");
    if (!element || !page) return;
    const reserve = () => page.style.setProperty("--room-action-height", `${Math.ceil(element.getBoundingClientRect().height)}px`);
    reserve();
    const observer = new ResizeObserver(reserve);
    observer.observe(element, { box: "border-box" });
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={styles.fixedAction} data-room-action><BottomAction>{children}<p className={styles.actionNote}>{note}</p></BottomAction></div>;
}
