import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-app text-body p-4">
      <h1 className="text-4xl font-bold text-title mb-2">404</h1>
      <p className="text-muted-foreground mb-6">Trang bạn tìm kiếm không tồn tại hoặc đã bị di chuyển.</p>
      <Link
        href="/"
        className="rounded-lg bg-primary px-4 py-2 text-white font-medium hover:bg-primary-hover transition"
      >
        Về trang chủ
      </Link>
    </div>
  );
}