import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { Navbar } from '@/components/navbar';
import { ShoppingBag, ShieldCheck, Truck, CreditCard, Headphones } from 'lucide-react';

export const metadata: Metadata = {
  title: 'NovaMart — Sàn Thương Mại Điện Tử Đa Gian Hàng Chính Hãng',
  description:
    'Khám phá hàng ngàn sản phẩm công nghệ, thời trang, sách và gia dụng từ các gian hàng chính hãng.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="flex min-h-screen flex-col bg-slate-50/80 text-slate-900">
        <AuthProvider>
          <Navbar />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
            {children}
          </main>

          {/* E-Commerce Trust Footer */}
          <footer className="mt-12 border-t border-slate-200 bg-white">
            <div className="mx-auto max-w-7xl px-4 py-8">
              <div className="grid grid-cols-2 gap-6 border-b border-slate-100 pb-8 md:grid-cols-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      100% Chính Hãng
                    </h4>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Cam kết sản phẩm từ các gian hàng đối tác đã kiểm duyệt
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Giao Hàng Toàn Quốc
                    </h4>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Theo dõi tiến trình vận chuyển theo thời gian thực
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Thanh Toán An Toàn
                    </h4>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Hỗ trợ COD, Thẻ tín dụng, Ví điện tử & Chuyển khoản
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-violet-50 p-2.5 text-violet-600">
                    <Headphones className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Đổi Trả Dễ Dàng
                    </h4>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Hủy đơn & hoàn kho tự động trước khi bàn giao vận chuyển
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col items-center justify-between gap-3 text-xs text-slate-500 sm:flex-row">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-indigo-600" />
                  <strong className="text-slate-800">NovaMart Marketplace</strong>
                  <span>• Nền tảng thương mại điện tử đa gian hàng</span>
                </div>
                <span>© 2026 NovaMart Vietnam. All rights reserved.</span>
              </div>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
