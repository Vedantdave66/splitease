import { UserBalance } from '../services/api';
import { formatCurrency } from '../utils/currency';
import Avatar from './Avatar';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface BalanceBubbleProps {
    balance: UserBalance;
}

export default function BalanceBubble({ balance }: BalanceBubbleProps) {
    const isPositive = balance.net_balance > 0;
    const isNegative = balance.net_balance < 0;

    return (
        <div className={`
      bg-surface border rounded-xl p-4 transition-all duration-200
      ${isPositive ? 'border-accent/30' : isNegative ? 'border-danger/30' : 'border-border'}
    `}>
            <div className="flex items-center gap-3 mb-3">
                <Avatar name={balance.name} color={balance.avatar_color} size="md" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-primary truncate">{balance.name}</p>
                    <p className="text-xs text-secondary">
                        Paid ${formatCurrency(balance?.total_paid)} · Owes ${formatCurrency(balance?.total_owed)}
                    </p>
                </div>
            </div>

            <div className={`
        flex items-center gap-2 px-3 py-2 rounded-lg
        ${isPositive ? 'bg-accent/10' : isNegative ? 'bg-danger/10' : 'bg-surface-light'}
      `}>
                {isPositive ? (
                    <TrendingUp className="w-4 h-4 text-accent" />
                ) : isNegative ? (
                    <TrendingDown className="w-4 h-4 text-danger" />
                ) : (
                    <Minus className="w-4 h-4 text-secondary" />
                )}
                <span className={`text-sm font-bold ${isPositive ? 'text-accent' : isNegative ? 'text-danger' : 'text-secondary'
                    }`}>
                    {isPositive ? '+' : ''}${formatCurrency(balance?.net_balance)}
                </span>
                <span className="text-xs text-secondary">
                    {isPositive ? 'gets back' : isNegative ? 'owes' : 'settled'}
                </span>
            </div>
        </div>
    );
}
