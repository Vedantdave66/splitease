export const BASE_URL = "https://api.tandempay.ca/api";

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${BASE_URL}${endpoint}`, {
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
    wallet_balance: number;
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
    forgotPassword: (email: string) =>
        request<{ message: string }>('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email }),
        }),
    resetPassword: (token: string, new_password: string) =>
        request<{ message: string }>('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token, new_password }),
        }),
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

// --- Users (Search) ---
export interface UserSearchResult {
    id: string;
    name: string;
    email: string;
    avatar_color: string;
}

export const usersApi = {
    search: (query: string) => request<UserSearchResult[]>(`/users/search?query=${encodeURIComponent(query)}`),
};

// --- Friend Requests ---
export interface FriendRequest {
    id: string;
    sender_id: string;
    receiver_email: string;
    status: string;
    created_at: string;
    updated_at: string;
    sender_name?: string;
    sender_avatar?: string;
}

export const friendRequestsApi = {
    send: (email: string) =>
        request<FriendRequest>('/friends/requests', {
            method: 'POST',
            body: JSON.stringify({ email })
        }),
    getPending: () => request<{ sent: FriendRequest[], received: FriendRequest[] }>('/friends/requests/pending'),
    accept: (id: string) => request<{ status: string }>(`/friends/requests/${id}/accept`, { method: 'PUT' }),
    decline: (id: string) => request<{ status: string }>(`/friends/requests/${id}/decline`, { method: 'PUT' }),
};

// --- Fintech Overhaul: Providers, Ledger, and Payment Requests ---

export interface ProviderAccount {
    id: string;
    user_id: string;
    provider: string;
    account_mask: string;
    institution_name: string;
    status: string;
    created_at: string;
    updated_at: string;
}

export const bankLinksApi = {
    link: (institution_name: string, account_mask: string, provider: string = 'plaid') =>
        request<ProviderAccount>('/bank-links', {
            method: 'POST',
            body: JSON.stringify({ institution_name, account_mask, provider })
        }),
    list: () => request<ProviderAccount[]>('/bank-links'),
    remove: (id: string) => request<void>(`/bank-links/${id}`, { method: 'DELETE' }),
};

export const plaidApi = {
    createLinkToken: () => request<{ link_token: string }>('/plaid/create-link-token', { method: 'POST' }),
    setAccessToken: (public_token: string, institution_id: string, institution_name: string, account_id: string) =>
        request<ProviderAccount>('/plaid/set-access-token', {
            method: 'POST',
            body: JSON.stringify({ public_token, institution_id, institution_name, account_id })
        }),
};

export const stripeApi = {
    onboard: () => request<{ url: string }>('/stripe/onboard', { method: 'POST' }),
    getStatus: () => request<{ onboarded: boolean }>('/stripe/status'),
    createPaymentIntent: (data: { amount: number; payee_id: string; provider_account_id: string }) =>
        request<{ client_secret: string; status: string }>('/stripe/create-payment-intent', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
};

export interface WalletTransaction {
    id: string;
    user_id: string;
    tx_type: string;
    amount: number;
    status: string;
    related_request_id: string | null;
    created_at: string;
}

export const walletApi = {
    addFunds: (amount: number, source_account_id?: string) =>
        request<User>('/wallet/add-funds', {
            method: 'POST',
            body: JSON.stringify({ amount, source_account_id })
        }),
    withdraw: (data: { destination_account: string }) =>
        request<User>('/wallet/withdraw', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
    getBalance: () => request<User>('/wallet/balance'),
    getTransactions: () => request<WalletTransaction[]>('/wallet/transactions'),
};

export interface PaymentRequestData {
    id: string;
    group_id: string;
    requester_id: string;
    payer_id: string;
    amount: number;
    note: string | null;
    due_date: string | null;
    status: string;
    created_at: string;
    updated_at: string;

    requester_name: string | null;
    requester_avatar: string | null;
    payer_name: string | null;
    payer_avatar: string | null;
}

export const requestsApi = {
    create: (groupId: string, data: { payer_id: string; amount: number; note?: string; due_date?: string }) =>
        request<PaymentRequestData>(`/groups/${groupId}/requests`, {
            method: 'POST',
            body: JSON.stringify(data)
        }),
    list: (groupId: string) => request<PaymentRequestData[]>(`/groups/${groupId}/requests`),
    payWithWallet: (requestId: string) => request<PaymentRequestData>(`/requests/${requestId}/pay`, { method: 'PUT' }),
};
