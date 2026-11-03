import type { ReactNode } from "react";
import { GenreVoteWaitingScreen } from "../genre-vote-waiting/genre-vote-waiting-screen";
import type { WaitingParticipant } from "../genre-vote-waiting/waiting-state";

type RestaurantVoteWaitingScreenProps = { participants: readonly WaitingParticipant[]; roomId?: string; children?: ReactNode; notice?: ReactNode };

export function RestaurantVoteWaitingScreen({ participants, roomId, children, notice }: RestaurantVoteWaitingScreenProps) {
  return <GenreVoteWaitingScreen participants={participants} roomId={roomId} currentStep="shop" voteSubject="店舗" notice={notice}>{children}</GenreVoteWaitingScreen>;
}
