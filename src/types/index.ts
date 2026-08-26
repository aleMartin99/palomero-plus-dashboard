export interface AdminUser {
  id: string;
  email: string;
  username: string;
  display_name: string;
  is_public: boolean;
  account_status: 'active' | 'inactive' | 'deleted' | string;
  email_confirmed_at: string | null;
  created_at: string;
}

export interface Pigeon {
  id: string;
  user_id: string;
  name: string;
  ring_number: string;
  sex: 'M' | 'F' | string;
}

export interface Capture {
  id: string;
  user_id: string;
  pigeon_id: string;
  captured_at: string;
}

export type ContactType = 'bug' | 'support' | 'feedback' | string;
export type ContactStatus = 'new' | 'pending' | 'solved' | 'closed' | string;

export interface ContactRequest {
  id: string;
  user_id: string;
  user_email: string;
  subject: string;
  description: string;
  type: ContactType;
  status: ContactStatus;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price_usd: number;
  is_active: boolean;
}

export interface Subscription {
  id: string;
  user_id: string;
  user_email: string;
  plan_id: string;
  status: string;
  end_date?: string | null;
  expires_at?: string | null;
}

export interface AdminDataBundle {
  users: AdminUser[];
  pigeons: Pigeon[];
  captures: Capture[];
  contactRequests: ContactRequest[];
  plans: SubscriptionPlan[];
  subscriptions: Subscription[];
}
