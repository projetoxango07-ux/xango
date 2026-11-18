import { AuthProvider } from "@/components/AuthProvider";
import { SistemaShell } from "@/components/SistemaShell";

export default function SistemaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthProvider>
      <SistemaShell>{children}</SistemaShell>
    </AuthProvider>
  );
}
