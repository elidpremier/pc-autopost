'use client';

import { useState } from 'react';
import type { Settings } from '@/lib/types';

type Props = { initial: Settings };

const TEMPLATE_LIST = [
  { id: 'cyber_luxe_v2', name: 'Cyber Luxe v2 — Style PSD Ultra-Tech (Principal)' },
  { id: 'promo_banner', name: 'Bannière Promo — Spécial Offre & Remise' },
];

const COLOR_PRESETS = [
  { name: 'Violet PSD', primary: '#7C3AED', accent: '#CCFF00' },
  { name: 'Bleu Cyber', primary: '#2563EB', accent: '#00F0FF' },
  { name: 'Cyan Tech', primary: '#06B6D4', accent: '#FF0055' },
  { name: 'Vert Émeraude', primary: '#059669', accent: '#FFD700' },
  { name: 'Rouge Impact', primary: '#DC2626', accent: '#FFCC00' },
  { name: 'Ambre Gold', primary: '#D97706', accent: '#00FFFF' },
];

export default function SettingsForm({ initial }: Props) {
  const [shopName, setShopName] = useState(initial.shop_name);
  const [tagline, setTagline] = useState(initial.tagline);
  const [phone, setPhone] = useState(initial.phone);
  const [city, setCity] = useState(initial.city);
  const [currency, setCurrency] = useState(initial.currency);
  const [colorPrimary, setColorPrimary] = useState(initial.color_primary || '#7C3AED');
  const [colorAccent, setColorAccent] = useState(initial.color_accent || '#CCFF00');
  const [defaultTemplate, setDefaultTemplate] = useState(initial.default_template || 'cyber_luxe_v2');
  const [facebookPageId, setFacebookPageId] = useState(initial.facebook_page_id || '');
  const [facebookToken, setFacebookToken] = useState(initial.facebook_page_access_token || '');

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [logoTick, setLogoTick] = useState(0);
  const [hasLogo, setHasLogo] = useState(!!initial.logo_file);

  // Facebook test
  const [testingFb, setTestingFb] = useState(false);
  const [fbTestMsg, setFbTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showFbGuide, setShowFbGuide] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('shop_name', shopName);
      fd.append('tagline', tagline);
      fd.append('phone', phone);
      fd.append('city', city);
      fd.append('currency', currency);
      fd.append('color_primary', colorPrimary);
      fd.append('color_accent', colorAccent);
      fd.append('default_template', defaultTemplate);
      fd.append('facebook_page_id', facebookPageId);
      fd.append('facebook_page_access_token', facebookToken);

      if (logoFile) fd.append('logo', logoFile);
      const res = await fetch('/api/settings', { method: 'PUT', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      setMsg({ ok: true, text: 'Paramètres enregistrés ✓' });
      if (logoFile) {
        setHasLogo(true);
        setLogoFile(null);
        setLogoTick((t) => t + 1);
      }
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Erreur' });
    } finally {
      setBusy(false);
    }
  }

  async function removeLogo() {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('remove_logo', '1');
      const res = await fetch('/api/settings', { method: 'PUT', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      setHasLogo(false);
      setLogoTick((t) => t + 1);
      setMsg({ ok: true, text: 'Logo retiré' });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Erreur' });
    } finally {
      setBusy(false);
    }
  }

  async function handleTestFacebook() {
    setTestingFb(true);
    setFbTestMsg(null);
    try {
      const res = await fetch('/api/facebook/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: facebookPageId,
          accessToken: facebookToken,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFbTestMsg({ ok: false, text: data.error || 'Identifiants Facebook invalides.' });
      } else {
        setFbTestMsg({
          ok: true,
          text: `Connexion réussie avec la Page : "${data.pageName}" (ID: ${data.pageId}) ✓`,
        });
      }
    } catch (err: any) {
      setFbTestMsg({ ok: false, text: `Erreur de connexion : ${err?.message || 'Erreur réseau'}` });
    } finally {
      setTestingFb(false);
    }
  }

  return (
    <form onSubmit={save} className="card space-y-6 p-6">
      {/* 1. Informations de la Boutique */}
      <div>
        <h3 className="mb-3 text-base font-bold text-slate-900 dark:text-white">🏬 Boutique & Identité Visuelle</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Nom de la boutique</label>
            <input className="input" value={shopName} onChange={(e) => setShopName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Slogan (affiché sur le visuel)</label>
            <input className="input" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="ex: PC d'occasion certifiés & reconditionnés" />
          </div>
          <div>
            <label className="label">Téléphone / WhatsApp</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+226 70 00 00 00" />
          </div>
          <div>
            <label className="label">Ville</label>
            <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ouagadougou" />
          </div>
          <div>
            <label className="label">Devise par défaut</label>
            <input className="input" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </div>
          <div>
            <label className="label">Modèle visuel par défaut</label>
            <select className="input" value={defaultTemplate} onChange={(e) => setDefaultTemplate(e.target.value)}>
              {TEMPLATE_LIST.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:col-span-2">
            <div>
              <label className="label">Couleur principale (Titres & Thème)</label>
              <div className="flex items-center gap-2">
                <input type="color" className="input h-11 w-16 !p-1 cursor-pointer" value={colorPrimary} onChange={(e) => setColorPrimary(e.target.value)} />
                <input type="text" className="input text-xs uppercase font-mono" value={colorPrimary} onChange={(e) => setColorPrimary(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Couleur accent (Prix & Badges)</label>
              <div className="flex items-center gap-2">
                <input type="color" className="input h-11 w-16 !p-1 cursor-pointer" value={colorAccent} onChange={(e) => setColorAccent(e.target.value)} />
                <input type="text" className="input text-xs uppercase font-mono" value={colorAccent} onChange={(e) => setColorAccent(e.target.value)} />
              </div>
            </div>
            <div className="col-span-2 mt-1">
              <label className="mb-2 block text-xs font-bold text-slate-500">🎨 Thèmes de couleurs prédéfinis :</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((p) => {
                  const isSelected = colorPrimary.toUpperCase() === p.primary.toUpperCase() && colorAccent.toUpperCase() === p.accent.toUpperCase();
                  return (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => {
                        setColorPrimary(p.primary);
                        setColorAccent(p.accent);
                      }}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-500/20 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-200'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex h-3.5 w-7 items-center overflow-hidden rounded-md border border-black/20">
                        <span className="h-full w-1/2" style={{ backgroundColor: p.primary }} />
                        <span className="h-full w-1/2" style={{ backgroundColor: p.accent }} />
                      </div>
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Logo */}
      <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
        <label className="label">Logo de la boutique (PNG avec fond transparent recommandé)</label>
        <div className="flex items-center gap-4">
          {hasLogo && (
            <img key={logoTick} src={`/api/settings/logo?t=${logoTick}`} alt="Logo" className="h-14 max-w-40 rounded bg-white object-contain ring-1 ring-slate-200" />
          )}
          <label className="btn-ghost cursor-pointer">
            {logoFile ? 'Changer le logo' : 'Choisir un fichier logo'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {hasLogo && (
            <button type="button" onClick={() => void removeLogo()} disabled={busy} className="btn-danger !py-1.5 text-xs">
              Retirer
            </button>
          )}
        </div>
      </div>

      {/* 3. Intégration Facebook Graph API */}
      <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 fill-blue-600" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Publication Directe Facebook (Meta Graph API)</h3>
          </div>
          <button
            type="button"
            onClick={() => setShowFbGuide(!showFbGuide)}
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            {showFbGuide ? 'Masquer le guide pas-à-pas' : '📖 Guide pas-à-pas Meta for Developers'}
          </button>
        </div>

        {/* Guide d'installation pas-à-pas */}
        {showFbGuide && (
          <div className="my-4 rounded-xl bg-blue-50/70 p-4 text-xs text-blue-900 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-200">
            <h4 className="font-bold text-sm mb-2 text-blue-950 dark:text-blue-100">Comment obtenir votre Page ID et votre Page Access Token Facebook :</h4>
            <ol className="list-decimal space-y-2 pl-4">
              <li>
                Rendez-vous sur <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="font-bold underline text-blue-700 dark:text-blue-300">developers.facebook.com</a> et connectez-vous avec le compte administrateur de votre Page.
              </li>
              <li>
                Créez une application de type <strong>Business</strong> (ou Entreprise).
              </li>
              <li>
                Dans le menu latéral, accédez à <strong>Outils &gt; Graph API Explorer</strong>.
              </li>
              <li>
                Sélectionnez votre Application Meta et choisissez votre <strong>Page Facebook</strong> dans le sélecteur de jeton.
              </li>
              <li>
                Ajoutez les permissions suivantes : <code>pages_manage_posts</code>, <code>pages_read_engagement</code>, <code>pages_show_list</code>.
              </li>
              <li>
                Cliquez sur <strong>Generate Access Token</strong> puis copiez le jeton de la Page dans le champ ci-dessous.
              </li>
              <li>
                Trouvez le <strong>Page ID</strong> dans les paramètres à propos de votre Page Facebook.
              </li>
            </ol>
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Facebook Page ID</label>
            <input
              className="input"
              value={facebookPageId}
              onChange={(e) => setFacebookPageId(e.target.value)}
              placeholder="ex: 104829104829104"
            />
          </div>
          <div>
            <label className="label">Page Access Token (Jeton d'accès)</label>
            <input
              type="password"
              className="input"
              value={facebookToken}
              onChange={(e) => setFacebookToken(e.target.value)}
              placeholder="EAA..."
            />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={handleTestFacebook}
            disabled={testingFb || !facebookPageId || !facebookToken}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {testingFb ? 'Test en cours…' : '🔌 Tester la connexion Facebook'}
          </button>
          {fbTestMsg && (
            <span className={`text-xs font-bold ${fbTestMsg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
              {fbTestMsg.text}
            </span>
          )}
        </div>
      </div>

      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${msg.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button type="submit" disabled={busy} className="btn-primary py-3 px-6 font-bold">
          {busy ? 'Enregistrement…' : 'Enregistrer les paramètres'}
        </button>
      </div>
    </form>
  );
}
