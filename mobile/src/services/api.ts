import AsyncStorage from '@react-native-async-storage/async-storage';

export const BASE_URL = "https://api.tandempay.ca/api";

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await AsyncStorage.getItem('token');
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const fullUrl = `${BASE_URL}${endpoint}`;

    // ── Debug logging ──────────────────────────────────────────────
    console.log(`[API] ${options.method || 'GET'} ${fullUrl}`);
    if (options.body) {
        console.log(`[API] Payload:`, options.body);
    }
    console.log(`[API] Headers:`, JSON.stringify(headers));
    // ──────────────────────────────────────────────────────────────

    const res = await fetch(fullUrl, {
        ...options,
        headers,
    });

    console.log(`[API] Response status: ${res.status} ${res.statusText}`);

    if (!res.ok) {
        // Read raw text first so we see the actual response body even if it's HTML
        const rawText = await res.text();
        console.log(`[API] Error body:`, rawText);

        let errorMsg = `HTTP ${res.status}`;
        try {
            const json = JSON.parse(rawText);
            errorMsg = json.detail || json.message || errorMsg;
        } catch {
            // Not JSON — surface the raw text (truncated) so it's visible
            errorMsg = rawText.slice(0, 200) || errorMsg;
        }
        throw new Error(errorMsg);
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
    wallet_balance: number;
}

export interface Token {
    access_token: string;
    token_type: string;
}

export const authApi = {
    register: (name: string, email: string, password: string) =>
        request<Token>('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password }),
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

// --- Balances & Settlements ---
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
    from_avatar_color: string;
    to_user_id: string;
    to_user_name: string;
    to_avatar_color: string;
    amount: number;
}

export const balancesApi = {
    getBalances: (groupId: string) => request<UserBalance[]>(`/groups/${groupId}/balances`),
    getSettlements: (groupId: string) => request<Settlement[]>(`/groups/${groupId}/settlements`),
};

// --- Friends ---
export interface FriendRequestOut {
    id: string;
    sender_id: string;
    receiver_email: string;
    status: string;
    created_at: string;
    sender_name: string;
    sender_avatar: string;
    sender_email: string;
}

export interface PendingRequests {
    sent: FriendRequestOut[];
    received: FriendRequestOut[];
}

export interface Friend {
    id: string;
    name: string;
    email: string;
    avatar_color: string;
    shared_groups_count: number;
}

export const friendsApi = {
    sendRequest: (email: string) =>
        request<FriendRequestOut>('/friends/requests', {
            method: 'POST',
            body: JSON.stringify({ email }),
        }),
    getPendingRequests: () =>
        request<PendingRequests>('/friends/requests/pending'),
    acceptRequest: (requestId: string) =>
        request<{status: string, message: string}>(`/friends/requests/${requestId}/accept`, { method: 'PUT' }),
    declineRequest: (requestId: string) =>
        request<{status: string, message: string}>(`/friends/requests/${requestId}/decline`, { method: 'PUT' }),
    getMyFriends: () =>
        request<Friend[]>('/me/friends'),
};

// --- Settlements & Payments ---
export interface SettlementRecordOut {
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
    status: string; // 'pending' | 'sent' | 'settled' | 'declined'
    created_at: string;
    updated_at: string;
}

export const meApi = {
    getPayments: () => request<SettlementRecordOut[]>('/me/payments'),
};

export const settlementsApi = {
    create: (groupId: string, payee_id: string, amount: number, method: string = 'in_app') =>
        request<SettlementRecordOut>(`/groups/${groupId}/settlement-records`, {
            method: 'POST',
            body: JSON.stringify({ payee_id, amount, method }),
        }),
    updateStatus: (groupId: string, settlementId: string, status: string) =>
        request<SettlementRecordOut>(`/groups/${groupId}/settlement-records/${settlementId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status }),
        }),
};

// --- Notifications ---
export interface NotificationOut {
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
    list: () => request<NotificationOut[]>('/notifications'),
    unreadCount: () => request<{count: number}>('/notifications/unread-count'),
    markRead: (id: string) =>
        request<NotificationOut>(`/notifications/${id}/read`, { method: 'PUT' }),
    markAllRead: () =>
        request<{status: string}>('/notifications/read-all', { method: 'PUT' }),
};

// --- Wallet ---
export interface WalletTransactionOut {
    id: string;
    user_id: string;
    type: string;
    amount: number;
    status: string;
    reference_id: string | null;
    created_at: string;
    completed_at: string | null;
}

export const walletApi = {
    getBalance: () => request<User>('/wallet/balance'),
    getTransactions: () => request<WalletTransactionOut[]>('/wallet/transactions'),
    addFunds: (amount: number, source: string = "Bank Account") =>
        request<User>('/wallet/add-funds', {
            method: 'POST',
            body: JSON.stringify({ amount, source })
        }),
    withdraw: (amount: number, destination: string = "Bank Account") =>
        request<User>('/wallet/withdraw', {
            method: 'POST',
            body: JSON.stringify({ amount, destination })
        })
};
