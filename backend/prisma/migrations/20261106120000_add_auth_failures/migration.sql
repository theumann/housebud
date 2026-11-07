-- CreateTable
CREATE TABLE "AuthFailure" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "account" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthFailure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthFailure_kind_ip_createdAt_idx" ON "AuthFailure"("kind", "ip", "createdAt");

-- CreateIndex
CREATE INDEX "AuthFailure_kind_account_createdAt_idx" ON "AuthFailure"("kind", "account", "createdAt");

-- CreateIndex
CREATE INDEX "AuthFailure_createdAt_idx" ON "AuthFailure"("createdAt");
