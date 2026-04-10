-- AddGoogleDriveFieldsToUserDocument
ALTER TABLE "user_documents" ALTER COLUMN "fileUrl" DROP NOT NULL;
ALTER TABLE "user_documents" ADD COLUMN    "driveFileId" TEXT;
ALTER TABLE "user_documents" ADD COLUMN    "driveFolderId" TEXT;
ALTER TABLE "user_documents" ADD COLUMN    "uploadFailed" BOOLEAN NOT NULL DEFAULT false;
