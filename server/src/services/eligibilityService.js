import {
  calculateMonthlyEMI,
  getInterestRateForLoanType,
} from './loanMathService.js';

const ID_PROOF_TYPES = ['PAN_CARD', 'AADHAAR', 'PASSPORT', 'VOTER_ID', 'ID_PROOF'];
const INCOME_PROOF_TYPES = ['SALARY_SLIP', 'BANK_STATEMENT', 'ITR', 'INCOME_PROOF'];

const calculateAge = (dob) => {
  if (!dob) return 0;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
};

/**
 * Deterministic loan eligibility evaluation.
 * Checks:
 *  (a) Applicant age >= 21 from DOB
 *  (b) Monthly income >= 3x calculated EMI
 *  (c) Minimum required documents (ID proof & Income proof) uploaded
 */
export const evaluateEligibility = (application) => {
  const { personalDetails, loanDetails, incomeDetails, documents = [] } = application;

  const annualRate =
    loanDetails?.interestRate || getInterestRateForLoanType(loanDetails?.loanType);
  const calculatedEmi = calculateMonthlyEMI(
    loanDetails?.amount || 0,
    annualRate,
    loanDetails?.tenureMonths || 0
  );

  // Check (a): Age >= 21
  const age = calculateAge(personalDetails?.dob);
  const agePassed = age >= 21;

  // Check (b): Monthly income >= 3x EMI
  const monthlyIncome = Number(incomeDetails?.monthlyIncome || 0);
  const requiredIncome = Math.round(calculatedEmi * 3);
  const incomePassed = calculatedEmi > 0 && monthlyIncome >= requiredIncome;

  // Check (c): ID Proof & Income Proof uploaded
  const uploadedDocTypes = documents.map((d) => (d.docType || '').toUpperCase());
  const hasIdProof = uploadedDocTypes.some((type) =>
    ID_PROOF_TYPES.includes(type)
  );
  const hasIncomeProof = uploadedDocTypes.some((type) =>
    INCOME_PROOF_TYPES.includes(type)
  );
  const docsPassed = hasIdProof && hasIncomeProof;

  const checks = [
    {
      code: 'MIN_AGE',
      label: 'Minimum Applicant Age (21+ years)',
      passed: agePassed,
      weight: 30,
      actualValue: `${age} years`,
      requiredValue: '>= 21 years',
      message: agePassed
        ? `Applicant age (${age} yrs) meets minimum requirement.`
        : `Applicant age (${age} yrs) is below the minimum 21 years.`,
    },
    {
      code: 'INCOME_TO_EMI',
      label: 'Income Affordability (Monthly Income >= 3x EMI)',
      passed: incomePassed,
      weight: 45,
      actualValue: `₹${monthlyIncome.toLocaleString('en-IN')} (EMI: ₹${calculatedEmi.toLocaleString('en-IN')})`,
      requiredValue: `>= ₹${requiredIncome.toLocaleString('en-IN')}`,
      message: incomePassed
        ? 'Monthly income comfortably covers 3x monthly EMI.'
        : `Monthly income must be at least 3x EMI (₹${requiredIncome.toLocaleString('en-IN')}).`,
    },
    {
      code: 'MANDATORY_DOCS',
      label: 'KYC & Income Documentation',
      passed: docsPassed,
      weight: 25,
      actualValue: `ID Proof: ${hasIdProof ? 'Yes' : 'Missing'}, Income Proof: ${hasIncomeProof ? 'Yes' : 'Missing'}`,
      requiredValue: 'Both ID Proof & Income Proof',
      message: docsPassed
        ? 'All mandatory ID and Income documents are attached.'
        : 'Missing mandatory ID proof or Income proof document.',
    },
  ];

  const score = checks.reduce(
    (total, check) => (check.passed ? total + check.weight : total),
    0
  );
  const isEligible = checks.every((check) => check.passed);

  return {
    isEligible,
    score,
    calculatedEmi,
    interestRate: annualRate,
    evaluatedAt: new Date(),
    checks,
  };
};
