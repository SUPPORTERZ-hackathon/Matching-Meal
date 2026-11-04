import { GENRES } from "../genre-vote/genres";
import type { RestaurantResultData } from "../restaurant-result/result-data";
import { safeRestaurantDetailUrl, safeRestaurantPhotoUrl, type RestaurantCandidate } from "../restaurant-vote/restaurant-data";
import type { RestaurantVote } from "../restaurant-vote/vote-state";
import type { WaitingParticipant } from "../genre-vote-waiting/waiting-state";
import { isRoomId, parseSnapshotResponse, type JsonValue, type RoomSnapshot } from "../room/room-data";

type JsonObject = { [key: string]: JsonValue };
const object = (value: JsonValue): JsonObject | undefined => value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;
const nullableText = (value: JsonValue): string | undefined | null => value === null ? undefined : typeof value === "string" ? value.trim() || undefined : null;
const isDate = (value: JsonValue): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const DECISION_METHODS = ["most_likes", "random_tie", "random_all_skipped"] as const;
export type RestaurantDecisionMethod = typeof DECISION_METHODS[number];

export type RestaurantCandidatesSnapshot = {
  room: { id: string; status: "restaurant_voting" | "decided"; version: number; expiresAt: string };
  genreId: string;
  restaurants: readonly RestaurantCandidate[];
};
export type RestaurantVotingParticipant = RoomSnapshot["participants"][number] & { submitted: boolean };
export type RestaurantVotingResult = {
  restaurant: RestaurantCandidate;
  likeCount: number;
  decisionMethod: RestaurantDecisionMethod;
  decidedAt: string;
};
export type RestaurantVotingSnapshot = Omit<RoomSnapshot, "participants"> & {
  submitted: boolean;
  submittedAt: string | null;
  submittedParticipantCount: number;
  totalParticipantCount: number;
  participants: RestaurantVotingParticipant[];
  result: RestaurantVotingResult | null;
};
export type RestaurantVotingStage = "vote" | "waiting" | "result";

function parseCoordinates(value: JsonValue): RestaurantCandidate["coordinates"] | null {
  if (value === null) return undefined;
  const raw = object(value);
  if (!raw || typeof raw.latitude !== "number" || typeof raw.longitude !== "number"
    || !Number.isFinite(raw.latitude) || !Number.isFinite(raw.longitude)
    || Math.abs(raw.latitude) > 90 || Math.abs(raw.longitude) > 180) return null;
  return { latitude: raw.latitude, longitude: raw.longitude };
}

export function parseRestaurantCandidate(value: JsonValue): RestaurantCandidate | undefined {
  const raw = object(value);
  if (!raw || typeof raw.id !== "string" || !raw.id.trim() || typeof raw.name !== "string" || !raw.name.trim()
    || raw.source !== "hotpepper") return;
  const photo = nullableText(raw.photoUrl ?? null), openingHours = nullableText(raw.openingHours ?? null);
  const closedDays = nullableText(raw.closedDays ?? null), dinnerBudget = nullableText(raw.dinnerBudget ?? null);
  const access = nullableText(raw.access ?? null), stationName = nullableText(raw.stationName ?? null);
  const detail = nullableText(raw.detailUrl ?? null), coordinates = parseCoordinates(raw.coordinates ?? null);
  if ([photo, openingHours, closedDays, dinnerBudget, access, stationName, detail, coordinates].includes(null)) return;
  if (photo && safeRestaurantPhotoUrl(photo) !== photo) return;
  if (detail && safeRestaurantDetailUrl(detail) !== detail) return;
  return {
    id: raw.id.trim(), name: raw.name.trim(), source: "hotpepper",
    ...(photo ? { photoUrl: photo } : {}), ...(openingHours ? { openingHours } : {}),
    ...(closedDays ? { closedDays } : {}), ...(dinnerBudget ? { dinnerBudget } : {}),
    ...(access ? { access } : {}), ...(stationName ? { stationName } : {}),
    ...(detail ? { detailUrl: detail } : {}), ...(coordinates ? { coordinates } : {}),
  };
}

export function parseRestaurantCandidatesResponse(value: JsonValue): RestaurantCandidatesSnapshot | undefined {
  const data = object(object(value)?.data ?? null), room = object(data?.room ?? null);
  if (!data || !room || typeof room.id !== "string" || !isRoomId(room.id)
    || (room.status !== "restaurant_voting" && room.status !== "decided")
    || typeof room.version !== "number" || !Number.isSafeInteger(room.version) || room.version < 1
    || !isDate(room.expiresAt ?? null) || typeof data.genreId !== "string" || !GENRES.some((genre) => genre.id === data.genreId)
    || !Array.isArray(data.restaurants) || data.restaurants.length < 1 || data.restaurants.length > 5) return;
  const restaurants = data.restaurants.map(parseRestaurantCandidate);
  if (restaurants.some((restaurant) => !restaurant)) return;
  const rows = restaurants.filter((restaurant): restaurant is RestaurantCandidate => restaurant !== undefined);
  if (new Set(rows.map((restaurant) => restaurant.id)).size !== rows.length) return;
  return { room: { id: room.id.toLowerCase(), status: room.status, version: room.version, expiresAt: room.expiresAt as string }, genreId: data.genreId as string, restaurants: rows };
}

