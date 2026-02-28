import { motion } from "framer-motion";
import { Sparkles, FileText, CheckCircle2, ArrowRight, Upload, Zap, Download } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function LandingPage() {
  const { t } = useTranslation();
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-mesh flex flex-col relative overflow-hidden">
      {/* Decorative Blur Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full z-10 grid lg:grid-cols-2 gap-16 items-center py-20 min-h-[90vh]">

        {/* Left Content */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="space-y-8"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold">
            <Sparkles className="w-4 h-4" />
            <span>{t("landing.badge")}</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-extrabold text-foreground leading-[1.1]">
            {t("landing.title_part1")}<span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">{t("landing.title_accent")}</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-xl">
            {t("landing.description")}
          </p>

          <ul className="space-y-4 text-muted-foreground">
            {[
              t("landing.features.templates"),
              t("landing.features.extraction"),
              t("landing.features.generation")
            ].map((feature, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + (i * 0.1) }}
                className="flex items-center gap-3"
              >
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span>{feature}</span>
              </motion.li>
            ))}
          </ul>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="pt-4"
          >
            <button
              onClick={handleLogin}
              className="group flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-lg text-white bg-gradient-to-r from-primary to-accent shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-1 transition-all duration-300"
            >
              {t("landing.get_started")}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="mt-4 text-sm text-muted-foreground">{t("landing.secure_login")}</p>
          </motion.div>
        </motion.div>

        {/* Right Content - Abstract Dashboard Mockup */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, rotateY: 10 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative hidden lg:block"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 to-accent/30 rounded-[2rem] blur-2xl transform rotate-3"></div>

          <div className="glass-card rounded-[2rem] p-6 relative overflow-hidden transform transition-transform hover:scale-[1.02] duration-500">
            {/* Header Mock */}
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-border/50">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-amber-400"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
            </div>

            {/* Template Grid Mock */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { id: 1, src: '/images/templates/template-5.png' },
                { id: 2, src: '/images/templates/template-6.png' },
                { id: 3, src: '/images/templates/template-4.png' },
                { id: 4, src: '/images/templates/template-10.png' }
              ].map((template) => (
                <div key={template.id} className="bg-secondary/40 rounded-xl overflow-hidden border border-border/50 aspect-[1/1.4] relative group">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                    <div className="w-full h-8 bg-white/20 backdrop-blur-sm rounded-lg"></div>
                  </div>
                  <img
                    src={template.src}
                    alt="CV Template"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => { 
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&q=80&fit=crop' 
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Floating Gen Mock */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -right-8 top-1/2 p-4 glass-card rounded-2xl flex items-center gap-4 shadow-2xl"
            >
              <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">AI Formatting...</p>
                <div className="w-32 h-1.5 bg-secondary rounded-full mt-2">
                  <div className="w-2/3 h-full bg-primary rounded-full"></div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* How It Works Section */}
      <section className="py-24 bg-secondary/30 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">
              {t("landing.how_it_works.title")}
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-primary to-accent mx-auto rounded-full"></div>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                icon: Upload,
                title: t("landing.how_it_works.step1_title"),
                desc: t("landing.how_it_works.step1_desc")
              },
              {
                icon: Zap,
                title: t("landing.how_it_works.step2_title"),
                desc: t("landing.how_it_works.step2_desc")
              },
              {
                icon: Download,
                title: t("landing.how_it_works.step3_title"),
                desc: t("landing.how_it_works.step3_desc")
              }
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
                className="flex flex-col items-center text-center group"
              >
                <div className="w-16 h-16 rounded-2xl bg-background border border-border/50 flex items-center justify-center text-primary mb-6 shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                  <step.icon className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
