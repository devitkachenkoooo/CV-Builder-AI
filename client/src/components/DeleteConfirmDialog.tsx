import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
  itemName?: string;
}

export function DeleteConfirmDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  isDeleting = false,
  itemName = "resume"
}: DeleteConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {isOpen && (
        <AlertDialog open={isOpen} onOpenChange={onClose}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <AlertDialogContent className="glass-card border-destructive/20 shadow-2xl max-w-md mx-auto">
              <AlertDialogHeader className="space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-destructive" />
                </div>
                <AlertDialogTitle className="text-center text-xl font-display font-bold">
                  {t("delete_dialog.title", { itemName })}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-center text-base">
                  {t("delete_dialog.description", { itemName })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-3 sm:gap-3">
                <AlertDialogCancel 
                  disabled={isDeleting}
                  className="flex-1 h-11 rounded-xl border-2 border-border/50 bg-background/50 hover:bg-background/80 transition-all duration-200 font-medium"
                >
                  {t("common.cancel")}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={onConfirm}
                  disabled={isDeleting}
                  className="flex-1 h-11 rounded-xl bg-destructive hover:bg-destructive/90 text-white font-medium shadow-lg shadow-destructive/25 hover:shadow-xl hover:shadow-destructive/30 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md transition-all duration-200 flex items-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.div>
                      {t("common.deleting")}
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      {t("common.delete")}
                    </>
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </motion.div>
        </AlertDialog>
      )}
    </AnimatePresence>
  );
}
