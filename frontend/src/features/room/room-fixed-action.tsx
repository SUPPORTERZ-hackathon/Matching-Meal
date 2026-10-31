"use client";

import type { ReactNode } from "react";
import { BottomAction } from "@/components/common/bottom-action";
import { FixedBottomAction } from "@/components/common/fixed-bottom-action";
import styles from "./room-waiting.module.css";

type RoomFixedActionProps = { children: ReactNode; note: string };
export function RoomFixedAction({ children, note }: RoomFixedActionProps) {
  return <FixedBottomAction data-room-action><BottomAction>{children}<p className={styles.actionNote}>{note}</p></BottomAction></FixedBottomAction>;
}
