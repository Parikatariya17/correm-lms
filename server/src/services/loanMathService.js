export const LOAN_INTEREST_RATES = {
  Home: 8.5,
  Vehicle: 10.5,
  Personal: 13.5,
  Business: 15.0,
};

const roundToTwo = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

/**
 * Returns the fixed annual interest rate (%) for a given loan type.
 */
export const getInterestRateForLoanType = (loanType) => {
  return LOAN_INTEREST_RATES[loanType] ?? LOAN_INTEREST_RATES.Personal;
};

/**
 * Calculates reducing-balance monthly EMI:
 * E = P * r * (1 + r)^n / ((1 + r)^n - 1)
 */
export const calculateMonthlyEMI = (principal, annualRate, tenureMonths) => {
  if (!principal || !tenureMonths || principal <= 0 || tenureMonths <= 0) {
    return 0;
  }

  if (!annualRate || annualRate === 0) {
    return roundToTwo(principal / tenureMonths);
  }

  const monthlyRate = annualRate / 12 / 100;
  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  const emi = (principal * monthlyRate * factor) / (factor - 1);

  return roundToTwo(emi);
};

/**
 * Generates a full month-by-month reducing-balance amortization schedule.
 */
export const generateAmortizationSchedule = (
  amount,
  annualRate,
  tenureMonths,
  startDate = new Date()
) => {
  const emi = calculateMonthlyEMI(amount, annualRate, tenureMonths);
  const monthlyRate = annualRate / 12 / 100;
  let remainingBalance = amount;
  const installments = [];

  for (let i = 1; i <= tenureMonths; i++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i);

    const interestComponent = roundToTwo(remainingBalance * monthlyRate);
    let principalComponent = roundToTwo(emi - interestComponent);
    let currentEmi = emi;

    // Adjust final installment for rounding variance so balance closes cleanly at 0
    if (i === tenureMonths || principalComponent > remainingBalance) {
      principalComponent = roundToTwo(remainingBalance);
      currentEmi = roundToTwo(principalComponent + interestComponent);
      remainingBalance = 0;
    } else {
      remainingBalance = roundToTwo(remainingBalance - principalComponent);
    }

    installments.push({
      installmentNo: i,
      dueDate,
      emi: currentEmi,
      principal: principalComponent,
      interest: interestComponent,
      balance: remainingBalance,
      status: 'PENDING',
    });
  }

  return installments;
};
