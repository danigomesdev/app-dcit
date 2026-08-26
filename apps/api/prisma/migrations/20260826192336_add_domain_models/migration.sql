-- CreateTable
CREATE TABLE "AdjustmentRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CompensationRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "VacationRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "days" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Employee" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "hireDate" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VacationHistoryEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "daysTaken" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Atestado" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "cid" TEXT,
    "crm" TEXT,
    "medico" TEXT,
    "dias" INTEGER,
    "photoUri" TEXT,
    "status" TEXT NOT NULL DEFAULT 'enviado',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "validUntil" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AdmissionDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "photoUri" TEXT,
    "status" TEXT NOT NULL DEFAULT 'enviado',
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "gross" REAL NOT NULL,
    "inss" REAL NOT NULL,
    "irrf" REAL NOT NULL,
    "benefits" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "MuralPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "glyph" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MuralReaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Birthday" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "day" INTEGER NOT NULL,
    "month" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "BenefitBalance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "balance" REAL NOT NULL,
    "monthlyCredit" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "discount" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "OnboardingTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "icon" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "OnboardingProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SobreavisoRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME
);

-- CreateTable
CREATE TABLE "DeslocamentoRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PushToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "MuralReaction_postId_userId_key" ON "MuralReaction"("postId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingProgress_userId_taskId_key" ON "OnboardingProgress"("userId", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken"("token");
