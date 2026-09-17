import { UserRole } from '@logix/shared';

export interface NavItem {
  label: string;
  href: string;
}

export function getDefaultDashboardForRole(role?: string | null): string {
  if (!role) return '/login';
  if (role === UserRole.PLATFORM_ADMIN) return '/dashboard/admin';
  if (role.startsWith('SHIPPER')) return '/dashboard/shipper';
  if (role.startsWith('FWD')) return '/dashboard/fwd';
  if (role.startsWith('CFS')) return '/dashboard/cfs';
  if (role === UserRole.COMPANY_ADMIN || role === UserRole.ADMIN) return '/dashboard/shipper';
  return '/dashboard/shipper';
}

export function isRouteAllowedForRole(pathname: string, role?: string | null): boolean {
  if (!role) return false;

  // Platform Admin has global operational access
  if (role === UserRole.PLATFORM_ADMIN) {
    return true;
  }

  // Admin dashboard is strictly restricted to PLATFORM_ADMIN
  if (pathname.startsWith('/dashboard/admin')) {
    return false;
  }

  // Shipper dashboard
  if (pathname.startsWith('/dashboard/shipper')) {
    return role.startsWith('SHIPPER') || role === UserRole.COMPANY_ADMIN || role === UserRole.ADMIN;
  }

  // Forwarder dashboard
  if (pathname.startsWith('/dashboard/fwd')) {
    return role.startsWith('FWD');
  }

  // CFS warehouse dashboard
  if (pathname.startsWith('/dashboard/cfs')) {
    return role.startsWith('CFS');
  }

  // Generic shipments & match groups management is accessible to all logged-in business users
  if (pathname.startsWith('/shipments') || pathname.startsWith('/match-groups')) {
    return true;
  }

  return true;
}

export function getNavItemsForRole(role?: string | null): NavItem[] {
  if (!role) return [];

  const items: NavItem[] = [
    { label: '📦 Quản lý Lô hàng', href: '/shipments' },
    { label: '🧩 Ghép Hàng & Consol', href: '/match-groups' },
  ];

  if (role === UserRole.PLATFORM_ADMIN) {
    items.push(
      { label: 'Chủ hàng (Shipper)', href: '/dashboard/shipper' },
      { label: 'Giao nhận (Forwarder)', href: '/dashboard/fwd' },
      { label: 'Kho gom hàng (CFS)', href: '/dashboard/cfs' },
      { label: 'Quản trị sàn (Admin)', href: '/dashboard/admin' },
    );
    return items;
  }

  if (role.startsWith('SHIPPER') || role === UserRole.COMPANY_ADMIN || role === UserRole.ADMIN) {
    items.push({ label: 'Chủ hàng (Shipper)', href: '/dashboard/shipper' });
  } else if (role.startsWith('FWD')) {
    items.push({ label: 'Giao nhận (Forwarder)', href: '/dashboard/fwd' });
  } else if (role.startsWith('CFS')) {
    items.push({ label: 'Kho gom hàng (CFS)', href: '/dashboard/cfs' });
  }

  return items;
}
