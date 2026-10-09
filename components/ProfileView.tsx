'use client';
import { useState } from 'react';
import { AVATARS, AVATAR_BG, NG_STATES, USERNAME_RE } from '@/shared/constants';
import { useProfile } from '@/lib/ProfileContext';
import { toast } from '@/lib/toast';
import { Avatar, BackBar, Coin, Spinner } from './ui';

function AvatarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="grid grid-cols-6 gap-2">
      {AVATARS.map((_, i) => (
        <button key={i} type="button" onClick={() => onChange(i)} aria-label={`Avatar ${i + 1}`} className={`rounded-full ${value === i ? 'ring-2 ring-waec' : ''}`}><Avatar id={i} size={42} /></button>
      ))}
    </div>
  );
}

export default function ProfileView({ onBack }: { onBack: () => void }) {
  const { profile, mode, claimName, saveProfile, login, logout } = useProfile();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [avatar, setAvatar] = useState<number | null>(null);
  const [school, setSchool] = useState('');
  const [state, setState] = useState('');
  const [agree, setAgree] = useState(false);
  const [signin, setSignin] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!profile) return <Spinner />;
  const av = avatar ?? profile.avatar;

  const create = async () => {
    if (!USERNAME_RE.test(username)) return toast('Username: 3-15 letters, numbers or _', 'bad');
    if (mode === 'online' && !/^\d{4,6}$/.test(pin)) return toast('Choose a 4-6 digit PIN', 'bad');
    if (!agree) return toast('Please tick the box to continue', 'bad');
    setBusy(true);
    const ok = await claimName({ username, pin, avatar: av, school: school || undefined, state: state || undefined, agree });
    setBusy(false);
    if (ok) toast('Profile saved', 'good');
  };
  const doLogin = async () => {
    setBusy(true);
    const ok = await login(username, pin);
    setBusy(false);
    if (ok) { toast('Welcome back!', 'good'); setSignin(false); }
  };

  return (
    <main className="notebook mx-auto flex min-h-[100dvh] max-w-md flex-col gap-4 px-4 py-5">
      <BackBar title="Profile" onBack={onBack} />

      {profile.guest ? (
        <section className="paper space-y-3">
          <h2 className="font-display text-xl font-semibold uppercase tracking-wide">{signin ? 'Sign in' : 'Save your progress'}</h2>
          {!signin && <p className="font-semibold text-black/70">Pick a name so your coins, pens and wins are saved. No phone number or email needed.</p>}
          <div><label className="label">Username</label><input className="input" value={username} maxLength={15} autoCapitalize="none" onChange={(e) => setUsername(e.target.value)} placeholder="e.g. Oga_Flick" /></div>
          {(mode === 'online' || signin) && <div><label className="label">{signin ? 'PIN' : 'Secret PIN (4-6 digits, to sign in on other phones)'}</label><input className="input" inputMode="numeric" type="password" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} /></div>}
          {!signin && (
            <>
              <div><label className="label">Avatar</label><AvatarPicker value={av} onChange={setAvatar} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label">School (optional)</label><input className="input" value={school} maxLength={60} onChange={(e) => setSchool(e.target.value)} /></div>
                <div><label className="label">State (optional)</label><select className="input" value={state} onChange={(e) => setState(e.target.value)}><option value="">-</option>{NG_STATES.map((s) => <option key={s}>{s}</option>)}</select></div>
              </div>
              <label className="flex items-start gap-2 text-sm font-bold"><input type="checkbox" className="mt-1 h-5 w-5" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>I am 13 or older and accept the <a className="underline" href="/terms" target="_blank">Terms</a> &amp; <a className="underline" href="/privacy" target="_blank">Privacy Policy</a>.</span></label>
            </>
          )}
          <button className="btn btn-yellow w-full" disabled={busy} onClick={signin ? doLogin : create}>{signin ? 'Sign in' : 'Create profile'}</button>
          {mode === 'online' && <button className="w-full text-center text-sm font-bold underline" onClick={() => setSignin(!signin)}>{signin ? 'New here? Create a profile' : 'Already have a profile? Sign in'}</button>}
        </section>
      ) : (
        <>
          <section className="paper flex items-center gap-3">
            <Avatar id={profile.avatar} size={64} />
            <div className="flex-1"><p className="font-display text-2xl font-semibold uppercase leading-none tracking-wide">{profile.username}</p><p className="text-sm font-semibold text-black/60">{[profile.school, profile.state].filter(Boolean).join(' · ') || 'Naija'}</p></div>
          </section>
          <section className="grid grid-cols-3 gap-2 text-center">
            {[['Wins', profile.wins], ['Losses', profile.losses], ['Heavy hits', profile.heavyMoves]].map(([l, v]) => (
              <div key={l as string} className="paper !p-2"><p className="font-display text-2xl font-bold leading-none">{v}</p><p className="text-xs font-extrabold text-black/60">{l}</p></div>
            ))}
          </section>
          <section className="paper space-y-3">
            <h2 className="font-display text-lg font-semibold uppercase tracking-wide">Edit</h2>
            <AvatarPicker value={av} onChange={setAvatar} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="School" defaultValue={profile.school ?? ''} maxLength={60} onChange={(e) => setSchool(e.target.value)} />
              <select className="input" defaultValue={profile.state ?? ''} onChange={(e) => setState(e.target.value)}><option value="">State</option>{NG_STATES.map((s) => <option key={s}>{s}</option>)}</select>
            </div>
            <button className="btn btn-green w-full" onClick={() => saveProfile({ avatar: av, school: school || profile.school, state: state || profile.state }).then(() => toast('Saved', 'good'))}>Save</button>
          </section>
          {profile.history.length > 0 && (
            <section className="paper space-y-2">
              <h2 className="font-display text-lg font-semibold uppercase tracking-wide">Recent matches</h2>
              {profile.history.map((h) => (
                <div key={h.id} className="flex items-center gap-2 text-sm font-bold">
                  <span className={`tag ${h.won ? '!bg-[#cfe3d3]' : '!bg-[#e8c4be]'}`}>{h.won ? 'WIN' : 'LOSS'}</span>
                  <span className="flex-1">vs {h.opponent}</span><span>{h.myScore}-{h.theirScore}</span><span className="flex items-center gap-1"><Coin /> {h.coins}</span>
                </div>
              ))}
            </section>
          )}
          {mode === 'online' && <button className="btn btn-white" onClick={() => logout()}>Sign out</button>}
        </>
      )}
    </main>
  );
}
