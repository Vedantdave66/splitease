import { Expense } from '../services/api';
import { formatCurrency } from '../utils/currency';
import Avatar from './Avatar';
import { Receipt, Edit2, Trash2 } from 'lucide-react';

interface ExpenseCardProps {
    expense: Expense;
    onEdit?: (expense: Expense) => void;
    onDelete?: (expense: Expense) => void;
}

export default function ExpenseCard({ expense, onEdit, onDelete }: ExpenseCardProps) {
    const date = new Date(expense.created_at);
    const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return (
        <div className="group bg-surface border border-border rounded-xl p-4 hover:bg-surface-hover transition-all duration-200">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                    <Receipt className="w-5 h-5 text-accent" />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-semibold text-primary truncate">{expense.title}</h4>
                        <div className="flex items-center gap-3">
                            {/* Hover Actions */}
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mr-2">
                                {onEdit && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onEdit(expense); }}
                                        className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-surface transition-colors cursor-pointer"
                                        title="Edit Expense"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {onDelete && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDelete(expense); }}
                                        className="p-1.5 rounded-lg text-secondary hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                                        title="Delete Expense"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                            <span className="text-base font-bold text-primary">
                                ${formatCurrency(expense?.amount)}
                            </span>
                        </div>
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
                        ${formatCurrency(expense.participants[0]?.share_amount)}/each
                    </span>
                </div>
            </div>
        </div>
    );
}
