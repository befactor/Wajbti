-- AlterTable
ALTER TABLE "MealPlan" ADD COLUMN     "completedMeals" JSONB NOT NULL DEFAULT '[]';
