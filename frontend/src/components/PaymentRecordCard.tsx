import { SettlementRecord, settlementRecordsApi } from '../services/api';
import { formatCurrency } from '../utils/currency';
import Avatar from './Avatar';
import PaymentStatusBadge from './PaymentStatusBadge';
import { ArrowRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface PaymentRecordCardProps {
    record: SettlementRecord;
    currentUserId: string;
    groupId: string;
    onUpdated: () => void;
}

export default function PaymentRecordCard({ record, currentUserId, groupId, onUpdated }: PaymentRecordCardProps) {
    const [loading, setLoading] = useState(false);

    const isPayee = record.payee_id === currentUserId;
    const isPayer = record.payer_id === currentUserId;

    const handleUpdateStatus = async (newStatus: string) => {
        setLoading(true);
        try {
            await settlementRecordsApi.updateStatus(groupId, record.id, newStatus);
            onUpdated();
        } catch (err: any) {
            alert(err.message || 'Failed to update status');
        } finally {
            setLoading(false);
        }
    };

    const date = new Date(record.created_at);
    const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return (
        <div className="bg-surface-light border border-border rounded-2xl p-5 hover:border-primary/20 transition-all duration-300">
            {/* Top: Who pays whom */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <Avatar name={record.payer_name} color={record.payer_avatar_color} size="md" />
                    <ArrowRight className="w-4 h-4 text-accent/60" />
                    <Avatar name={record.payee_name} color={record.payee_avatar_color} size="md" />
                </div>
                <PaymentStatusBadge status={record.status} />
            </div>

            {/* Details row */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <p className="text-xs text-secondary mb-0.5">
                        {record.payer_name} → {record.payee_name}
                    </p>
                    <p className="text-[10px] text-secondary/70">
                        {formatted} • {record.method === 'in_app' ? 'In-App' : 'E-Transfer'}
                    </p>
                </div>
                <p className="text-xl font-black text-primary tracking-tight">
                    ${formatCurrency(record?.amount)}
                </p>
            </div>

            {/* Action buttons */}
            {isPayer && record.status === 'pending' && (
                <button
                    onClick={() => handleUpdateStatus('sent')}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-accent/20 to-accent/10 border border-accent/20 hover:border-accent/40 text-accent font-semibold text-sm py-2.5 rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-50"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Mark as Sent</>}
                </button>
            )}

            {isPayee && record.status === 'sent' && (
                <div className="flex gap-2">
                    <button
                        onClick={() => handleUpdateStatus('settled')}
                        disabled={loading}
                        className="flex-1 flex items-center justify-center gap-2 bg-accent/10 border border-accent/20 hover:border-accent/40 text-accent font-semibold text-sm py-2.5 rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Confirm Received</>}
                    </button>
                    <button
                        onClick={() => handleUpdateStatus('declined')}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 px-4 bg-red-500/5 border border-red-500/20 hover:border-red-500/30 text-red-400 font-semibold text-sm py-2.5 rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-50"
                    >
                        <XCircle className="w-4 h-4" />
                    </button>
                </div>
            )}

            {record.status === 'settled' && (
                <div className="flex items-center gap-2 justify-center py-2 bg-accent/5 border border-accent/10 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 text-accent" />
                    <span className="text-xs font-semibold text-accent">Balance Paid</span>
                </div>
            )}
        </div>
    );
}
