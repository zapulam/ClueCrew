import React, { useEffect } from "react";
import { motion } from "framer-motion";

const WIDTHS = { md: "max-w-md", lg: "max-w-lg", wide: "max-w-3xl" };

export function Modal({ onClose, label, width = "md", className = "", children }) {
  useEffect(() => {
    if (!onClose) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 bg-black/70 backdrop-blur-md flex justify-center items-center z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`bg-gray-900/95 backdrop-blur-xl p-6 md:p-8 rounded-3xl text-gray-100 w-11/12 ${WIDTHS[width]} max-h-[92dvh] overflow-y-auto shadow-2xl border border-gray-700/50 ${className}`}
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
