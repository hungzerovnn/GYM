# Attendance Machine Face/Card SDK Design

Updated: 2026-04-07 19:05 Asia/Bangkok

## 1. Current audit conclusion from the existing codebase

Current source reviewed:

- `apps/api/src/modules/system/system.dto.ts`
- `apps/api/src/modules/system/system.service.ts`
- `apps/api/src/modules/system/system.controller.ts`
- `prisma/schema.prisma`
- `apps/web/components/portal/resource-detail-drawer.tsx`
- `apps/web/lib/module-config.ts`

### 1.1 What the system currently does

The current `attendance-machines` module is a management surface for:

- storing machine master data
- storing machine connection metadata
- preparing staff/customer attendance codes for export/sync
- showing recent attendance events already stored in the local database
- toggling sync/status flags
- returning operator-friendly sync payload previews

The system currently supports attendance event methods:

- `FINGERPRINT`
- `FACE`
- `CARD`
- `MOBILE`
- `MANUAL`

The system currently stores attendance events with:

- machine id
- branch id
- user id
- event time
- event type
- verification method
- source
- `rawCode`
- note

### 1.2 Exact conclusion about device protocol

At the moment, the system does **not** implement a real attendance-device communication protocol.

There is currently **no confirmed hardware SDK/protocol integration** for:

- TCP socket device sync
- vendor REST API sync
- SOAP/ISAPI sync
- ADMS push callback
- vendor desktop bridge
- real-time webhook event ingest from a hardware provider

The current maintenance actions in `system.service.ts` are internal logical operations only:

- `PULL_ATTENDANCE_EVENTS`
  - returns recent `StaffAttendanceEvent` rows already saved in this app database
- `PULL_MACHINE_CODES`
  - exports staff/member code lists from local branch data
- `PUSH_STAFF_CODES`
  - prepares staff rows for sync, but does not actually push through a device SDK
- `PUSH_CUSTOMER_CODES`
  - prepares member rows for sync, but does not actually push through a device SDK
- `SYNC_MACHINE_TIME`
  - returns a logical success payload, but does not currently call a real device time-sync API

### 1.3 Important gap summary

The current code does **not** yet support:

- machine vendor identification
- machine protocol identification
- machine type differentiation beyond event method labels
- first-time face enrollment
- downloading face images from the machine
- downloading face templates from the machine
- uploading face templates to the machine
- card enrollment lifecycle
- fingerprint template lifecycle
- device-side user provisioning with external ids
- webhook/push ingest from face devices
- durable biometric media storage

## 2. Why this matters

For fingerprint-only check-in, the current model can still work if:

- the device already has users enrolled
- the device exports or syncs logs containing a stable code
- that code matches the employee/member attendance code in the app

For face/card devices, a production-grade integration usually needs much more than log recording:

- first-time enrollment
- machine-side user identity mapping
- image/template transfer when supported
- deduped event ingestion
- device capability tracking per vendor/model

Without those layers, the system can only act as a receiving/reporting surface, not a full biometric-management platform.

## 3. Target architecture for full face/card support

### 3.1 Design principle

Do not hardcode one vendor into the core business module.

Instead, introduce a connector/adapter architecture:

- one common domain model inside the app
- one adapter per vendor/protocol
- one orchestration layer for provisioning, sync, and event ingest

### 3.2 Recommended high-level layers

#### A. Core domain layer

This remains vendor-neutral and stores:

- machines
- people mapped to machines
- enrollment state
- attendance events
- sync jobs
- binary/media references

#### B. Connector layer

Each connector implements a shared interface, for example:

- `ping`
- `getCapabilities`
- `pullLogs`
- `pullUsers`
- `pushUsers`
- `syncTime`
- `createCardEnrollment`
- `createFaceEnrollment`
- `uploadFaceImage`
- `uploadFaceTemplate`
- `downloadFaceTemplate`
- `downloadEnrollmentPhoto`
- `disableUser`
- `deleteUser`

#### C. Ingest layer

Receives device-originated data via one of these paths:

- scheduled pull
- on-demand pull
- vendor push callback
- local bridge/agent upload
- offline CSV/JSON import

#### D. Media storage layer

Biometric-related files should not be stored in the database as raw blobs by default.

Use durable object storage:

- `Cloudflare R2`
- or `MinIO`

Store in DB only:

- metadata
- file key
- hash
- mime type
- source
- enrollment linkage

## 4. Required schema expansion

### 4.1 Expand `AttendanceMachine`

Current machine fields are too small for a real connector.

Recommended new fields:

- `vendor`
  - example: `ZKTECO`, `RONALD_JACK`, `HIKVISION`, `SUPREMA`, `ANVIZ`, `GENERIC_IMPORT`
- `model`
- `machineType`
  - `FINGERPRINT`, `FACE`, `CARD`, `HYBRID`
