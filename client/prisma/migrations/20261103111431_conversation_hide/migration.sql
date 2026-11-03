-- Conversations someone removed from their own Messages list (messages up to
-- hiddenAt stay hidden for them only).
CREATE TABLE "ConversationHide" (
    "userId" INTEGER NOT NULL,
    "otherId" INTEGER NOT NULL,
    "hiddenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationHide_pkey" PRIMARY KEY ("userId","otherId")
);
