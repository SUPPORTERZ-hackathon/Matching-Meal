"use client";

import type { ReactNode } from "react";
import { BottomAction } from "@/components/common/bottom-action";
import { FixedBottomAction } from "@/components/common/fixed-bottom-action";
import styles from "./room-waiting.module.css";

type RoomFixedActionProps = { children: ReactNode; note: string; hideOnKeyboard?: boolean };
export function RoomFixedAction({ children, note, hideOnKeyboard = false }: RoomFixedActionProps) {
  return <FixedBottomAction data-room-action hideOnKeyboard={hideOnKeyboard}><BottomAction>{children}<p className={styles.actionNote}>{note}</p></BottomAction></FixedBottomAction>;
}
