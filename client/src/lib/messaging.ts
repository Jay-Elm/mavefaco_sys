import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/roles";
import { signPrivateImages } from "@/lib/privateImages";

// Sender role : receiver role pairs allowed to message each other.
const CAN_MESSAGE = new Set([`${ROLES.CUSTOMER}:${ROLES.FARMER}`, `${ROLES.FARMER}:${ROLES.CUSTOMER}`]);

/**
 * Whether `actor` may send a message to user `receiverId`: a customer and a
 * farmer only (staff have no inbox), never yourself or a deleted account.
 * Returns the error and status to answer with, or null when allowed.
 */
export async function messageRefusal(
  actor: { id: number; role: string },
  receiverId: number,
): Promise<{ error: string; status: number } | null> {
  if (!Number.isInteger(receiverId)) return { error: "Invalid user ID", status: 400 };
  if (receiverId === actor.id) return { error: "Cannot message yourself", status: 400 };
  const receiver = await prisma.user.findUnique({ where: { id: receiverId, deletedAt: null }, select: { role: true } });
  if (!receiver) return { error: "User not found", status: 404 };
  if (!CAN_MESSAGE.has(`${actor.role}:${receiver.role}`))
    return { error: "Messages can only be sent between customers and farmers", status: 403 };
  return null;
}

/**
 * Adds `imageUrl` (a short-lived view link) to messages that carry a photo
 * and leaves the storage path out of what is sent to the browser.
 */
export async function withImageUrls<M extends { imagePath: string | null }>(messages: M[]) {
  const urls = await signPrivateImages(messages.map((m) => m.imagePath).filter((p): p is string => !!p));
  return messages.map(({ imagePath, ...m }) => ({ ...m, imageUrl: imagePath ? (urls.get(imagePath) ?? null) : null }));
}
