# LENDGUARD AI — File Upload & Storage Security Specification

**Document Reference:** `docs/security/FILE_UPLOAD_AND_STORAGE_SECURITY.md`  
**Security Standard:** OWASP File Upload Cheat Sheet, CWE-434, CWE-1236 (CSV Injection)  
**Implementation Source:** [FileStorageService.cs](file:///C:/Users/LENOVO/.gemini/antigravity/scratch/lendguard-ai/backend/LendGuard.Infrastructure/Services/FileStorageService.cs), [ImportService.cs](file:///C:/Users/LENOVO/.gemini/antigravity/scratch/lendguard-ai/backend/LendGuard.Application/Services/ImportService.cs)

---

## 1. Executive Summary

Financial transaction ingestion accepts external data files from partner banks, payment gateways, and core banking ledgers. Unrestricted file uploads present critical security risks including remote code execution (RCE), path traversal, denial-of-service (DoS) via resource exhaustion, and client-side CSV formula injection.

LENDGUARD AI implements multi-tiered upload validation across the transport, file storage, and CSV parsing boundaries.

---

## 2. Multi-Tier Security Controls

### 2.1 Strict File Type & Extension Validation
- **Allowed Extensions:** Strictly `.csv` (case-insensitive check).
- **MIME Type Inspection:** Validated against allowed content types: `text/csv`, `text/plain`, `application/vnd.ms-excel`.
- **Content Verification:** Stream header verification ensures the file starts with valid ASCII/UTF-8 delimited text headers, rejecting disguised binary executables (ELF, PE, Mach-O).

### 2.2 Streaming File Size Limit & Quotas
- **Upload Limit:** Maximum **25 Megabytes (MB)** per file upload.
- **Streaming Byte Counter:** In `FileStorageService.SaveUploadAsync`, bytes are monitored during stream write. If total written bytes exceed 25MB ($26,214,400$ bytes), writing terminates immediately, the temporary file is deleted, and `FileTooLargeException` is thrown.
- **Row Limit:** Maximum **50,000 rows** per CSV file. Excess rows trigger `MAX_ROW_LIMIT_EXCEEDED` error and abort ingestion before memory exhaustion occurs.

### 2.3 Filename Sanitization & Path Traversal Immunity
- **Path Stripping:** `Path.GetFileName(fileName)` strips directory prefixes.
- **Character Sanitization:** Strict alphanumeric, hyphen, underscore, and dot filtering:
  ```csharp
  var sanitized = Regex.Replace(fileName, @"[^a-zA-Z0-9_\.-]", "_");
  ```
- **Path Traversal Shield:** Any path resolving outside the designated root storage directory (`storage/`) throws `UnauthorizedAccessException("Access outside storage boundary is forbidden.")`.
- **Cryptographic Storage Naming:** Files are saved under an isolated GUID-tagged structure:
  `storage/uploads/{yyyyMMdd}_{Guid:N}_{sanitizedFileName}`.

### 2.4 CSV Formula Injection (DDE) Mitigation
When exporting reports or reviewing raw CSV fields, malicious strings starting with formula execution characters could execute arbitrary commands in desktop spreadsheet tools (Excel, Calc):
- **Dangerous Prefixes:** `=`, `+`, `-`, `@`, `\t`, `\r`.
- **Sanitization Rule:** Cells beginning with dangerous characters are prefixed with a single quote `'` or enclosed in sanitized string literals during export, rendering formulas harmless as inert plain text.

### 2.5 Storage Abstraction & Webroot Isolation
- The file storage directory (`storage/`) is located completely outside the ASP.NET Core `wwwroot` directory and React frontend static directory.
- No direct HTTP URL mapping exists to uploaded files.
- Files can only be accessed through authenticated API streams enforcing role checks and audit logging.
