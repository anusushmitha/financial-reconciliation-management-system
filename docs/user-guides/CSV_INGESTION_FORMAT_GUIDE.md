# LENDGUARD AI — CSV Ingestion Format & Data Specification Guide

**Document Reference:** `docs/user-guides/CSV_INGESTION_FORMAT_GUIDE.md`  
**Target Audience:** Financial Analysts, Data Engineers, Banking Integration Teams  

---

## 1. Overview & File Specifications

LENDGUARD AI ingests two categories of CSV files:
1. **Internal Lending System Records (`INTERNAL`):** Loan disbursements, scheduled repayments, and borrower fee records generated from internal lending ledgers.
2. **External Counterparty Settlements (`EXTERNAL`):** Bank account statements, payment gateway settlement advices, and card network clearing files.

### 1.1 Technical File Constraints
- **File Format:** Comma-Separated Values (`.csv`).
- **Encoding:** UTF-8 or ASCII (without BOM preferred).
- **Line Endings:** Standard Unix (`\n`) or Windows (`\r\n`).
- **Maximum File Size:** 25 Megabytes (MB).
- **Maximum Row Count:** 50,000 rows per individual file.

---

## 2. Column Schema Definitions

| Column Name | Required? | Data Type | Permitted Format / Example | Description |
| :--- | :---: | :--- | :--- | :--- |
| `transaction_reference` | **Yes** | String (Max 150) | `TXN-20261115-00101` | Unique business identifier for the transaction record. |
| `external_reference` | No | String (Max 150) | `UTR98234710239` | Counterparty reference, UTR, or counterparty settlement ID. |
| `transaction_date` | **Yes** | ISO 8601 UTC | `2026-11-15T10:30:00Z` | Date and time the transaction occurred in UTC. |
| `amount` | **Yes** | Decimal (18,2) | `15000.00` | Monetary amount. Strictly positive decimal. Do not include currency symbols ($/₹) or commas. |
| `currency` | **Yes** | ISO 4217 Alpha-3 | `INR`, `USD`, `EUR` | 3-letter currency code matching ISO 4217. |
| `transaction_type` | No | String (Max 50) | `REPAYMENT`, `DISBURSEMENT` | Business category of the transaction. |

---

## 3. Reference Matching Behavior

The deterministic reconciliation engine indexes transactions on both `transaction_reference` and `external_reference`:
- In **Internal files**, `transaction_reference` typically holds the loan repayment ID (e.g. `TXN-10001`).
- In **External bank files**, the bank may record its own internal transaction ID as `transaction_reference` (e.g. `BANK-SETTLE-881`) and populate `external_reference` with the loan repayment ID (`TXN-10001`).
- The engine identifies candidates when either field cross-matches the counterparty key within the same currency.

---

## 4. Common Validation Errors & Remediation

| Error Code | Error Message | Root Cause & Remediation |
| :--- | :--- | :--- |
| `REQUIRED_FIELD_MISSING` | Transaction reference is required. | Row is missing `transaction_reference`. Ensure every row has a non-empty identifier. |
| `INVALID_DECIMAL` | Amount must be a valid decimal number. | Amount contains non-numeric characters (e.g. `$1,500.00`). Strip currency symbols and commas. |
| `INVALID_DATE_FORMAT` | Transaction date must be a valid ISO 8601 UTC timestamp. | Date is in localized format (e.g. `15/11/2026`). Convert to `YYYY-MM-DDTHH:mm:ssZ`. |
| `INVALID_CURRENCY` | Currency must be an ISO 3-character code. | Currency code is invalid (e.g. `RUPEES`). Use standard 3-letter code `INR`. |
| `DUPLICATE_IN_FILE` | Duplicate transaction reference found in same file. | Multiple rows in the same file share the same `transaction_reference`. |
| `FIELD_TOO_LONG` | Transaction reference exceeds maximum length. | Reference exceeds 150 characters. Truncate or use a canonical key. |
| `MAX_ROW_LIMIT_EXCEEDED`| File exceeds maximum allowable limit of 50,000 rows. | File too large for a single batch. Split the dataset into multiple daily files. |
