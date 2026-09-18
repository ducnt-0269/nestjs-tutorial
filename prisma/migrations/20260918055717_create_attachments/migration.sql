-- CreateEnum
CREATE TYPE "attachment_owner" AS ENUM ('User');

-- CreateEnum
CREATE TYPE "attachment_visibility" AS ENUM ('public', 'private');

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "owner_type" "attachment_owner" NOT NULL,
    "owner_id" INTEGER NOT NULL,
    "visibility" "attachment_visibility" NOT NULL,
    "object_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attachments_owner_type_owner_id_idx" ON "attachments"("owner_type", "owner_id");
