-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CITIZEN', 'OPERATOR');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('VERIFIED', 'UNVERIFIED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "CollectionFrequency" AS ENUM ('DAILY', 'TWICE_WEEKLY', 'WEEKLY');

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "wardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ward" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "geojson" JSONB NOT NULL,

    CONSTRAINT "Ward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "frequency" "CollectionFrequency" NOT NULL,
    "normalWeekdays" INTEGER[],
    "normalTime" TEXT NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CivicEvent" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "affectedDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "status" "EventStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiryDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "verifiedById" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "withdrawalReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "notifiedVersion" INTEGER NOT NULL DEFAULT 0,
    "dedupKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CivicEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlternativeArrangement" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "alternativeDate" TIMESTAMP(3) NOT NULL,
    "alternativeTime" TEXT NOT NULL,
    "affectedArea" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedById" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlternativeArrangement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "translatedMessage" TEXT,
    "translatedLanguage" TEXT,
    "emailedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "eventId" TEXT,
    "description" TEXT NOT NULL,
    "photoUrl" TEXT,
    "location" JSONB,
    "status" TEXT NOT NULL DEFAULT 'open',
    "operatorNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitEvent" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Profile_wardId_role_idx" ON "Profile"("wardId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Ward_name_key" ON "Ward"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Service_wardId_name_key" ON "Service"("wardId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CivicEvent_dedupKey_key" ON "CivicEvent"("dedupKey");

-- CreateIndex
CREATE INDEX "CivicEvent_wardId_status_affectedDate_idx" ON "CivicEvent"("wardId", "status", "affectedDate");

-- CreateIndex
CREATE INDEX "CivicEvent_status_verificationStatus_idx" ON "CivicEvent"("status", "verificationStatus");

-- CreateIndex
CREATE INDEX "CivicEvent_status_expiryDate_idx" ON "CivicEvent"("status", "expiryDate");

-- CreateIndex
CREATE INDEX "AlternativeArrangement_eventId_verificationStatus_idx" ON "AlternativeArrangement"("eventId", "verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_contentHash_key" ON "Notification"("contentHash");

-- CreateIndex
CREATE INDEX "Notification_profileId_sentAt_idx" ON "Notification"("profileId", "sentAt");

-- CreateIndex
CREATE INDEX "Notification_eventId_profileId_idx" ON "Notification"("eventId", "profileId");

-- CreateIndex
CREATE INDEX "Complaint_profileId_createdAt_idx" ON "Complaint"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "Complaint_status_createdAt_idx" ON "Complaint"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "RateLimitEvent_key_createdAt_idx" ON "RateLimitEvent"("key", "createdAt");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CivicEvent" ADD CONSTRAINT "CivicEvent_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CivicEvent" ADD CONSTRAINT "CivicEvent_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CivicEvent" ADD CONSTRAINT "CivicEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlternativeArrangement" ADD CONSTRAINT "AlternativeArrangement_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CivicEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CivicEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CivicEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
