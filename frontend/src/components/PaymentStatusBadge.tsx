interface PaymentStatusBadgeProps {
    status: string;
    size?: 'sm' | 'md';
}

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    pending: {
        label: 'Pending',
        bg: 'bg-amber-500/10 border-amber-500/20',
        text: 'text-amber-700 dark:text-amber-300',
        dot: 'bg-amber-500 dark:bg-amber-400',
    },
    sent: {
        label: 'Awaiting Confirmation',
        bg: 'bg-indigo/10 border-indigo/20',
        text: 'text-indigo-700 dark:text-indigo-400',
        dot: 'bg-indigo-600 dark:bg-indigo-400',
    },
    settled: {
        label: 'Settled',
        bg: 'bg-accent/10 border-accent/20',
        text: 'text-accent dark:text-accent',
        dot: 'bg-accent',
    },
    declined: {
        label: 'Not Received',
        bg: 'bg-red-500/10 border-red-500/20',
        text: 'text-red-700 dark:text-red-400',
        dot: 'bg-red-600 dark:bg-red-400',
    },
    unpaid: {
        label: 'Unpaid',
        bg: 'bg-surface-light border-border',
        text: 'text-secondary font-bold',
        dot: 'bg-secondary/40',
    },
};

export default function PaymentStatusBadge({ status, size = 'sm' }: PaymentStatusBadgeProps) {
    const config = statusConfig[status] || statusConfig['unpaid'];

    return (
        <span className={`
            inline-flex items-center gap-1.5 border rounded-full font-semibold
            ${config.bg} ${config.text}
            ${size === 'sm' ? 'px-2.5 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'}
        `}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${status === 'sent' ? 'animate-pulse' : ''}`} />
            {config.label}
        </span>
    );
}
