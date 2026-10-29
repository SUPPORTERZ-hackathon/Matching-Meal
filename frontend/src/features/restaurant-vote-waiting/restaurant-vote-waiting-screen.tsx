import { GenreVoteWaitingScreen } from "../genre-vote-waiting/genre-vote-waiting-screen";
import type { WaitingParticipant } from "../genre-vote-waiting/waiting-state";

type RestaurantVoteWaitingScreenProps = { participants: readonly WaitingParticipant[]; roomId?: string };

export function RestaurantVoteWaitingScreen({ participants, roomId }: RestaurantVoteWaitingScreenProps) {
  return <GenreVoteWaitingScreen participants={participants} roomId={roomId} currentStep="shop" voteSubject="店舗" />;
}
