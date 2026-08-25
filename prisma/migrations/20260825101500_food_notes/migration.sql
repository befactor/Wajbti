-- CreateTable
CREATE TABLE "FoodNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'chat',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FoodNote_userId_idx" ON "FoodNote"("userId");

-- AddForeignKey
ALTER TABLE "FoodNote" ADD CONSTRAINT "FoodNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
