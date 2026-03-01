import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { FileText, LogOut, Sparkles, LayoutGrid, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

export function Navbar() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

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
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:flex items-center gap-1 bg-secondary/50 backdrop-blur-md rounded-lg p-1 border border-border/40">
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
                <span className="text-xs text-muted-foreground">{t("nav.plan_pro")}</span>
              </div>
              <img
                src={user.profileImageUrl || `https://ui-avatars.com/api/?name=${user.firstName || user.email}&background=random`}
                alt={t("nav.profile_alt")}
                className="w-9 h-9 rounded-full ring-2 ring-primary/20"
              />
            </div>

            <button
              onClick={() => logout()}
              className="hidden sm:block p-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10"
              title={t("nav.logout")}
            >
              <LogOut className="w-5 h-5" />
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary/80 focus:outline-none"
              aria-label={t("nav.toggle_menu")}
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur-md overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-1">
              <Link
                href="/"
                onClick={() => setIsMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all ${location === "/"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
              >
                <LayoutGrid className="w-5 h-5" />
                {t("nav.templates")}
              </Link>
              <Link
                href="/my-resumes"
                onClick={() => setIsMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all ${location === "/my-resumes"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
              >
                <FileText className="w-5 h-5" />
                {t("nav.my_resumes")}
              </Link>

              <div className="pt-4 border-t border-border/40 mt-4 px-4 space-y-4">
                <div className="flex items-center gap-3">
                  <img
                    src={user.profileImageUrl || `https://ui-avatars.com/api/?name=${user.firstName || user.email}&background=random`}
                    alt={t("nav.profile_alt")}
                    className="w-10 h-10 rounded-full ring-2 ring-primary/20"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{user.firstName || user.email?.split('@')[0]}</span>
                    <span className="text-xs text-muted-foreground">{t("nav.plan_pro")}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-secondary/30 rounded-lg p-2 sm:hidden">
                  <span className="text-xs font-medium px-2">{t("common.language")}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => i18n.changeLanguage('ua')}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${i18n.language === 'ua' ? 'bg-primary text-white' : 'text-muted-foreground'}`}
                    >
                      UA
                    </button>
                    <button
                      onClick={() => i18n.changeLanguage('en')}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${i18n.language === 'en' ? 'bg-primary text-white' : 'text-muted-foreground'}`}
                    >
                      EN
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    logout();
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-base font-medium text-destructive hover:bg-destructive/10 transition-all"
                >
                  <LogOut className="w-5 h-5" />
                  {t("nav.logout")}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
