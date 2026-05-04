"use client";

/** Reexporta o feedback central para o painel admin (mesmo provider que o app pode usar). */
export {
  CenterScreenFeedbackProvider as AdminSaveFeedbackProvider,
  useCenterScreenFeedback as useAdminSaveFeedback,
  type CenterScreenFeedbackTone as AdminSaveFeedbackTone,
} from "@/components/feedback/CenterScreenFeedback";
