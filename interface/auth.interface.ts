export interface IMyDetails {
  id: string;
  user_id: string;
  name: string;
  email: string;
  profile_image?: string;
  bio?: string;
  website?: string;
  location?: { city?: string; country?: string };
  created_at: string;
  is_chat_lock_enabled: boolean;
}