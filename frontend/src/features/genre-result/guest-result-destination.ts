import { roomResumeUrl, type Room, type RoomParticipant } from "../room/room-data";

export function guestResultDestination(role: RoomParticipant["role"], room: Pick<Room, "id" | "status">): string | undefined {
  if (role !== "member" || (room.status !== "restaurant_voting" && room.status !== "decided")) return;
  return roomResumeUrl(room);
}
