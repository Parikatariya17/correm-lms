# FinCore LMS — Full-Stack Loan Management System

A full-stack **Loan Management System (LMS)** built for the **Correm Advisory India Pvt. Ltd.** Full Stack Developer Intern Take-Home Assignment. The system models a real-world multi-stage credit underwriting workflow with Role-Based Access Control (RBAC), deterministic eligibility scoring, document storage, audit trails, and automated reducing-balance EMI amortization schedules.

---

## 1. Tech Stack & Database Justification

### Tech Stack
* **Frontend:** React 19 (Vite), Tailwind CSS, React Router v7, Axios (with JWT auto-refresh interceptors), Lucide Icons, React Hot Toast.
* **Backend:** Node.js, Express.js (RESTful `/api/v1` architecture), Zod (request validation), Multer (memory storage).
* **Database & ODM:** MongoDB Atlas + Mongoose.
* **Authentication & Security:** JWT Access + Refresh Token rotation (`bcryptjs` password hashing, role-based middleware guards).
* **File Storage:** Cloudinary (streaming PDF/image uploads via Node `Readable` streams).

### Why MongoDB over PostgreSQL?
1. **Embedded Document & Audit Trail Arrays:** Each `LoanApplication` maintains a growing `auditLogs` array (capturing every state transition, actor role, timestamp, and remarks) alongside a dynamic `documents` array (KYC/income proofs that can be re-uploaded on `MORE_INFO_NEEDED`). Embedding these directly inside the loan document avoids expensive multi-table `JOIN`s on every dashboard read.
2. **Polymorphic / Evolving Application Drafts:** Applicants save incomplete applications (`DRAFT`) across 4 steps before strict submission validation runs. MongoDB's flexible document model handles partial nested objects (`personalDetails`, `loanDetails`, `incomeDetails`) cleanly without nullable column bloat.
3. **Self-Contained Repayment Schedules:** Storing the full month-by-month `installments` array inside `RepaymentSchedule` allows fetching an entire 12–360 month amortization table in a single indexed lookup (`applicationId`).

---

## 2. Schema / ER Explanation

```text
+----------------------+          1 : N          +----------------------------+
|         User         |------------------------>|      LoanApplication       |
+----------------------+                         +----------------------------+
| _id (ObjectId)       |                         | _id (ObjectId)             |
| name                 |                         | applicantId (Ref -> User)  |
| email (Unique Index) |                         | status (State Machine)     |
| password (Hashed)    |                         | personalDetails { ... }    |
| role (applicant |    |                         | loanDetails { ... }        |
|   officer | admin)   |                         | incomeDetails { ... }      |
| isActive             |                         | documents [ { url, ... } ] |
| refreshToken         |                         | eligibilityReport { ... }  |
+----------------------+                         | auditLogs [ { ... } ]      |
                                                 +----------------------------+
                                                                |
                                                                | 1 : 1 (On APPROVED)
                                                                v
                                                 +----------------------------+
                                                 |     RepaymentSchedule      |
                                                 +----------------------------+
| _id (ObjectId)             |
| applicationId (Unique Ref) |
| applicantId (Ref -> User)  |
| installments [             |
|   installmentNo, dueDate,  |
|   emi, principal,          |
|   interest, balance,       |
|   status (PENDING | PAID)  |
| ]                          |
+----------------------------+
```

### Workflow State Machine
```text
DRAFT ──> SUBMITTED ──> UNDER_REVIEW ──> RECOMMENDED_APPROVE ──> APPROVED (Generates EMI Schedule)
               ^              │      └──> RECOMMENDED_REJECT  ──> REJECTED
               │              v
               └─── MORE_INFO_NEEDED (Applicant updates details / re-uploads docs)
```

---

## 3. Eligibility-Check & EMI Calculation Rules

### A. Reducing-Balance EMI Formula (`loanMathService.js`)
Monthly EMI is computed deterministically using:
$$E = \frac{P \cdot r \cdot (1 + r)^n}{(1 + r)^n - 1}$$
Where:
* $P$ = Principal loan amount
* $r$ = Monthly interest rate (`Annual Rate / 12 / 100`)
* $n$ = Tenure in months

