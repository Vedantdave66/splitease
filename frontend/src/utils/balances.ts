import { Expense, SettlementRecord, GroupMember, UserBalance, Settlement } from '../services/api';

export interface ComputedBalance {
    user_id: string;
    name: string;
    avatar_color: string;
    spent: number;
    owed: number;
    received: number;
    sent: number;
    net_balance: number;
}

/**
 * Computes user balances based ONLY on backend data.
 * Backend as the SINGLE source of truth.
 */
export function computeUserBalances(
    expenses: Expense[],
    settlements: SettlementRecord[],
    members: GroupMember[]
): ComputedBalance[] {
    const balanceMap: Record<string, ComputedBalance> = {};

    // Initialize map with members
    members.forEach(member => {
        balanceMap[member.user_id] = {
            user_id: member.user_id,
            name: member.name,
            avatar_color: member.avatar_color,
            spent: 0,
            owed: 0,
            received: 0,
            sent: 0,
            net_balance: 0
        };
    });

    // 1. Process Expenses
    expenses.forEach(expense => {
        // Payer spent the money
        if (balanceMap[expense.paid_by]) {
            balanceMap[expense.paid_by].spent += Number(expense.amount);
        }

        // Participants owe their share_amount
        expense.participants.forEach(p => {
            if (balanceMap[p.user_id]) {
                balanceMap[p.user_id].owed += Number(p.share_amount);
            }
        });
    });

    // 2. Process Settlements (Payments)
    // Only 'succeeded' or 'settled' status counts towards the balance adjustment
    settlements.forEach(s => {
        if (s.status === 'succeeded' || s.status === 'settled') {
            if (balanceMap[s.payee_id]) {
                balanceMap[s.payee_id].received += Number(s.amount);
            }
            if (balanceMap[s.payer_id]) {
                balanceMap[s.payer_id].sent += Number(s.amount);
            }
        }
    });

    // 3. Final Computation
    // net = spent - owed
    // final_balance = net + (received - sent)
    return Object.values(balanceMap).map(b => {
        const net = b.spent - b.owed;
        const final_balance = net + (b.received - b.sent);
        
        return {
            ...b,
            net_balance: final_balance
        };
    });
}

/**
 * Simplifies a set of balances into peer-to-peer suggested settlements.
 * (Suggested logic for "Suggested Settlements" tab)
 */
export function deriveSuggestedSettlements(balances: ComputedBalance[]): Settlement[] {
    const debtors = balances
        .filter(b => b.net_balance < -0.01)
        .map(b => ({ ...b, amount: Math.abs(b.net_balance) }))
        .sort((a, b) => b.amount - a.amount);
        
    const creditors = balances
        .filter(b => b.net_balance > 0.01)
        .map(b => ({ ...b, amount: b.net_balance }))
        .sort((a, b) => b.amount - a.amount);

    const suggestions: Settlement[] = [];
    
    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i];
        const creditor = creditors[j];
        
        const amount = Math.min(debtor.amount, creditor.amount);
        
        suggestions.push({
            from_user_id: debtor.user_id,
            from_user_name: debtor.name,
            from_user_email: '', // Not strictly needed for UI display if name is available
            from_avatar_color: debtor.avatar_color,
            to_user_id: creditor.user_id,
            to_user_name: creditor.name,
            to_user_email: '',
            to_avatar_color: creditor.avatar_color,
            amount: amount
        });

        debtor.amount -= amount;
        creditor.amount -= amount;

        if (debtor.amount < 0.01) i++;
        if (creditor.amount < 0.01) j++;
    }

    return suggestions;
}

/**
 * Checks if all balances are settled within a tolerance.
 */
export function isAllSettled(balances: ComputedBalance[]): boolean {
    return balances.every(b => Math.abs(b.net_balance) < 0.01);
}
