'use client';
import React from 'react';

interface Props {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingsPageShell({ title, description, children }: Props) {
  return (
    <div className="max-w-2xl mx-auto pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">{title}</h1>
        {description && (
          <p className="text-sm text-slate-500 mt-1">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}