**Fixed Annual Interest Rates by Loan Type:**
| Loan Type | Annual Interest Rate |
| :--- | :--- |
| **Home** | `8.5%` |
| **Vehicle** | `10.5%` |
| **Personal** | `13.5%` |
| **Business** | `15.0%` |

*(Note: On the final installment, any floating-point rounding variance is adjusted so the closing principal balance reaches exactly `₹0.00`.)*

### B. Deterministic Eligibility Rules (`eligibilityService.js`)
When an application is submitted (or when a Loan Officer triggers a re-check), `evaluateEligibility(application)` evaluates three weighted rules totaling **100 points**:

1. **Minimum Applicant Age (`30 points`):**
   * Calculates exact age from `personalDetails.dob`.
   * **Rule:** `age >= 21 years`.
2. **Income-to-EMI Affordability Ratio (`45 points`):**
   * Computes monthly EMI from requested amount, tenure, and loan-type interest rate.
   * **Rule:** `monthlyIncome >= 3 × calculatedEMI` (maximum ~33.3% FOIR).
3. **Mandatory KYC & Income Documentation (`25 points`):**
   * Inspects uploaded `documents` array.
   * **Rule:** At least one **ID Proof** (`PAN_CARD`, `AADHAAR`, `PASSPORT`, `VOTER_ID`, `ID_PROOF`) **AND** at least one **Income Proof** (`SALARY_SLIP`, `BANK_STATEMENT`, `ITR`, `INCOME_PROOF`) must be attached.

`isEligible` evaluates to `true` only when **all three checks pass**.

---

## 4. Local Setup Instructions

### Prerequisites
* Node.js `v20+`
* MongoDB Atlas connection URI
* Cloudinary account (free tier)

### Step 1: Clone Repository
```bash
git clone <your-repo-url>
cd Correm-LMS
```

### Step 2: Backend Setup (`/server`)
```bash
cd server
npm install
```

Create a `.env` file inside `/server` with the following variables:
```env
PORT=5001
NODE_ENV=development
MONGO_URI=your_mongodb_atlas_connection_string
CLIENT_URL=http://localhost:5173

JWT_ACCESS_SECRET=your_access_secret_key
JWT_REFRESH_SECRET=your_refresh_secret_key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

Seed demo users and start the backend server:
```bash
node seed.js
npm run dev
```
*(Backend runs on `http://localhost:5001` — port `5001` is used to avoid conflicts with macOS AirPlay Receiver on port `5000`.)*

### Step 3: Frontend Setup (`/client`)
Open a second terminal:
```bash
cd client
npm install
```

*(Optional)* Create `client/.env` if pointing to a custom backend URL:
```env
VITE_API_URL=http://localhost:5001/api/v1
```

Start the Vite dev server:
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### Demo Credentials (Seeded via `node seed.js`)
| Role | Email | Password |
| :--- | :--- | :--- |
| **Applicant** | `applicant@lms.in` | `Password@123` |
| **Loan Officer** | `officer@lms.in` | `Password@123` |
| **Admin** | `admin@lms.in` | `Password@123` |

---

## 5. Known Limitations & Future Improvements

1. **Automated Test Suite:** Unit tests for `eligibilityService.js` and `loanMathService.js` (using Vitest/Jest) and API integration tests (Supertest) would prevent regressions on edge-case tenures and rounding.
2. **Email / Webhook Notifications:** Integrating Nodemailer or Resend to notify applicants automatically when an officer requests `MORE_INFO_NEEDED` or when a loan is `APPROVED`.
3. **Security Hardening:** Adding `express-rate-limit` on `/api/v1/auth/*` endpoints, Helmet security headers, and storing refresh tokens in `HttpOnly; Secure; SameSite=Strict` cookies instead of localStorage.
4. **PDF Sanction Letter & Statement Export:** Allowing applicants to download a formatted PDF sanction letter and CSV/PDF repayment schedule once approved.
5. **Credit Bureau & OCR Integration:** Replacing deterministic rules with live CIBIL/Experian bureau pulls and automated PAN/salary-slip OCR verification.
