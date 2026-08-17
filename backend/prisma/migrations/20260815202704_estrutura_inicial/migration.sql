-- CreateEnum
CREATE TYPE "StatusAtendimento" AS ENUM ('EM_ANDAMENTO', 'AGUARDANDO_PAGAMENTO', 'PARCIALMENTE_PAGO', 'CONCLUIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StatusGuia" AS ENUM ('RASCUNHO', 'AGUARDANDO_PAGAMENTO', 'PARCIALMENTE_PAGA', 'PAGA', 'ESTORNO_PENDENTE', 'CANCELADA');

-- CreateEnum
CREATE TYPE "StatusItemGuia" AS ENUM ('ATIVO', 'CANCELADO', 'REALIZADO');

-- CreateEnum
CREATE TYPE "TipoAgendamento" AS ENUM ('HORARIO', 'ORDEM_CHEGADA');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('PIX', 'DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'TRANSFERENCIA', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusRepasse" AS ENUM ('DISPONIVEL', 'SOLICITADO', 'EM_ANALISE', 'APROVADO', 'PAGO', 'RECUSADO');

-- CreateTable
CREATE TABLE "Empresa" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "documento" TEXT,
    "percentualBeneficio" DECIMAL(5,2),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paciente" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "email" TEXT,
    "dataNascimento" TIMESTAMP(3),
    "empresaId" INTEGER,
    "beneficioAtivo" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clinica" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "documento" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "endereco" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clinica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Procedimento" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT,
    "preparo" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Procedimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecoProcedimentoClinica" (
    "id" SERIAL NOT NULL,
    "clinicaId" INTEGER NOT NULL,
    "procedimentoId" INTEGER NOT NULL,
    "valorPaciente" DECIMAL(10,2) NOT NULL,
    "valorRepasse" DECIMAL(10,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrecoProcedimentoClinica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Atendimento" (
    "id" SERIAL NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "status" "StatusAtendimento" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "etapaAtual" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Atendimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guia" (
    "id" SERIAL NOT NULL,
    "atendimentoId" INTEGER NOT NULL,
    "clinicaId" INTEGER NOT NULL,
    "status" "StatusGuia" NOT NULL DEFAULT 'RASCUNHO',
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "desconto" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "beneficio" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valorFinal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemGuia" (
    "id" SERIAL NOT NULL,
    "guiaId" INTEGER NOT NULL,
    "procedimentoId" INTEGER NOT NULL,
    "status" "StatusItemGuia" NOT NULL DEFAULT 'ATIVO',
    "valorPaciente" DECIMAL(10,2) NOT NULL,
    "valorRepasse" DECIMAL(10,2) NOT NULL,
    "tipoAgendamento" "TipoAgendamento",
    "dataAgendamento" TIMESTAMP(3),
    "horarioAgendamento" TEXT,
    "canceladoEm" TIMESTAMP(3),
    "motivoCancelamento" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemGuia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" SERIAL NOT NULL,
    "guiaId" INTEGER NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "forma" "FormaPagamento" NOT NULL,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estorno" (
    "id" SERIAL NOT NULL,
    "guiaId" INTEGER NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "forma" "FormaPagamento" NOT NULL,
    "motivo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Estorno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repasse" (
    "id" SERIAL NOT NULL,
    "clinicaId" INTEGER NOT NULL,
    "status" "StatusRepasse" NOT NULL DEFAULT 'SOLICITADO',
    "valorTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "solicitadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pagoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repasse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepasseItem" (
    "id" SERIAL NOT NULL,
    "repasseId" INTEGER NOT NULL,
    "guiaId" INTEGER NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepasseItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_documento_key" ON "Empresa"("documento");

-- CreateIndex
CREATE UNIQUE INDEX "Paciente_cpf_key" ON "Paciente"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "Clinica_documento_key" ON "Clinica"("documento");

-- CreateIndex
CREATE UNIQUE INDEX "PrecoProcedimentoClinica_clinicaId_procedimentoId_key" ON "PrecoProcedimentoClinica"("clinicaId", "procedimentoId");

-- CreateIndex
CREATE UNIQUE INDEX "RepasseItem_repasseId_guiaId_key" ON "RepasseItem"("repasseId", "guiaId");

-- AddForeignKey
ALTER TABLE "Paciente" ADD CONSTRAINT "Paciente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecoProcedimentoClinica" ADD CONSTRAINT "PrecoProcedimentoClinica_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecoProcedimentoClinica" ADD CONSTRAINT "PrecoProcedimentoClinica_procedimentoId_fkey" FOREIGN KEY ("procedimentoId") REFERENCES "Procedimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atendimento" ADD CONSTRAINT "Atendimento_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guia" ADD CONSTRAINT "Guia_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "Atendimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guia" ADD CONSTRAINT "Guia_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemGuia" ADD CONSTRAINT "ItemGuia_guiaId_fkey" FOREIGN KEY ("guiaId") REFERENCES "Guia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemGuia" ADD CONSTRAINT "ItemGuia_procedimentoId_fkey" FOREIGN KEY ("procedimentoId") REFERENCES "Procedimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_guiaId_fkey" FOREIGN KEY ("guiaId") REFERENCES "Guia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estorno" ADD CONSTRAINT "Estorno_guiaId_fkey" FOREIGN KEY ("guiaId") REFERENCES "Guia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repasse" ADD CONSTRAINT "Repasse_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepasseItem" ADD CONSTRAINT "RepasseItem_repasseId_fkey" FOREIGN KEY ("repasseId") REFERENCES "Repasse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepasseItem" ADD CONSTRAINT "RepasseItem_guiaId_fkey" FOREIGN KEY ("guiaId") REFERENCES "Guia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
