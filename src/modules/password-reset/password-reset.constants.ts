export const PASSWORD_RESET_MAIL_QUEUE = 'password-reset-mail';
export const SEND_RESET_MAIL = 'send-reset-mail';

// The token travels with the job rather than being read back from the database
// later, because only its digest is stored and the digest cannot be undone.
export interface ResetMailJob {
  email: string;
  token: string;
}
