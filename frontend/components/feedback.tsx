"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useAppState } from "@/lib/state/app-state";

export function LoadingOverlay() {
  const { state } = useAppState();
  if (!state.ui.isHydrating && !state.ui.isOpeningPack && !state.ui.isUpdatingBinder) return null;
  return (
    <div className="loading-overlay" role="status" aria-live="assertive">
      <div className="loading-overlay__panel">
        {state.ui.isHydrating && "Syncing collection..."}
        {state.ui.isOpeningPack && "Loading pack..."}
        {state.ui.isUpdatingBinder && "Saving binder progress..."}
      </div>
    </div>
  );
}

export function ErrorBanner() {
  const { state } = useAppState();
  if (!state.ui.errorMessage) return null;
  return (
    <div className="error-banner" role="alert">
      {state.ui.errorMessage}
    </div>
  );
}

export function CelebrationToast() {
  const { state, dispatch } = useAppState();
  const celebration = state.ui.celebration;
  return (
    <AnimatePresence>
      {celebration && (
        <motion.div
          className="celebration-toast"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.25 }}
          role="status"
          aria-live="polite"
        >
          {celebration.kind !== "new-card" && (
            <div className="celebration-toast__sparks" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
          )}
          <strong>{celebration.kind.replace("-", " ").toUpperCase()}</strong>
          <p>{celebration.message}</p>
          <button className="btn btn--ghost" onClick={() => dispatch({ type: "DISMISS_CELEBRATION" })}>
            Dismiss
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
