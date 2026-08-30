-- RenameColumn (SQLite native RENAME COLUMN — preserves existing data,
-- unlike Prisma's default drop-and-recreate diff for this kind of change)
ALTER TABLE "Atestado" RENAME COLUMN "photoUri" TO "photoDataUrl";
