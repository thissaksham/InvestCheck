import React from "react";
import { motion } from "motion/react";
import { LayoutDashboard, Landmark, TrendingUp, LogOut, User as UserIcon, LineChart, ShieldCheck } from "lucide-react";
import { useAuth } from "../AuthContext";
import { cn } from "../lib/utils";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const { logout, user } = useAuth();

  const menuItems = [
    { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { id: "mf", icon: TrendingUp, label: "Mutual Funds" },
    { id: "stocks", icon: LineChart, label: "Stocks" },
    { id: "fd", icon: Landmark, label: "Fixed Deposits" },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-20 flex flex-col items-center py-8 bg-zinc-900 border-r border-zinc-800 z-50">
      <div className="mb-12">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <ShieldCheck className="text-white w-7 h-7" />
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-6">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "p-3 rounded-xl transition-all duration-200 group relative",
              activeTab === item.id 
                ? "bg-zinc-800 text-blue-500" 
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
            )}
          >
            <item.icon className="w-6 h-6" />
            <span className="absolute left-full ml-4 px-2 py-1 bg-zinc-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-6">
        <button 
          onClick={logout}
          className="p-3 rounded-xl text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 transition-all duration-200 group relative"
        >
          <LogOut className="w-6 h-6" />
          <span className="absolute left-full ml-4 px-2 py-1 bg-zinc-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            Logout
          </span>
        </button>
        
        <div className="w-10 h-10 rounded-full overflow-hidden border border-zinc-800">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-zinc-500" />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

export function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="mb-10">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-semibold text-zinc-100 tracking-tight">{title}</h1>
        <p className="text-zinc-400 mt-1 text-lg">{subtitle}</p>
      </motion.div>
    </header>
  );
}
