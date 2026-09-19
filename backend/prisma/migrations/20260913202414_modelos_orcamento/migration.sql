-- CreateTable
CREATE TABLE "ModeloOrcamento" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "organizacaoId" INTEGER NOT NULL,
    "criadoPorId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModeloOrcamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemModeloOrcamento" (
    "id" SERIAL NOT NULL,
    "modeloId" INTEGER NOT NULL,
    "procedimentoId" INTEGER NOT NULL,
    "clinicaId" INTEGER,
    "unidadeClinicaId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemModeloOrcamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModeloOrcamento_organizacaoId_idx" ON "ModeloOrcamento"("organizacaoId");

-- CreateIndex
CREATE INDEX "ModeloOrcamento_ativo_idx" ON "ModeloOrcamento"("ativo");

-- CreateIndex
CREATE INDEX "ModeloOrcamento_nome_idx" ON "ModeloOrcamento"("nome");

-- CreateIndex
CREATE INDEX "ItemModeloOrcamento_procedimentoId_idx" ON "ItemModeloOrcamento"("procedimentoId");

-- CreateIndex
CREATE INDEX "ItemModeloOrcamento_clinicaId_idx" ON "ItemModeloOrcamento"("clinicaId");

-- CreateIndex
CREATE INDEX "ItemModeloOrcamento_unidadeClinicaId_idx" ON "ItemModeloOrcamento"("unidadeClinicaId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemModeloOrcamento_modeloId_procedimentoId_key" ON "ItemModeloOrcamento"("modeloId", "procedimentoId");

-- AddForeignKey
ALTER TABLE "ModeloOrcamento" ADD CONSTRAINT "ModeloOrcamento_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeloOrcamento" ADD CONSTRAINT "ModeloOrcamento_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemModeloOrcamento" ADD CONSTRAINT "ItemModeloOrcamento_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "ModeloOrcamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemModeloOrcamento" ADD CONSTRAINT "ItemModeloOrcamento_procedimentoId_fkey" FOREIGN KEY ("procedimentoId") REFERENCES "Procedimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemModeloOrcamento" ADD CONSTRAINT "ItemModeloOrcamento_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemModeloOrcamento" ADD CONSTRAINT "ItemModeloOrcamento_unidadeClinicaId_fkey" FOREIGN KEY ("unidadeClinicaId") REFERENCES "UnidadeClinica"("id") ON DELETE SET NULL ON UPDATE CASCADE;
