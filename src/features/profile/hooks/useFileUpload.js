import { useState, useEffect } from "react";
import { extractTextFromFile, isAcceptedFile } from "../../../lib/fileExtractor";
import { buildExtractionSummary, mergeExtractedIntoProfile } from "../../../lib/profileExtractor";
import { useEngine } from "../../../engine";
import { useNotifications } from "../../../contexts/NotificationContext";

// Module-level cache: persists extraction state across unmount/remount per subject
const extractionCache = new Map();

export default function useFileUpload(subjectId, caseId) {
  const engine = useEngine();
  const { notify } = useNotifications();
  const [uploadState, setUploadState] = useState("idle");
  const [uploadError, setUploadError] = useState(null);
  const [extractionResult, setExtractionResult] = useState(null);

  // Sync local state from cache when subjectId changes or on mount
  useEffect(() => {
    if (!subjectId) {
      setUploadState("idle");
      setUploadError(null);
      setExtractionResult(null);
      return;
    }

    const cached = extractionCache.get(subjectId);
    if (!cached) {
      setUploadState("idle");
      setUploadError(null);
      setExtractionResult(null);
      return;
    }

    if (cached.status === "extracting") {
      setUploadState("extracting");
      setUploadError(null);
      setExtractionResult(null);
      // Reconnect to in-flight promise
      cached.promise.then(
        (result) => {
          // Only apply if still the current subject's cache entry
          const current = extractionCache.get(subjectId);
          if (current && current.promise === cached.promise) {
            extractionCache.set(subjectId, { status: "review", result });
            setExtractionResult(result);
            setUploadState("review");
          }
        },
        (err) => {
          const current = extractionCache.get(subjectId);
          if (current && current.promise === cached.promise) {
            extractionCache.set(subjectId, { status: "error", error: err.message });
            setUploadError(err.message);
            setUploadState("error");
          }
        }
      );
    } else if (cached.status === "review") {
      setUploadState("review");
      setUploadError(null);
      setExtractionResult(cached.result);
    } else if (cached.status === "error") {
      setUploadState("error");
      setUploadError(cached.error);
      setExtractionResult(null);
    }
  }, [subjectId]);

  async function handleFileUpload(file) {
    if (!isAcceptedFile(file.name)) {
      setUploadError("Unsupported file type. Accepted: PDF, DOCX, TXT, CSV, MD");
      setUploadState("error");
      return;
    }

    setUploadState("extracting");
    setUploadError(null);

    const promise = (async () => {
      const text = await extractTextFromFile(file);
      const extracted = await engine.extraction.run({ text });
      const summary = buildExtractionSummary(extracted);
      return { extracted, summary, fileName: file.name };
    })();

    // Store promise in cache before awaiting
    if (subjectId) {
      extractionCache.set(subjectId, { status: "extracting", promise });
    }

    try {
      const result = await promise;
      if (subjectId) {
        extractionCache.set(subjectId, { status: "review", result });
      }
      setExtractionResult(result);
      setUploadState("review");
      notify({
        type: "extraction",
        title: "File extraction complete",
        message: result.fileName,
        link: caseId ? `/case/${caseId}/profile` : undefined,
      });
    } catch (err) {
      if (subjectId) {
        extractionCache.set(subjectId, { status: "error", error: err.message });
      }
      setUploadError(err.message);
      setUploadState("error");
    }
  }

  function applyExtraction(profile, setProfile, setAiFields, autoSave, setActiveTab) {
    if (!extractionResult) return;
    const { merged, aiFields: newAiFields } = mergeExtractedIntoProfile(
      profile,
      extractionResult.extracted
    );
    setProfile(merged);
    setAiFields(newAiFields);
    autoSave(merged);
    setUploadState("idle");
    setExtractionResult(null);
    if (subjectId) extractionCache.delete(subjectId);
    setActiveTab("identity");
  }

  function discardExtraction() {
    setUploadState("idle");
    setExtractionResult(null);
    if (subjectId) extractionCache.delete(subjectId);
  }

  function reset() {
    setUploadState("idle");
    setUploadError(null);
    setExtractionResult(null);
    if (subjectId) extractionCache.delete(subjectId);
  }

  return { uploadState, setUploadState, uploadError, extractionResult, handleFileUpload, applyExtraction, discardExtraction, reset };
}
