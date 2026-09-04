-- CreateTable
CREATE TABLE "CareerEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "nivelAvaliado" TEXT NOT NULL,
    "proximoNivel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'salva',
    "resultado" TEXT,
    "mediaGeral" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "decidedAt" DATETIME
);

-- CreateTable
CREATE TABLE "CareerPrincipioScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evaluationId" TEXT NOT NULL,
    "principio" TEXT NOT NULL,
    "nota" INTEGER NOT NULL,
    "justificativa" TEXT
);

-- CreateTable
CREATE TABLE "CareerCompetenciaScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evaluationId" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "nota" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "CareerRequisitoCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evaluationId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "atendido" BOOLEAN NOT NULL DEFAULT false
);
