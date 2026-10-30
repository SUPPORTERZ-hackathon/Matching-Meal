import { MOCK_WAITING_PARTICIPANTS } from "../genre-vote-waiting/prototype-data";
import type { WaitingParticipant } from "../genre-vote-waiting/waiting-state";

// 表示確認用の独立モック。自分/他人の実投票・保存状態とは同期しない。
export const MOCK_RESTAURANT_PARTICIPANTS: readonly WaitingParticipant[] = MOCK_WAITING_PARTICIPANTS.map((participant) => ({ ...participant, id: `restaurant-${participant.id}` }));
