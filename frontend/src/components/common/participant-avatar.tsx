import { cn } from "cn";

export type ParticipantAvatarProps = {
  nickname: string;
  avatarText?: string;
  tone?: "peach" | "pink" | "blue";
  state?: "default" | "waiting" | "complete";
  size?: "default" | "lg";
  className?: string;
};

const AVATAR_TEXT_LENGTH = 2;

export function ParticipantAvatar({
  nickname,
  avatarText,
  tone = "peach",
  state = "default",
  size = "default",
  className,
}: ParticipantAvatarProps) {
  const name = nickname.trim() || "名前未設定";
  const initials = Array.from(avatarText?.trim() || nickname.trim() || "?").slice(0, AVATAR_TEXT_LENGTH).join("");

  return (
    <div className={cn("meal-participant", className)}>
      <span className="meal-avatar" data-tone={tone} data-state={state} data-size={size} aria-hidden="true">
        {initials}
        {state !== "default" && <span className="meal-avatar-badge">{state === "complete" ? "✓" : "…"}</span>}
      </span>
      <span className="min-w-0">
        <span className="meal-participant-name">{name}</span>
        {state !== "default" && <span className="meal-participant-state">{state === "complete" ? "完了" : "待機中"}</span>}
      </span>
    </div>
  );
}
