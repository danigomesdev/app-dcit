-- CreateTable
CREATE TABLE "WorkedHoursEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gestorId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "horasTrabalhadas" REAL NOT NULL,
    "horasTickets" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkedHoursEntry_userId_date_key" ON "WorkedHoursEntry"("userId", "date");
