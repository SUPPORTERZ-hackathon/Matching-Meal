export type WaitingParticipant = {
  readonly id: string;
  readonly nickname: string;
  readonly avatarText?: string;
  readonly tone: "peach" | "pink" | "blue";
  readonly state: "complete" | "waiting";
};

export type WaitingSummary = {
  readonly total: number;
  readonly completed: number;
  readonly remaining: number;
  readonly percentage: number;
  readonly allComplete: boolean;
};

const PERCENTAGE_SCALE = 100;

export function summarizeParticipants(participants: readonly WaitingParticipant[]): WaitingSummary {
  const total = participants.length;
  const completed = participants.filter((participant) => participant.state === "complete").length;
  const remaining = total - completed;

  return {
    total,
    completed,
    remaining,
    percentage: total > 0 ? completed / total * PERCENTAGE_SCALE : 0,
    allComplete: total > 0 && remaining === 0,
  };
}
