'use client';
import React from 'react';

interface Props {
  title?: string;
  children: React.ReactNode;
}

export function SettingSection({ title, children }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 mb-4 overflow-hidden">
      {title && (
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">{title}</h2>
        </div>
      )}
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

interface FieldRowProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

export function FieldRow({ label, hint, children }: FieldRowProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      {children}
    </div>
  );
}
