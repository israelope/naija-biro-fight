export default function Privacy() {
  return (
    <main className="notebook mx-auto min-h-screen max-w-2xl p-6 text-white">
      <h1 className="font-display text-4xl">Privacy Policy</h1>
      <p className="mt-2 text-sm text-white/70">TEMPLATE: have a lawyer review this (NDPA 2023 applies in Nigeria) before launch.</p>
      <div className="mt-4 space-y-3 leading-relaxed">
        <p>We collect only what the game needs: a username, an avatar, an optional school and state, your coins, items, and match history. We do not ask for your phone number or email.</p>
        <p>Your PIN is stored only as a salted hash. A cookie keeps you signed in on this device.</p>
        <p>If analytics is enabled we record anonymous usage events to improve the game.</p>
        <p>To delete your data, contact [your email] with your username.</p>
      </div>
      <a href="/" className="btn btn-yellow mt-6">Back to game</a>
    </main>
  );
}
