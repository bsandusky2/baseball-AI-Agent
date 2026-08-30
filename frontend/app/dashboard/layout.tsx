import SideNav from '@/app/ui/dashboard/sidenav';
import { ChatMenuProvider } from '@/app/ui/dashboard/chat-menu-context';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ChatMenuProvider>
      <div className="flex h-screen flex-col md:flex-row md:overflow-hidden">
        <div className="w-full flex-none md:w-80">
          <SideNav />
        </div>
        <div className="grow p-6 md:overflow-y-auto md:p-12">{children}</div>
      </div>
    </ChatMenuProvider>
  );
}