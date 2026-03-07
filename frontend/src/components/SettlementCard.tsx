import { Settlement } from '../services/api';
import Avatar from './Avatar';
import { ArrowRight } from 'lucide-react';

interface SettlementCardProps {
    settlement: Settlement;
}

export default function SettlementCard({ settlement }: SettlementCardProps) {
    return (
        <div className="bg-surface border border-border rounded-xl p-4 hover:bg-surface-hover transition-all duration-200">
            <div className="flex items-center gap-3">
                <Avatar name={settlement.from_user_name} color={settlement.from_avatar_color} size="md" />

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold text-primary truncate">{settlement.from_user_name}</span>
                        <ArrowRight className="w-4 h-4 text-accent shrink-0" />
                        <span className="font-semibold text-primary truncate">{settlement.to_user_name}</span>
                    </div>
                    <p className="text-xs text-secondary mt-0.5">
                        pays <span className="text-accent font-bold">${settlement.amount.toFixed(2)}</span>
                    </p>
                </div>

                <Avatar name={settlement.to_user_name} color={settlement.to_avatar_color} size="md" />
            </div>
        </div>
    );
}
