import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, X } from "lucide-react";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  message: string;
}

export function DeleteConfirmationModal({ isOpen, onClose, onConfirm, title, message }: DeleteConfirmationModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error("Deletion failed:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={!isDeleting ? onClose : undefined}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden p-6"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-zinc-100">{title}</h3>
                <p className="text-zinc-400 text-sm mt-1">{message}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isDeleting}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isDeleting}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                    />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>

            {!isDeleting && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
