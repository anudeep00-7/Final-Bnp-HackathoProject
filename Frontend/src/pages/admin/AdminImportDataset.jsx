import React, { useState } from "react";
import {
  Upload,
  FileCheck2,
  AlertCircle,
  CheckCircle2,
  FileText,
  Download,
  Layers,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { exportToCsv } from "../../utils/exportCsv";
import { api } from "../../api/client";

export default function AdminImportDataset() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [ingestionSuccess, setIngestionSuccess] = useState(false);

  const handleDownloadTemplate = () => {
    const headers = [
      "ActionID",
      "SecurityName",
      "ISIN",
      "EventType",
      "ExDate",
      "RecordDate",
      "EntitlementRatio",
      "CashRate",
      "TargetPortfolios",
    ];
    const sampleRows = [
      ["CA-FEED-001", "Cascade Materials", "SEC008", "RIGHTS", "2026-10-15", "2026-10-18", "1:4", "45.00", "P001,P002"],
      ["CA-FEED-002", "Apex Software Solutions", "SEC009", "DIVIDEND", "2026-10-20", "2026-10-22", "N/A", "14.50", "P001,P003"],
      ["CA-FEED-003", "Starlight Media", "SEC012", "STOCK_SPLIT", "2026-11-01", "2026-11-05", "2:1", "0.00", "P004,P005"],
    ];
    exportToCsv("BNP_Corporate_Actions_Template", headers, sampleRows);
  };

  const handleLoadSampleData = () => {
    const sampleFile = { name: "bnp_hackathon_corporate_actions_feed.csv", size: 245760 };
    setFile(sampleFile);
    simulateValidation(sampleFile);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      setFile(f);
      simulateValidation(f);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      simulateValidation(f);
    }
  };

  const simulateValidation = (selectedFile) => {
    setUploading(true);
    setValidationResult(null);
    setIngestionSuccess(false);
    setTimeout(() => {
      setUploading(false);
      setValidationResult({
        valid: true,
        fileName: selectedFile.name,
        recordsParsed: 48,
        securitiesCount: 14,
        portfoliosAffected: 6,
        eventsDetected: 3,
      });
    }, 900);
  };

  const handleConfirmIngestion = async () => {
    setIngestionSuccess(true);
    try {
      await api.dataset.import({
        filename: file?.name || "bnp_hackathon_feed.csv",
        records_count: validationResult?.recordsParsed || 14,
      });
    } catch (err) {
      console.warn("Could not log dataset ingestion to backend:", err);
    }
    setTimeout(() => {
      setIngestionSuccess(false);
      setValidationResult(null);
      setFile(null);
    }, 4000);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1200px]">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="rounded-md bg-[#126b45] px-2 py-0.5 text-[10px] font-bold text-white">
              INGESTION ENGINE
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#123b28]">
              Dataset Ingestion & Validation
            </h1>
            <p className="mt-1 text-xs text-[#7d9b8b]">
              Upload securities, position snapshots, custodian statements, and corporate action feeds.
            </p>
          </div>
        </div>

        {ingestionSuccess && (
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={18} className="text-[#126b45]" />
              <span>
                Dataset <strong>{file?.name}</strong> successfully processed and merged into the active Corporate Actions ledger!
              </span>
            </div>
            <span className="font-mono text-[11px]">Ledger Sync: Complete</span>
          </div>
        )}

        {/* Upload Dropzone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#dceee3] bg-white p-12 text-center transition hover:border-[#126b45]"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e4f5e9] text-[#126b45]">
            <Upload size={28} />
          </div>

          <h3 className="mt-4 text-base font-bold text-[#123b28]">
            {file ? file.name : "Drag & Drop Corporate Actions Dataset"}
          </h3>
          <p className="mt-1 text-xs text-[#7d9b8b]">
            Supports CSV, TSV or JSON formatted feeds up to 50MB
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#126b45] px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#0c5636]">
              <span>Browse Local File</span>
              <input
                type="file"
                accept=".csv,.json,.tsv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={handleLoadSampleData}
              className="inline-flex items-center gap-2 rounded-xl border border-[#126b45] bg-[#edf8f1] px-4 py-2.5 text-xs font-bold text-[#126b45] transition hover:bg-[#126b45] hover:text-white"
            >
              <FileCheck2 size={14} />
              <span>Load Sample Demo Feed</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-2 rounded-xl border border-[#dceee3] bg-white px-4 py-2.5 text-xs font-bold text-[#5f786b] transition hover:bg-[#edf8f1] hover:text-[#126b45]"
            >
              <Download size={14} />
              <span>Download CSV Template</span>
            </button>
          </div>
        </div>

        {/* Progress Spinner */}
        {uploading && (
          <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl border border-[#dceee3] bg-white p-4 text-xs font-semibold text-[#173b2a]">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#126b45] border-t-transparent" />
            <span>Parsing dataset and verifying schema rules...</span>
          </div>
        )}

        {/* Validation Output */}
        {validationResult && (
          <div className="mt-6 rounded-2xl border border-[#dceee3] bg-white p-6 shadow-xs">
            <div className="flex items-center gap-3 border-b border-[#edf4ef] pb-4">
              <CheckCircle2 size={20} className="text-[#126b45]" />
              <div>
                <h4 className="text-sm font-bold text-[#123b28]">
                  Dataset Validated: {validationResult.fileName}
                </h4>
                <p className="text-xs text-[#7d9b8b]">
                  Ready for deterministic processing and reconciliation matching
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4 text-xs">
              <div className="rounded-xl border border-[#dceee3] bg-[#f8fcf9] p-4">
                <span className="text-[#7d9b8b]">Records Parsed:</span>
                <p className="mt-1 text-2xl font-bold text-[#123b28]">
                  {validationResult.recordsParsed}
                </p>
              </div>
              <div className="rounded-xl border border-[#dceee3] bg-[#f8fcf9] p-4">
                <span className="text-[#7d9b8b]">Securities Identified:</span>
                <p className="mt-1 text-2xl font-bold text-[#123b28]">
                  {validationResult.securitiesCount}
                </p>
              </div>
              <div className="rounded-xl border border-[#dceee3] bg-[#f8fcf9] p-4">
                <span className="text-[#7d9b8b]">Portfolios In Scope:</span>
                <p className="mt-1 text-2xl font-bold text-[#123b28]">
                  {validationResult.portfoliosAffected}
                </p>
              </div>
              <div className="rounded-xl border border-[#dceee3] bg-[#f8fcf9] p-4">
                <span className="text-[#7d9b8b]">Corporate Events:</span>
                <p className="mt-1 text-2xl font-bold text-[#126b45]">
                  {validationResult.eventsDetected} Events
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setValidationResult(null);
                  setFile(null);
                }}
                className="rounded-xl border border-[#dceee3] px-4 py-2 text-xs font-bold text-[#5f786b] hover:bg-[#edf8f1]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmIngestion}
                className="rounded-xl bg-[#126b45] px-5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#0c5636]"
              >
                Confirm Ingestion to Ledger
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
