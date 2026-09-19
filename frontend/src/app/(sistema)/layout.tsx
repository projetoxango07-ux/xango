import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { AuthProvider } from "@/components/AuthProvider";
import { ModoAprendiz } from "@/components/ModoAprendiz";
import { dignaBrandStyle } from "@/lib/dignaBrand";

export default function SistemaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthProvider>
      <div style={dignaBrandStyle} className="min-h-screen bg-xango-background text-xango-text">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header />
            <main className="flex-1 p-8">{children}</main>
          </div>
        </div>
        <ModoAprendiz />
      </div>
    </AuthProvider>
  );
}
