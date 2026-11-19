import React from 'react';
import { Database } from 'lucide-react';

interface DbmsBadgeProps {
  fr: string;
  queryType: string;
  procedure: string;
  topic?: string;
}

export function DbmsBadge({
  fr,
  queryType,
  procedure,
  topic,
}: DbmsBadgeProps) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50/80 px-2.5 py-1 text-xs font-medium text-indigo-900">
      <Database className="h-3.5 w-3.5 text-indigo-600" />
      <span className="font-bold text-indigo-700">{fr}</span>
      <span className="text-indigo-300">|</span>
      <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-800">
        Query {queryType}
      </span>
      <span className="text-indigo-300">|</span>
      <code className="font-mono text-[11px] text-slate-700">{procedure}</code>
      {topic && (
        <>
          <span className="text-indigo-300">|</span>
          <span className="text-[11px] text-slate-600">{topic}</span>
        </>
      )}
    </div>
  );
}
