import { describe, expect, it } from "vitest";
import { GET as conversations } from "./route";
import { GET as thread, POST as send } from "./[userId]/route";
import { prisma } from "@/lib/prisma";
import { createUser, params, request, type SessionUser } from "@/test-utils/integration/helpers";

const post = (as: SessionUser | undefined, toId: number, content: unknown = "Hello") =>
  send(request(`/api/messages/${toId}`, { method: "POST", as, body: { content } }), params({ userId: String(toId) }));
const read = async (as: SessionUser, withId: number) =>
  (await thread(request(`/api/messages/${withId}`, { as }), params({ userId: String(withId) }))).json();
const inbox = async (as: SessionUser) => (await conversations(request("/api/messages", { as }))).json();

describe("POST /api/messages/[userId]", () => {
  it("sends a message as the logged-in user", async () => {
    const customer = await createUser();
    const farmer = await createUser({ role: "farmer" });

    const res = await post(customer, farmer.id, "  Are the mangoes ripe?  ");

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ senderId: customer.id, receiverId: farmer.id, content: "Are the mangoes ripe?", read: false });
  });

  it.each([
    ["an empty message", "   ", 400],
    ["a message to yourself", "Hi", 400],
  ])("rejects %s", async (_, content, status) => {
    const user = await createUser();
    const to = content === "Hi" ? user.id : (await createUser()).id;

    expect((await post(user, to, content)).status).toBe(status);
    expect(await prisma.message.count()).toBe(0);
  });

  it("returns 404 for a recipient that doesn't exist, and 401 without a session", async () => {
    const user = await createUser();

    expect((await post(user, 99999)).status).toBe(404);
    expect((await post(undefined, user.id)).status).toBe(401);
  });
});

describe("GET /api/messages/[userId]", () => {
  it("returns both directions oldest first and marks only the reader's incoming messages read", async () => {
    const alice = await createUser();
    const bob = await createUser({ role: "farmer" });
    await post(alice, bob.id, "one");
    await post(bob, alice.id, "two");
    await post(alice, bob.id, "three");

    const messages = await read(bob, alice.id);

    expect(messages.map((m: { content: string }) => m.content)).toEqual(["one", "two", "three"]);
    expect(Object.keys(messages[0].sender).sort()).toEqual(["id", "name"]);
    const state = await prisma.message.findMany({ orderBy: { id: "asc" }, select: { content: true, read: true } });
    expect(state).toEqual([
      { content: "one", read: true }, // to bob, now read
      { content: "two", read: false }, // bob's own outgoing message, untouched
      { content: "three", read: true },
    ]);
  });

  it("never shows a third party someone else's conversation", async () => {
    const alice = await createUser();
    const bob = await createUser({ role: "farmer" });
    const eve = await createUser();
    await post(alice, bob.id, "private");

    expect(await read(eve, bob.id)).toEqual([]);
    expect(await read(eve, alice.id)).toEqual([]);
    expect((await prisma.message.findFirstOrThrow()).read).toBe(false); // eve's reads changed nothing
  });
});

describe("GET /api/messages (conversation list)", () => {
  it("groups by the other person with the latest message and an unread count", async () => {
    const farmer = await createUser({ role: "farmer" });
    const alice = await createUser({ name: "Alice" });
    const bob = await createUser({ name: "Bob" });
    await post(alice, farmer.id, "a1");
    await post(alice, farmer.id, "a2");
    await post(farmer, bob.id, "f→b");
    await post(bob, farmer.id, "b1");

    const list = await inbox(farmer);

    expect(list.map((c: { user: { name: string }; lastMessage: string; unread: number }) => [c.user.name, c.lastMessage, c.unread])).toEqual([
      ["Bob", "b1", 1],
      ["Alice", "a2", 2],
    ]);

    await read(farmer, alice.id);
    const after = await inbox(farmer);
    expect(after.find((c: { user: { id: number } }) => c.user.id === alice.id).unread).toBe(0);
  });
});
