-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "cpf" TEXT;
ALTER TABLE "Employee" ADD COLUMN "dataNascimento" DATETIME;
ALTER TABLE "Employee" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Employee" ADD COLUMN "enderecoBairro" TEXT;
ALTER TABLE "Employee" ADD COLUMN "enderecoCep" TEXT;
ALTER TABLE "Employee" ADD COLUMN "enderecoCidade" TEXT;
ALTER TABLE "Employee" ADD COLUMN "enderecoEstado" TEXT;
ALTER TABLE "Employee" ADD COLUMN "enderecoNumero" TEXT;
ALTER TABLE "Employee" ADD COLUMN "enderecoRua" TEXT;
ALTER TABLE "Employee" ADD COLUMN "estadoCivil" TEXT;
ALTER TABLE "Employee" ADD COLUMN "rg" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Employee_cpf_key" ON "Employee"("cpf");
