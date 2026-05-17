import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'upper-stock-secret-key-2026-private');

export interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'supervisor' | 'operator' | 'pm' | 'accountant' | 'worker';
}

export async function signToken(user: AuthUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as AuthUser;
  } catch {
    return null;
  }
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function canApprove(role: string): boolean {
  return role === 'admin' || role === 'supervisor';
}

export function canDelete(role: string): boolean {
  return role === 'admin' || role === 'supervisor';
}

export function isAdmin(role: string): boolean {
  return role === 'admin';
}

export function isPM(role: string): boolean {
  return role === 'pm' || role === 'admin';
}

export function isAccountant(role: string): boolean {
  return role === 'accountant' || role === 'admin';
}

export function isWorker(role: string): boolean {
  return role === 'worker';
}
