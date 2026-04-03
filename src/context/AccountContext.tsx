import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { PaymentSource } from '../lib/paymentMethods';

export type AccountType = 'personal' | 'couple' | 'family';

export interface AccountMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'partner' | 'child';
  avatarColor: string;
}

interface AccountContextType {
  accountId: string | null;
  accountType: AccountType;
  onboardingCompleted: boolean;
  accountLoading: boolean;
  setAccountType: (type: AccountType) => void;
  members: AccountMember[];
  setMembers: (members: AccountMember[]) => void;
  currentMember: AccountMember | null;
  isPersonal: boolean;
  isCouple: boolean;
  isFamily: boolean;
  refetchAccount: () => void;
  paymentSources: PaymentSource[];
  refetchPaymentSources: () => void;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export const AccountProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [accountId, setAccountId]                 = useState<string | null>(null);
  const [accountType, setAccountType]             = useState<AccountType>('personal');
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [accountLoading, setAccountLoading]       = useState(true);
  const [members, setMembers]                     = useState<AccountMember[]>([]);
  const [fetchCounter, setFetchCounter]           = useState(0);
  const [paymentSources, setPaymentSources]       = useState<PaymentSource[]>([]);
  const [psCounter, setPsCounter]                 = useState(0);

  const refetchPaymentSources = useCallback(() => setPsCounter(c => c + 1), []);

  const refetchAccount = useCallback(() => setFetchCounter(c => c + 1), []);

  useEffect(() => {
    if (!user) {
      setAccountId(null);
      setAccountType('personal');
      setOnboardingCompleted(false);
      setMembers([]);
      setAccountLoading(false);
      return;
    }

    let cancelled = false;
    setAccountLoading(true);

    const load = async () => {
      // 1. Fetch account_id + account type in one query
      const { data: memberRow } = await supabase
        .from('account_members')
        .select('account_id, accounts(type)')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      const resolvedAccountId = memberRow?.account_id ?? null;
      const rawType = (memberRow?.accounts as { type?: string } | null)?.type;
      const resolvedType: AccountType =
        rawType === 'couple' ? 'couple'
        : rawType === 'family' ? 'family'
        : 'personal';

      setAccountId(resolvedAccountId);
      setAccountType(resolvedType);

      // 2. Fetch onboarding_completed from user_profiles (id = auth.uid)
      const { data: profileRow } = await supabase
        .from('user_profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .maybeSingle();

      if (cancelled) return;
      setOnboardingCompleted(profileRow?.onboarding_completed ?? false);

      // 3. Fetch members — two separate queries.
      //    account_members.user_id FK targets auth.users (not user_profiles),
      //    so PostgREST cannot resolve user_profiles(display_name) as an
      //    embedded resource. The join causes a 400 error that silently leaves
      //    memberRows=null and members=[]. Split into plain members + profiles.
      if (resolvedAccountId) {
        const { data: memberRows, error: membersError } = await supabase
          .from('account_members')
          .select('user_id, role')
          .eq('account_id', resolvedAccountId);

        if (cancelled) return;

        if (memberRows && !membersError) {
          // Fetch display names best-effort; RLS may limit results to own profile
          const nameMap: Record<string, string> = {};
          const ids = memberRows.map(m => m.user_id);
          if (ids.length) {
            const { data: profiles } = await supabase
              .from('user_profiles')
              .select('id, display_name')
              .in('id', ids);
            if (cancelled) return;
            (profiles ?? []).forEach((p: { id: string; display_name?: string | null }) => {
              if (p.id) nameMap[p.id] = p.display_name ?? '';
            });
          }

          const mapped: AccountMember[] = memberRows.map((m) => ({
            id:          m.user_id,
            name:        nameMap[m.user_id] || m.user_id.slice(0, 8),
            email:       '',
            role:        (m.role as AccountMember['role']) ?? 'owner',
            avatarColor: '#1E56A0',
          }));
          setMembers(mapped);
        }
        // membersError: members stays [] — SettingsPage shows "שגיאת טעינה"
      }

      if (!cancelled) setAccountLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [user?.id, fetchCounter]);

  // ── Load payment sources (independent of main account load) ──────────────
  useEffect(() => {
    if (!user) { setPaymentSources([]); return; }
    supabase
      .from('payment_sources')
      .select('id, name, type, color')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at')
      .then(({ data }) => { setPaymentSources((data ?? []) as PaymentSource[]); });
  }, [user?.id, psCounter]);

  const isPersonal = accountType === 'personal';
  const isCouple   = accountType === 'couple';
  const isFamily   = accountType === 'family';

  const currentMember: AccountMember | null =
    members.find((m) => m.id === user?.id) ?? members[0] ?? null;

  return (
    <AccountContext.Provider
      value={{
        accountId,
        accountType,
        onboardingCompleted,
        accountLoading,
        setAccountType,
        members,
        setMembers,
        currentMember,
        isPersonal,
        isCouple,
        isFamily,
        refetchAccount,
        paymentSources,
        refetchPaymentSources,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
};

export const useAccount = () => {
  const context = useContext(AccountContext);
  if (context === undefined) {
    throw new Error('useAccount must be used within AccountProvider');
  }
  return context;
};
