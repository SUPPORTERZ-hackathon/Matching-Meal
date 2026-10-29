import type { WaitingParticipant } from "./waiting-state";

export const GENRE_VOTE_WAITING_PATH = "/genre-vote-waiting";

// API未接続の表示確認用。実際の参加者や投票の同期状態を表すものではない。
// YUは投票画面を操作した本人の仮データとして扱う。
export const MOCK_WAITING_PARTICIPANTS: readonly WaitingParticipant[] = [
  { id: "prototype-yu", nickname: "YU", avatarText: "YU", tone: "peach", state: "complete" },
  { id: "prototype-mi", nickname: "MI", avatarText: "MI", tone: "pink", state: "complete" },
  { id: "prototype-ke", nickname: "KE", avatarText: "KE", tone: "blue", state: "waiting" },
];
