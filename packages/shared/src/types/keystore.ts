export interface Keystore {
  public_key_pem: string;
  encrypted_private_key: string;
  iv: string;
  tag: string;
  salt: string;
  created_at: string;
}
