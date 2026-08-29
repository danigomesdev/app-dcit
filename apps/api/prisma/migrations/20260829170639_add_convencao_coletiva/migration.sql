-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "convencaoId" TEXT;
ALTER TABLE "Employee" ADD COLUMN "salarioMensal" REAL;

-- CreateTable
CREATE TABLE "ConvencaoColetiva" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "categoriaSindical" TEXT,
    "expectedDailyMinutes" INTEGER NOT NULL,
    "overtimePercent" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
