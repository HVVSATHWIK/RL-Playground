import { useState, useRef } from 'react';
import { Download, Upload, Database, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import { useFightStore } from '../stores/fightStore';

export function ModelVault() {
  const { exportDQNModel, importDQNModel, loadPresetDQN } = useFightStore();
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    try {
      const jsonStr = exportDQNModel();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `robo-dojo-dqn-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMessage({ text: 'Model weights exported successfully as JSON.', isError: false });
    } catch (err: any) {
      setStatusMessage({ text: `Export failed: ${err.message}`, isError: true });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const res = importDQNModel(content);
        if (res.success) {
          setStatusMessage({ text: `Successfully loaded model from ${file.name}!`, isError: false });
        } else {
          setStatusMessage({ text: res.error || 'Failed to import model.', isError: true });
        }
      } catch (err: any) {
        setStatusMessage({ text: `Error reading file: ${err.message}`, isError: true });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-3 text-slate-800">
      {/* Header */}
      <div className="border-b border-blue-100 pb-2">
        <h2 className="text-sm font-bold text-blue-950 tracking-wide uppercase flex items-center gap-2">
          <Database className="text-blue-600" size={16} />
          Agent Vault & Model Presets
        </h2>
        <p className="text-[11px] text-slate-500">Export, import, and test neural network policies</p>
      </div>

      {/* Export & Import Actions */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleExport}
          className="flex items-center justify-center gap-1.5 p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
        >
          <Download size={14} /> Export Weights
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-1.5 p-2.5 bg-white hover:bg-slate-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-colors shadow-2xs"
        >
          <Upload size={14} /> Import Model
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
      </div>

      {/* Status Notice */}
      {statusMessage && (
        <div
          className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
            statusMessage.isError
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {statusMessage.isError ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Built-in Preset Model Archetypes */}
      <div className="bg-white border border-blue-100 rounded-xl p-3 space-y-2 shadow-2xs">
        <div className="flex items-center justify-between text-xs font-bold text-blue-950 border-b border-blue-50 pb-1.5">
          <span className="flex items-center gap-1.5">
            <Layers size={13} className="text-blue-600" />
            Archetype Presets
          </span>
          <span className="text-[10px] text-blue-600 font-mono font-medium">Pre-Trained</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: 'balanced' as const, label: 'Balanced', sub: 'Adaptive' },
            { id: 'aggressive' as const, label: 'Aggressive', sub: 'High Pressure' },
            { id: 'defensive' as const, label: 'Defensive', sub: 'Counter Guard' },
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                loadPresetDQN(preset.id);
                setStatusMessage({
                  text: `Loaded "${preset.label}" archetype policy with pre-trained weights.`,
                  isError: false,
                });
              }}
              className="p-2 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg text-center transition-all"
            >
              <div className="text-[11px] font-bold text-blue-950">{preset.label}</div>
              <div className="text-[9px] text-slate-500">{preset.sub}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
