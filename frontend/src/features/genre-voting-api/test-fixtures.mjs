export const roomId = "11111111-1111-4111-8111-111111111111";
export const hostId = "22222222-2222-4222-8222-222222222222";
export const guestId = "33333333-3333-4333-8333-333333333333";
export const date = "2026-11-01T12:00:00Z";
export const room = { id: roomId, joinCode: "7K9M2QXR", status: "genre_voting", version: 3, expiresAt: date };
export const session = { room, participant: { id: hostId, nickname: "同じ名前", role: "host" }, sessionToken: "unit-test-only-token" };
export function state({ submitted = false, complete = false, method = "most_likes", genreId = "ramen", count = 2 } = {}) {
  return { data: { room: { ...room, status: complete ? "restaurant_searching" : "genre_voting", version: complete ? 5 : submitted ? 4 : 3 }, currentParticipantId: hostId,
    submitted, submittedAt: submitted ? date : null, submittedParticipantCount: complete ? 2 : submitted ? 1 : 0, totalParticipantCount: 2,
    participants: [{ ...session.participant, submitted }, { id: guestId, nickname: "同じ名前", role: "member", submitted: complete }],
    result: complete ? { genreId, likeCount: count, decisionMethod: method, decidedAt: date } : null } };
}
