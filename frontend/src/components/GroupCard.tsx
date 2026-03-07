import { GroupListItem } from '../services/api';
import { Users, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface GroupCardProps {
    group: GroupListItem;
}

export default function GroupCard({ group }: GroupCardProps) {
    const navigate = useNavigate();

    return (
        <button
            onClick={() => navigate(`/groups/${group.id}`)}
            className="w-full bg-surface border border-border rounded-2xl p-5 hover:bg-surface-hover hover:border-accent/30 transition-all duration-300 text-left group cursor-pointer"
        >
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-primary truncate mb-1">{group.name}</h3>
                    <div className="flex items-center gap-1.5 text-secondary text-xs">
                        <Users className="w-3.5 h-3.5" />
                        <span>{group.member_count} member{group.member_count !== 1 ? 's' : ''}</span>
                    </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-surface-light flex items-center justify-center group-hover:bg-accent/10 transition-colors">
                    <ArrowRight className="w-4 h-4 text-secondary group-hover:text-accent transition-colors" />
                </div>
            </div>
            <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-primary">
                    ${group.total_expenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-secondary">total</span>
            </div>
        </button>
    );
}
