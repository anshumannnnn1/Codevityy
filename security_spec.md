# Codevity Firestore Security Specification

## 1. Data Invariants
1. **Default Deny**: All paths are denied unless explicitly permitted by a matching collection rule.
2. **Identity Isolation (PII & Private Reports)**:
   - `/users/{userId}` contains PII (`email`, `name`) and may only be read, created, or updated by the authenticated user whose `request.auth.uid == userId`. No blanket `list` is permitted on `/users`.
   - `/githubConnections/{userId}` stores connection metadata (`githubUsername`, `connectionStatus`, opaque `tokenRef` — never raw OAuth tokens) and may only be read, created, updated, or deleted by `request.auth.uid == userId`.
   - `/analysisReports/{reportId}` contains user-scoped repository analytics and AI insights. Every read (`get`, `list`), create, and delete MUST verify `resource.data.userId == request.auth.uid` (or `request.resource.data.userId == request.auth.uid` on create).
3. **Immutable Ownership & Creation Timestamps**:
   - `userId` and `createdAt` cannot be modified after creation.
   - `createdAt` and `updatedAt` must match `request.time` (server timestamps).
4. **Strict Key & Type Enforcement**:
   - Every collection uses `isValid[Entity](incoming())` checking `keys().hasAll(...)`, `keys().hasOnly(...)`, string length bounds, numeric score bounds (`0..100`), and `isValidId(docId)`.

## 2. Dirty Dozen Attack Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read on `/users/uid_1` -> DENIED (`request.auth == null`).
2. Cross-user read on `/users/uid_2` by `uid_1` -> DENIED (`uid_1 != uid_2`).
3. List query on `/users` by `uid_1` -> DENIED (`allow list: if false`).
4. Shadow field injection on `/users/uid_1` create (`isAdmin: true`) -> DENIED (`hasOnly` rejects extra keys).
5. Client-forged timestamp on `/users/uid_1` (`createdAt: "2020-01-01"`) -> DENIED (`createdAt == request.time`).
6. Cross-user ownership spoofing on `/analysisReports/rep_1` create (`userId: "uid_2"` while signed in as `uid_1`) -> DENIED (`incoming().userId == request.auth.uid`).
7. Blanket list query on `/analysisReports` without `where("userId", "==", uid)` -> DENIED (`allow list: if isSignedIn() && existing().userId == request.auth.uid`).
8. Invalid score value on `/analysisReports/rep_1` (`productivityScore: 999`) -> DENIED (`productivityScore >= 0 && productivityScore <= 100`).
9. Oversized document ID on `/analysisReports/<200-char-id>` -> DENIED (`isValidId(reportId)`).
10. Cross-user delete on `/analysisReports/rep_2` owned by `uid_2` -> DENIED (`existing().userId == request.auth.uid`).
11. Cross-user write on `/githubConnections/uid_2` by `uid_1` -> DENIED (`request.auth.uid == userId`).
12. Ghost raw token field injection on `/githubConnections/uid_1` (`accessToken: "gho_secret"`) -> DENIED (`hasOnly` rejects `accessToken`).
