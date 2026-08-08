import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";

export default function SistemaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <Header />

      <div className="flex min-h-[calc(100vh-4rem)]">
        <Sidebar />

        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}