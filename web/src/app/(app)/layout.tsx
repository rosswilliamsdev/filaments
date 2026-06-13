import { TopNav } from "@/components/TopNav";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <TopNav />
      <main
        id="content"
        className="mx-auto w-full max-w-[720px] flex-1 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        {children}
      </main>
    </>
  );
}