- `protocol`
  - `ZK_PULL_TCP`, `ZK_ADMS_PUSH`, `HIKVISION_ISAPI`, `SUPREMA_BIOSTAR`, `GENERIC_HTTP`, `CSV_IMPORT`
- `deviceIdentifier`
  - serial number or vendor machine id
- `commKey`
  - if vendor uses communication key
- `username`
  - for devices with authenticated APIs
- `password`
  - already exists, but should become part of a secure secret flow
- `apiKey`
- `timeZone`
- `pollingIntervalSeconds`
- `supportsFaceImage`
- `supportsFaceTemplate`
- `supportsCardEnrollment`
- `supportsFingerprintTemplate`
- `supportsWebhook`
- `lastHeartbeatAt`
- `lastErrorCode`
- `lastErrorMessage`
- `lastLogCursor`
- `lastUserSyncCursor`

### 4.2 Add `AttendanceMachinePersonMap`

This is the critical missing table.

Purpose:

- link one app person to one or many machine identities
- support employee and customer separately
- keep machine-side identifiers stable

Recommended fields:

- `id`
- `branchId`
- `attendanceMachineId`
- `personType`
  - `STAFF`, `CUSTOMER`
- `personId`
- `appAttendanceCode`
- `machineUserId`
- `machineCode`
- `cardCode`
- `faceProfileId`
- `fingerprintProfileId`
- `syncStatus`
  - `PENDING`, `SYNCED`, `ERROR`, `DISABLED`
- `lastSyncedAt`
- `lastError`

### 4.3 Add `AttendanceEnrollment`

Purpose:

- represent first-time biometric/card registration lifecycle

Recommended fields:

- `id`
- `attendanceMachineId`
- `personType`
- `personId`
- `enrollmentType`
  - `FACE`, `CARD`, `FINGERPRINT`
- `status`
  - `PENDING_CAPTURE`, `CAPTURED`, `UPLOADED_TO_MACHINE`, `DOWNLOADED_FROM_MACHINE`, `CONFIRMED`, `FAILED`
- `capturedAt`
- `confirmedAt`
- `machineUserId`
- `qualityScore`
- `templateVersion`
- `note`
- `metadataJson`

### 4.4 Add `AttendanceBiometricAsset`

Purpose:

- track file/template/image artifacts

Recommended fields:

- `id`
- `enrollmentId`
- `attendanceMachineId`
- `personType`
- `personId`
- `assetType`
  - `FACE_IMAGE`, `FACE_TEMPLATE`, `FINGERPRINT_TEMPLATE`, `CARD_METADATA`
- `storageProvider`
  - `R2`, `MINIO`, `LOCAL`, `REMOTE_DEVICE`
- `storageKey`
- `originalFilename`
- `mimeType`
- `fileSize`
- `sha256`
- `capturedFrom`
  - `DEVICE`, `UPLOAD`, `IMPORT`, `SDK_EXPORT`
- `createdAt`

### 4.5 Extend `StaffAttendanceEvent`

Recommended additional fields:

- `externalEventId`
- `machineUserId`
- `deviceLogCursor`
- `verificationScore`
- `capturedImageAssetId`
- `payloadJson`
- `ingestSource`
- `dedupeHash`

This will allow:

- true dedupe
- richer audit
- image/event linkage when device supports face snapshots

## 5. Recommended API surface

### 5.1 Machine management

- `GET /attendance-machines/:id/capabilities`
- `POST /attendance-machines/:id/test-connection`
- `POST /attendance-machines/:id/sync-time`
- `POST /attendance-machines/:id/pull-logs`
- `POST /attendance-machines/:id/pull-users`
- `POST /attendance-machines/:id/push-users`

### 5.2 Mapping / provisioning

- `GET /attendance-machines/:id/mappings`
- `POST /attendance-machines/:id/mappings/staff`
- `POST /attendance-machines/:id/mappings/customers`
- `POST /attendance-machines/:id/mappings/auto-match`
- `POST /attendance-machines/:id/users/push`
- `POST /attendance-machines/:id/users/deactivate`

### 5.3 Face enrollment

- `POST /attendance-machines/:id/enrollments/face`
  - create enrollment job
- `POST /attendance-machines/:id/enrollments/face/:enrollmentId/upload-image`
  - upload face image from browser/admin
- `POST /attendance-machines/:id/enrollments/face/:enrollmentId/push-to-device`
  - send image/template to device connector
- `POST /attendance-machines/:id/enrollments/face/:enrollmentId/pull-from-device`
  - download template/image if the device exposes it
- `POST /attendance-machines/:id/enrollments/face/:enrollmentId/confirm`

### 5.4 Card enrollment

- `POST /attendance-machines/:id/enrollments/card`
- `POST /attendance-machines/:id/enrollments/card/:enrollmentId/assign`
- `POST /attendance-machines/:id/enrollments/card/:enrollmentId/confirm`

### 5.5 Device push callbacks

- `POST /attendance-device-hooks/:machineId/events`
- `POST /attendance-device-hooks/:machineId/enrollments`

