interface ConnectWalletProps {
  onConnect: () => void;
  error: string;
}

export function ConnectWallet({ onConnect, error }: ConnectWalletProps) {
  return (
    <div className="flex h-screen bg-[#06060a] text-gray-100 items-center justify-center">
      <div className="app-bg" />

      <div className="relative z-10 max-w-xs w-full mx-auto px-6 flex flex-col items-center text-center gap-8">

        {/* Ghost image + Wordmark */}
        <div className="flex flex-col items-center gap-4">
          <img
            src="/ghost-connect.png"
            alt="GhostScore"
            className="w-[120px] h-[120px] object-contain"
          />
          <h1 className="text-[22px] font-bold text-white tracking-tight leading-tight">
            GhostScore
          </h1>
          <p className="text-[11px] text-gray-500 tracking-widest uppercase">
            Private Agent Reputation
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={onConnect}
          className="w-full py-4 rounded-xl text-[13px] font-bold tracking-[0.12em] uppercase bg-gradient-to-r from-emerald-600 to-emerald-400 hover:from-emerald-500 hover:to-emerald-300 text-black shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all duration-200"
        >
          Connect Wallet
        </button>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-[13px] leading-relaxed -mt-3">{error}</p>
        )}
      </div>
    </div>
  );
}
