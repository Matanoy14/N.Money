import { useAccount } from '../context/AccountContext';
import type { AccountType } from '../context/AccountContext';

export interface AccountFeatures {
  showMemberAssignment: boolean;
  showSharedToggle: boolean;
  showChildrenTracking: boolean;
  showPartnerSplit: boolean;
  showFamilyOverview: boolean;
  maxMembers: number;
  terminology: {
    myExpenses: string;
    addTransaction: string;
    budgetLabel: string;
  };
}

const featuresByType: Record<AccountType, AccountFeatures> = {
  personal: {
    showMemberAssignment: false,
    showSharedToggle: false,
    showChildrenTracking: false,
    showPartnerSplit: false,
    showFamilyOverview: false,
    maxMembers: 1,
    terminology: {
      myExpenses: 'ההוצאות שלי',
      addTransaction: 'הוסף עסקה',
      budgetLabel: 'התקציב שלי',
    },
  },
  couple: {
    showMemberAssignment: true,
    showSharedToggle: true,
    showChildrenTracking: false,
    showPartnerSplit: true,
    showFamilyOverview: false,
    maxMembers: 2,
    terminology: {
      myExpenses: 'הוצאות',
      addTransaction: 'הוסף עסקה',
      budgetLabel: 'תקציב משותף',
    },
  },
  family: {
    showMemberAssignment: true,
    showSharedToggle: true,
    showChildrenTracking: true,
    showPartnerSplit: true,
    showFamilyOverview: true,
    maxMembers: 6,
    terminology: {
      myExpenses: 'הוצאות המשפחה',
      addTransaction: 'הוסף עסקה',
      budgetLabel: 'תקציב משפחתי',
    },
  },
};

export const useAccountFeatures = (): AccountFeatures => {
  const { accountType, members } = useAccount();
  const features = { ...featuresByType[accountType] };

  if (accountType === 'family') {
    const hasChildren = members.some((m) => m.role === 'child');
    features.showChildrenTracking = hasChildren;
  }

  return features;
};
