import { Expense } from '../services/api';
import Avatar from './Avatar';
import { Receipt } from 'lucide-react';

interface ExpenseCardProps {
    expense: Expense;
}

export default function ExpenseCard({ expense }: ExpenseCardProps) {
    const date = new Date(expense.created_at);
    const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return (
        <div className="bg-surface border border-border rounded-xl p-4 hover:bg-surface-hover transition-all duration-200">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                    <Receipt className="w-5 h-5 text-accent" />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-semibold text-primary truncate">{expense.title}</h4>
                        <span className="text-base font-bold text-primary ml-3">
                            ${expense.amount.toFixed(2)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-secondary">
                            <span>Paid by</span>
                            <div className="flex items-center gap-1.5">
                                <Avatar name={expense.payer_name} color={expense.payer_avatar_color} size="sm" />
                                <span className="font-medium text-primary">{expense.payer_name}</span>
                            </div>
                        </div>
                        <span className="text-xs text-secondary">{formatted}</span>
                    </div>
                </div>
            </div>

            {/* Participants */}
            <div className="mt-3 pt-3 border-t border-border">
                <div className="flex items-center gap-1">
                    <span className="text-xs text-secondary mr-2">Split between</span>
                    <div className="flex -space-x-2">
                        {expense.participants.slice(0, 5).map((p) => (
                            <Avatar key={p.user_id} name={p.name} color={p.avatar_color} size="sm" />
                        ))}
                    </div>
                    {expense.participants.length > 5 && (
                        <span className="text-xs text-secondary ml-2">+{expense.participants.length - 5}</span>
                    )}
                    <span className="text-xs text-secondary ml-auto">
                        ${expense.participants[0]?.share_amount.toFixed(2)}/each
                    </span>
                </div>
            </div>
        </div>
    );
}