Webhook endpoints should be protected by:

- per-machine webhook secret
- signature validation
- IP allowlist when vendor supports it

## 6. Exact lifecycle design

### 6.1 Face machine - first-time enrollment

Recommended business flow:

1. Create machine with:
   - vendor
   - model
   - machineType = `FACE` or `HYBRID`
   - protocol
   - host/port/secret credentials
2. Test connection and load capabilities.
3. Create or confirm person mapping:
   - app person
   - machine user id
   - attendance code
4. Start face enrollment:
   - either upload face image from admin UI
   - or request pull from device if device captures locally first
5. Store image/template metadata in `AttendanceEnrollment` + `AttendanceBiometricAsset`.
6. Push face data to machine if connector supports remote provisioning.
7. Confirm machine returns enrolled state.
8. Mark mapping/enrollment as `SYNCED` / `CONFIRMED`.

### 6.2 Face machine - later attendance

After first-time enrollment is complete:

1. Device captures a face event.
2. Device emits event via push or is polled by pull.
3. Connector normalizes:
   - event time
   - machine user id
   - verification type = `FACE`
   - confidence if available
   - raw payload
4. System resolves mapping to person.
5. System saves attendance event.
6. Optional:
   - store linked event image if supported and allowed

Important:

After enrollment is stable, later runs usually only need event confirmation/log pull, not full image/template transfer every time.

### 6.3 Card machine - first-time assignment

1. Create machine with `machineType = CARD` or `HYBRID`.
2. Create mapping for user/customer.
3. Assign card code to person.
4. Push card identity to machine if vendor supports it.
5. Confirm card assignment state.

### 6.4 Card machine - later attendance

1. Device logs card swipe.
2. Connector receives event.
3. Event contains:
   - machine card code
   - machine user id if available
   - timestamp
4. System resolves mapping and saves attendance event with:
   - `verificationMethod = CARD`
   - `rawCode = cardCode`

## 7. What “full SDK integration” should mean in this project

For this app, a real full integration should include all of the following:

### 7.1 Device communication

- actual vendor connector implementation
- no fake success payloads
- real connection test
- real time sync
- real user provisioning
- real log pull / push webhook ingest

### 7.2 Enrollment lifecycle

- first-time face enrollment
- first-time card assignment
- optional fingerprint template support
- clear status tracking per person per machine

### 7.3 Mapping lifecycle

- one UI to map app people to machine identities
- detect duplicates
- detect missing attendance codes
- resolve branch mismatch

### 7.4 Asset management

- face images/templates stored durably
- object storage references
- audit trail
- retention rules

### 7.5 Event integrity

- idempotent ingest
- dedupe by external id/hash
- conflict handling
- retry queue

## 8. Recommended vendor strategy

Because the current codebase has no vendor lock yet, do not start by hardcoding one giant connector in `system.service.ts`.

Recommended plugin-style structure:

- `apps/api/src/modules/attendance-devices/`
  - `attendance-device.types.ts`
  - `attendance-device.registry.ts`
  - `attendance-device.service.ts`
  - `connectors/`
    - `zkteco-adms.connector.ts`
    - `hikvision-isapi.connector.ts`
    - `generic-import.connector.ts`
  - `dto/`
  - `mappers/`
  - `storage/`

This keeps `system.service.ts` from becoming a vendor-specific monolith.

## 9. Recommended rollout phases

### Phase 1 - make current module honest and extensible

- add machine `vendor`, `machineType`, `protocol`
- rename current maintenance actions in UI copy if needed
- make it explicit which actions are:
  - local export only
  - real device sync

### Phase 2 - mapping foundation

- add `AttendanceMachinePersonMap`
- add mapping screen for staff/customers
- add auto-match by attendance code/card code

### Phase 3 - real connector foundation

- implement connector interface
- add one real vendor connector first
- start with:
  - test connection
  - sync time
  - pull logs
  - push users

### Phase 4 - face/card enrollment

- add `AttendanceEnrollment`
- add `AttendanceBiometricAsset`
- add upload/pull/push/confirm workflows

### Phase 5 - production hardening

- retries
- idempotency
- event queue
- storage lifecycle
- monitoring and alerts

## 10. Immediate practical conclusion for the current system

If a stakeholder asks “does the current system already fully support face/card devices via SDK?”, the correct answer is:

**No.**

The current system:

- can record attendance events and mark them as `FACE` / `CARD` / `FINGERPRINT`
- can prepare/export attendance codes for staff and customers
- can show recent machine-linked attendance rows

But it does **not yet**:

- talk to device hardware through a confirmed vendor protocol
- enroll face data the first time
- download or store face images/templates
- manage card assignment lifecycle end-to-end

## 11. Recommended next implementation step

The safest next engineering step is:

1. add protocol-aware machine metadata
2. add person-to-machine mapping table
3. build one vendor connector first
4. only then add face/card enrollment flows

Trying to build face/template workflows before the connector/mapping foundation will create rework.
