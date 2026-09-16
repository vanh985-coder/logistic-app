import { CompanyType, UserRole } from '@logix/shared';

export interface RegisterDto {
  taxCode: string;
  companyName: string;
  companyType: CompanyType;
  representativeName?: string;
  address?: string;
  companyPhone?: string;
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role?: UserRole;
}

export interface LoginDto {
  email: string;
  password: string;
}

/**
 * Minimal registration response DTO.
 * Excludes sensitive taxCode, internal timestamps, and lifecycle status.
 */
export interface RegisterResponseDto {
  message: string;
  company: {
    id: string;
    name: string;
    type: string;
  };
  user: {
    id: string;
    email: string;
    fullName: string | null;
    role: string;
  };
}

/**
 * Minimal login response DTO.
 * Excludes companyStatus and administrative metadata.
 */
export interface LoginResponseDto {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string | null;
    role: string;
    companyId: string;
    companyName: string;
  };
}

/**
 * Minimal user profile response DTO for /auth/me.
 * Excludes taxCode, lastLoginAt, userStatus, and companyStatus.
 */
export interface UserProfileResponseDto {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: string;
  company: {
    id: string;
    name: string;
    type: string;
  };
}
