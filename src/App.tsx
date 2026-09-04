import React from "react";

export default function App() {
  return (
    <div className="flex h-screen w-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex h-10 items-center justify-between border-b border-slate-800 bg-slate-900 px-4 text-sm font-medium">
        <div className="flex items-center space-x-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
          <span className="font-semibold tracking-wide">OpenTerm</span>
          <span className="text-xs text-slate-400">SSH & SFTP</span>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center">
        <p className="text-slate-400">Ready to connect.</p>
      </main>
    </div>
  );
}
