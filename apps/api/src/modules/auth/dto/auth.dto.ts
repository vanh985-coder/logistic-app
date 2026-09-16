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
