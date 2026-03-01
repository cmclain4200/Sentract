import { useState } from "react";
import { extractTextFromFile, isAcceptedFile } from "../../../lib/fileExtractor";
import { buildExtractionSummary, mergeExtractedIntoProfile } from "../../../lib/profileExtractor";
import { useEngine } from "../../../engine";

export default function useFileUpload() {
  const engine = useEngine();
  const [uploadState, setUploadState] = useState("idle");
  const [uploadError, setUploadError] = useState(null);
  const [extractionResult, setExtractionResult] = useState(null);

  async function handleFileUpload(file) {
    if (!isAcceptedFile(file.name)) {
      setUploadError("Unsupported file type. Accepted: PDF, DOCX, TXT, CSV, MD");
      setUploadState("error");
      return;
    }

    setUploadState("extracting");
    setUploadError(null);

    try {
      const text = await extractTextFromFile(file);
      const extracted = await engine.extraction.run({ text });
      const summary = buildExtractionSummary(extracted);
      setExtractionResult({ extracted, summary, fileName: file.name });
      setUploadState("review");
    } catch (err) {
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
    setActiveTab("identity");
  }

  function discardExtraction() {
    setUploadState("idle");
    setExtractionResult(null);
  }

  function reset() {
    setUploadState("idle");
    setUploadError(null);
    setExtractionResult(null);
  }

  return { uploadState, setUploadState, uploadError, extractionResult, handleFileUpload, applyExtraction, discardExtraction, reset };
}