export function parseRestaurantVotingResponse(value: JsonValue): RestaurantVotingSnapshot | undefined {
  const base = parseSnapshotResponse(value), data = object(object(value)?.data ?? null);
  if (!base || !data || typeof data.submitted !== "boolean" || !Array.isArray(data.participants)
    || typeof data.totalParticipantCount !== "number" || !Number.isSafeInteger(data.totalParticipantCount) || data.totalParticipantCount !== base.participants.length
    || typeof data.submittedParticipantCount !== "number" || !Number.isSafeInteger(data.submittedParticipantCount) || data.submittedParticipantCount < 0) return;
  const participants: RestaurantVotingParticipant[] = [];
  for (const [index, row] of data.participants.entries()) {
    const raw = object(row);
    if (!raw || typeof raw.submitted !== "boolean") return;
    participants.push({ ...base.participants[index], submitted: raw.submitted });
  }
  if (participants.filter((person) => person.submitted).length !== data.submittedParticipantCount
    || participants.find((person) => person.id === base.currentParticipantId)?.submitted !== data.submitted
    || (data.submitted ? !isDate(data.submittedAt ?? null) : data.submittedAt !== null)) return;
  let result: RestaurantVotingResult | null = null;
  if (data.result !== null) {
    const raw = object(data.result ?? null), restaurant = parseRestaurantCandidate(raw?.restaurant ?? null);
    if (!raw || !restaurant || typeof raw.likeCount !== "number" || !Number.isSafeInteger(raw.likeCount)
      || raw.likeCount < 0 || raw.likeCount > participants.length || typeof raw.decisionMethod !== "string"
      || !DECISION_METHODS.includes(raw.decisionMethod as RestaurantDecisionMethod) || !isDate(raw.decidedAt ?? null)
      || base.room.status !== "decided" || !data.submitted || data.submittedParticipantCount !== participants.length) return;
    const decisionMethod = raw.decisionMethod as RestaurantDecisionMethod;
    if ((decisionMethod === "random_all_skipped") !== (raw.likeCount === 0)) return;
    result = { restaurant, likeCount: raw.likeCount, decisionMethod, decidedAt: raw.decidedAt as string };
  } else if (base.room.status === "decided" || data.submittedParticipantCount === participants.length) return;
  return { ...base, participants, submitted: data.submitted, submittedAt: data.submittedAt as string | null,
    submittedParticipantCount: data.submittedParticipantCount as number, totalParticipantCount: participants.length, result };
}

export function validRestaurantVotePrefix(votes: readonly RestaurantVote[], restaurants: readonly RestaurantCandidate[], sealed = false): boolean {
  return votes.length <= restaurants.length && (!sealed || votes.length === restaurants.length)
    && votes.every((vote, index) => vote.restaurantId === restaurants[index]?.id && (vote.choice === "like" || vote.choice === "skip"));
}
export function restaurantVotingStage(state: RestaurantVotingSnapshot): RestaurantVotingStage {
  return state.result ? "result" : state.submitted ? "waiting" : "vote";
}
export function restaurantVotingUrl(stage: RestaurantVotingStage, roomId: string): string {
  const paths: Record<RestaurantVotingStage, string> = { vote: "/restaurant-vote", waiting: "/restaurant-vote-waiting", result: "/restaurant-result" };
  return `${paths[stage]}?room=${encodeURIComponent(roomId)}`;
}
export function waitingRestaurantParticipants(state: RestaurantVotingSnapshot): readonly WaitingParticipant[] {
  const tones = ["peach", "pink", "blue"] as const;
  return state.participants.map((person, index) => ({ id: person.id, nickname: person.nickname, tone: tones[index % tones.length], state: person.submitted ? "complete" : "waiting" }));
}
export function restaurantResultPresentation(state: RestaurantVotingSnapshot, candidates: RestaurantCandidatesSnapshot): RestaurantResultData | undefined {
  return state.result ? { genreId: candidates.genreId, restaurantId: state.result.restaurant.id,
    votes: { likes: state.result.likeCount, total: state.totalParticipantCount } } : undefined;
}
