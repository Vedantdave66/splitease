import { GroupListItem } from '../services/api';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface GroupCardProps {
    group: GroupListItem;
}

export default function GroupCard({ group }: GroupCardProps) {
    const navigate = useNavigate();

    // Get the first initial of the group name for the avatar
    const initial = group.name ? group.name.charAt(0).toUpperCase() : '?';

    return (
        <button
            onClick={() => navigate(`/groups/${group.id}`)}
            className="w-full relative overflow-hidden bg-surface-light/40 border border-border/60 rounded-[2rem] p-7 hover:border-accent/40 hover:-translate-y-1 transition-all duration-500 text-left group cursor-pointer shadow-xl shadow-black/20 hover:shadow-[0_15px_40px_rgba(74,222,128,0.1)] flex flex-col backdrop-blur-sm"
        >
            {/* Subtle Gradient Glow on Hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-accent/0 to-accent/0 group-hover:from-accent/5 group-hover:to-transparent transition-colors duration-500 pointer-events-none" />

            <div className="relative z-10 flex items-start gap-5 mb-6">
                {/* Group Avatar / Initial Container */}
                <div className="relative shrink-0">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-surface to-bg flex items-center justify-center shadow-inner border border-border/80 group-hover:border-accent/40 transition-colors duration-500 relative z-10">
                        <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-400 group-hover:from-accent group-hover:to-emerald-200 transition-all duration-500">
                            {initial}
                        </span>
                    </div>
                    {/* Simulated member stacking */}
                    {group.member_count > 1 && (
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-indigo border-2 border-surface-light flex items-center justify-center z-20 shadow-sm shadow-black/50">
                            <span className="text-[9px] font-bold text-white leading-none">+{group.member_count - 1}</span>
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0 pt-1">
                    <h3 className="text-[1.15rem] font-black text-primary truncate mb-1.5 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-accent transition-all duration-300">
                        {group.name}
                    </h3>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-bg/60 border border-border/40">
                        <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">{group.member_count} Member{group.member_count !== 1 ? 's' : ''}</span>
                    </div>
                </div>
            </div>

            <div className="relative z-10 mt-auto pt-5 border-t border-border/40 flex items-end justify-between">
                <div>
                    <span className="text-[10px] text-secondary font-bold uppercase tracking-[0.15em] block mb-1.5">Total Expenses</span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-primary tracking-tight">
                            ${group.total_expenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>

                <div className="w-10 h-10 rounded-2xl bg-surface border border-border/50 flex items-center justify-center group-hover:bg-gradient-to-br group-hover:from-accent group-hover:to-emerald-500 transition-all duration-500 shadow-lg shadow-black/20 group-hover:shadow-[0_0_20px_rgba(74,222,128,0.4)] group-hover:border-transparent group-hover:scale-110">
                    <ArrowRight className="w-4 h-4 text-secondary group-hover:text-[#064E3B] transition-colors duration-500 drop-shadow-sm" />
                </div>
            </div>
        </button>
    );
}
