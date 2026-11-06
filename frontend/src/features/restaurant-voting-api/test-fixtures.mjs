export const roomId = "550e8400-e29b-41d4-a716-446655440000";
export const hostId = "550e8400-e29b-41d4-a716-446655440001";
export const memberId = "550e8400-e29b-41d4-a716-446655440002";
export const room = { id: roomId, joinCode: "7K9M2QXR", status: "restaurant_voting", version: 7, expiresAt: "2026-11-05T12:00:00Z" };
export const host = { id: hostId, nickname: "同じ名前", role: "host" };
export const member = { id: memberId, nickname: "同じ名前", role: "member" };
export const session = { room, participant: host, sessionToken: "unit-test-only-token" };
export const restaurants = [
  { id: "J001", name: "店舗1", photoUrl: "https://img.example.test/1.jpg", openingHours: "11:00〜23:00", closedDays: null, dinnerBudget: "3000円", access: "徒歩3分", stationName: "渋谷", detailUrl: "https://www.hotpepper.jp/strJ001/", coordinates: { latitude: 35.5, longitude: 139.7 }, source: "hotpepper" },
  { id: "J002", name: "店舗2", photoUrl: null, openingHours: null, closedDays: null, dinnerBudget: null, access: null, stationName: null, detailUrl: null, coordinates: null, source: "hotpepper" },
];
export const candidateResponse = { data: { room: { id: roomId, status: "restaurant_voting", version: 7, expiresAt: room.expiresAt }, genreId: "ramen", restaurants } };
export function votingResponse({ submitted = false, complete = false } = {}) {
  const participants = [{ ...host, submitted }, { ...member, submitted: complete }];
  const decided = submitted && complete;
  return { data: {
    room: { ...room, status: decided ? "decided" : "restaurant_voting", version: decided ? 9 : submitted ? 8 : 7 },
    currentParticipantId: hostId, submitted, submittedAt: submitted ? "2026-11-04T12:00:00Z" : null,
    submittedParticipantCount: participants.filter((row) => row.submitted).length, totalParticipantCount: 2, participants,
    result: decided ? { restaurant: restaurants[0], likeCount: 2, decisionMethod: "most_likes", decidedAt: "2026-11-04T12:01:00Z" } : null,
  } };
}
