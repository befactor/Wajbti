-- DropIndex
DROP INDEX "WeightLog_userId_date_idx";

-- CreateIndex
CREATE UNIQUE INDEX "WeightLog_userId_date_key" ON "WeightLog"("userId", "date");
