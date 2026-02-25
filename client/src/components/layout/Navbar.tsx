import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { FileText, LogOut, Sparkles, LayoutGrid } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

export function Navbar() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const [location] = useLocation();

  if (!user) return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform duration-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">
              CV <span className="text-primary">Beautify</span>
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-1">
            <Link
              href="/"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2 ${location === "/"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
            >
              <LayoutGrid className="w-4 h-4" />
              {t("nav.templates")}
            </Link>
            <Link
              href="/my-resumes"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2 ${location === "/my-resumes"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
            >
              <FileText className="w-4 h-4" />
              {t("nav.my_resumes")}
            </Link>
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-secondary/50 backdrop-blur-md rounded-lg p-1 border border-border/40">
              <button
                onClick={() => i18n.changeLanguage('ua')}
                className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${i18n.language === 'ua' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                UA
              </button>
              <div className="w-[1px] h-3 bg-border/60 mx-px" />
              <button
                onClick={() => i18n.changeLanguage('en')}
                className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${i18n.language === 'en' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                EN
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-3 pr-4 border-r border-border/50">
              <div className="flex flex-col items-end">
                <span className="text-sm font-semibold">{user.firstName || user.email?.split('@')[0]}</span>
                <span className="text-xs text-muted-foreground">Pro Plan</span>
              </div>
              <img
                src={user.profileImageUrl || `https://ui-avatars.com/api/?name=${user.firstName || user.email}&background=random`}
                alt="Profile"
                className="w-9 h-9 rounded-full ring-2 ring-primary/20"
              />
            </div>

            <button
              onClick={() => logout()}
              className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10"
              title={t("nav.logout")}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

        </div>
      </div>
    </nav>
  );
}
