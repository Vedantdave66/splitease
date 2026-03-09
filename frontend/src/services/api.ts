let API_BASE = import.meta.env.VITE_API_URL || '/api';

// If Render injected just the host (e.g., "splitease-api-xyz.onrender.com")
if (API_BASE && !API_BASE.startsWith('http') && API_BASE !== '/api') {
    API_BASE = `https://${API_BASE}/api`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(error.detail || 'Request failed');
    }

    if (res.status === 204) {
        return {} as T;
    }

    return res.json();
}

// --- Auth ---
export interface User {
    id: string;
    name: string;
    email: string;
    avatar_color: string;
    created_at: string;
}

export interface Token {
    access_token: string;
    token_type: string;
}

export const authApi = {
    register: (name: string, email: string, password: string, interac_email?: string) =>
        request<Token>('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password, interac_email }),
        }),
    login: (email: string, password: string) =>
        request<Token>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        }),
    me: () => request<User>('/auth/me'),
};

// --- Groups ---
export interface GroupMember {
    user_id: string;
    name: string;
    email: string;
    avatar_color: string;
}

export interface Group {
    id: string;
    name: string;
    created_by: string;
    created_at: string;
    members: GroupMember[];
    total_expenses: number;
}

export interface GroupListItem {
    id: string;
    name: string;
    created_by: string;
    created_at: string;
    member_count: number;
    total_expenses: number;
}

export const groupsApi = {
    create: (name: string) =>
        request<Group>('/groups', { method: 'POST', body: JSON.stringify({ name }) }),
    list: () => request<GroupListItem[]>('/groups'),
    get: (id: string) => request<Group>(`/groups/${id}`),
    addMember: (groupId: string, email: string) =>
        request<GroupMember>(`/groups/${groupId}/members`, {
            method: 'POST',
            body: JSON.stringify({ email }),
        }),
    join: (groupId: string) =>
        request<GroupMember>(`/groups/${groupId}/join`, {
            method: 'POST',
        }),
    deleteGroup: (groupId: string) =>
        request<void>(`/groups/${groupId}`, { method: 'DELETE' }),
    removeMember: (groupId: string, userId: string) =>
        request<void>(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),
};

// --- Expenses ---
export interface ExpenseParticipant {
    user_id: string;
    name: string;
    share_amount: number;
    avatar_color: string;
}

export interface Expense {
    id: string;
    title: string;
    amount: number;
    paid_by: string;
    payer_name: string;
    payer_avatar_color: string;
    split_type: string;
    created_at: string;
    participants: ExpenseParticipant[];
}

export const expensesApi = {
    create: (groupId: string, data: { title: string; amount: number; paid_by: string; participant_ids: string[] }) =>
        request<Expense>(`/groups/${groupId}/expenses`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    list: (groupId: string) => request<Expense[]>(`/groups/${groupId}/expenses`),
    update: (groupId: string, expenseId: string, data: { title: string; amount: number; paid_by: string; participant_ids: string[] }) =>
        request<Expense>(`/groups/${groupId}/expenses/${expenseId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
    delete: (groupId: string, expenseId: string) =>
        request<void>(`/groups/${groupId}/expenses/${expenseId}`, {
            method: 'DELETE',
        }),
};

// --- Balances & Suggested Settlements ---
export interface UserBalance {
    user_id: string;
    name: string;
    avatar_color: string;
    total_paid: number;
    total_owed: number;
    net_balance: number;
}

export interface Settlement {
    from_user_id: string;
    from_user_name: string;
    from_user_email: string;
    from_avatar_color: string;
    to_user_id: string;
    to_user_name: string;
    to_user_email: string;
    to_avatar_color: string;
    amount: number;
}

export const balancesApi = {
    getBalances: (groupId: string) => request<UserBalance[]>(`/groups/${groupId}/balances`),
    getSettlements: (groupId: string) => request<Settlement[]>(`/groups/${groupId}/settlements`),
};

// --- Settlement Records (actual payment tracking) ---
export interface SettlementRecord {
    id: string;
    group_id: string;
    payer_id: string;
    payer_name: string;
    payer_email: string;
    payer_avatar_color: string;
    payee_id: string;
    payee_name: string;
    payee_email: string;
    payee_avatar_color: string;
    amount: number;
    method: string;
    status: string; // pending | sent | settled | declined
    created_at: string;
    updated_at: string;
}

export const settlementRecordsApi = {
    create: (groupId: string, data: { payee_id: string; amount: number; method: string }) =>
        request<SettlementRecord>(`/groups/${groupId}/settlement-records`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    list: (groupId: string) => request<SettlementRecord[]>(`/groups/${groupId}/settlement-records`),
    updateStatus: (groupId: string, settlementId: string, status: string) =>
        request<SettlementRecord>(`/groups/${groupId}/settlement-records/${settlementId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status }),
        }),
};

// --- Notifications ---
export interface AppNotification {
    id: string;
    user_id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    reference_id: string | null;
    group_id: string | null;
    created_at: string;
}

export const notificationsApi = {
    list: () => request<AppNotification[]>('/notifications'),
    unreadCount: () => request<{ count: number }>('/notifications/unread-count'),
    markRead: (id: string) => request<AppNotification>(`/notifications/${id}/read`, { method: 'PUT' }),
    markAllRead: () => request<{ status: string }>('/notifications/read-all', { method: 'PUT' }),
};

// --- Me (Global User Data) ---
export interface Friend {
    id: string;
    name: string;
    email: string;
    avatar_color: string;
    shared_groups_count: number;
}

export const meApi = {
    getPayments: () => request<SettlementRecord[]>('/me/payments'),
    getFriends: () => request<Friend[]>('/me/friends'),
};
