# Splash Animation ChrisRoi Agence — Spécification Ultra-Détaillée V4
> Document de référence pour l'animation de lancement (splash screen).
> Version: V4 refaite de zéro — 01/09/2026 — Validée avec le client.

---

## 1. Objectif

Créer une **version animée fidèle de `LOGO_SOURCE_VISUALISER.png`** pour le splash screen de l'app Expo (iOS/Android). L'image statique est la référence visuelle exacte ; l'animation doit la faire vivre sans la dénaturer.

- Fond crème identique à l'image source.
- 2 vagues d'angle qui **ondulent** (pas un simple aller-retour).
- Losange or **fixe** dont **seule la lumière pulse**.
- Texte **"Chrisroi Agence" unique** qui **luise** d'une lumière dorée traversante.
- Rendu **haut de gamme, 60fps, vectoriel pur**, sans artefact CSS ni duplication.

Fichier de référence visuelle :
```
C:\Users\BROU WILLIAMS\Downloads\chrisroi-agence\mockups\LOGO_SOURCE_VISUALISER.png (2000x2000)
```

Maquette de validation V4 (animé à gauche / statique à droite) :
```
C:\Users\BROU WILLIAMS\Downloads\chrisroi-agence\chrisroi-agence\mockups\splash_wave_animation_v4.html
```

---

## 2. Analyse de l'image source

### 2.1 Fond
- Couleur dominante: **#faf1e8** (crème rosé clair, ~39.5% des pixels au centre) — variante #faf0e9 / #f9f0e8 tolérée.
- Uni, sans dégradé, sans texture.

### 2.2 Formes d'angle (vagues)
- **2 formes** : haut-gauche (TL) et bas-droite (BR), symétriques en S.
- Remplissage: terracotta **#cc6641 → #b4532a** en dégradé diagonal (linearGradient x1 0 y1 0 → x2 1 y2 1).
- Liseré: trait or **#c9a86a → #f4d585**, épaisseur 1.6px, `stroke-linecap: round`, opacité 0.95, second trait blanc à 0.35 plus fin en maquette initiale (supprimé en V4 pour sobriété).
- Forme : S courbe, pas un triangle. Points de contrôle :
  - TL : `M0 0 H390 V42 C 262 64, 148 108, 72 182 C 34 218, 14 248, 0 286 Z`
  - BR : `M390 780 H0 V738 C 128 716, 242 672, 318 598 C 356 558, 376 528, 390 494 Z`

### 2.3 Centre — Monogramme CA
- Grand **C** (courbe épaisse #c45a2a / #ca673f) en arrière-plan, grand **A** par-dessus même couleur, petit **C** et petit **A** imbriqués (#e87a4a plus clair).
- Losange/diamant or **#c9a86a → #f4d585** sous le CA, taille 22px (diagonale), rotation 45°.
- **Aucun texte dans le monogramme** — le texte est séparé en dessous.
- Asset utilisé : `mockups/monogram_ca_only.png` (crop 1000×800 depuis source, `500,500 → 1500,1300`, LANCZOS) — **ne contient PAS "Chrisroi Agence"**.
  - À NE PAS utiliser : `monogram_center_crop.png` (1300×1400, contient "Chrisroi Agence" coupé, cause duplication 2×).

### 2.4 Typographie
- **"Chrisroi Agence"** : serif **Cormorant Garamond 400/500**, 36px, couleur de base **#3d1e0a** (brun foncé), `text-anchor: middle`, centré à `translate(195,590)`, letter-spacing 0.4.
- Sous-texte : **"L'EXCELLENCE À VOTRE SERVICE"** : sans-serif **Plus Jakarta Sans 600**, 9px, tracking **3.6**, couleur **#8a7a6a**, à y+24 sous le titre.
- Le texte source dans l'image est en #3d1e0a / #471416, même famille Cormorant.

---

## 3. Animation — Exigences fonctionnelles

### 3.1 Vagues d'angle — Ondulation VIVE et fluide

**Interdit** : 
- Simple `translate(x,y)` ou `scale` du conteneur SVG (effet "vas-et-viens" recalé en V2).
- Amplitude < 5px (trop subtile, "pas en vagues, pas d'ondulation").

**Exigé** :
- **Morph réel des paths `d`** (attribut `d` du `<path>`) via GSAP — la courbe S elle-même se déforme.
- **3 états** distincts en boucle continue, pas un aller-retour 2 états :
  1. **Baseline** (repos) : TL V42 / BR V738 (voir §2.2)
  2. **Creux** (vague rentre, -14px) : TL V28 / BR V752
     - TL creux : `M0 0 H390 V28 C 270 46, 156 82, 80 152 C 38 188, 16 218, 0 250 Z`
     - Liseré creux : `M0 258 C 16 222, 38 192, 80 156 C 156 86, 270 50, 390 32`
     - BR creux : `M390 780 H0 V752 C 136 732, 250 690, 328 620 C 364 580, 382 548, 390 514 Z`
     - Liseré BR creux : `M390 508 C 382 542, 364 574, 328 614 C 250 684, 136 726, 0 746`
  3. **Gonflé** (vague sort, +16px, **plus vive**) : TL V58 / BR V722
     - TL gonflé : `M0 0 H390 V58 C 254 82, 140 132, 64 212 C 30 248, 10 278, 0 322 Z`
     - Liseré gonflé : `M0 330 C 10 282, 30 252, 64 216 C 140 136, 254 86, 390 62`
     - BR gonflé : `M390 780 H0 V722 C 120 700, 234 652, 310 576 C 350 536, 372 506, 390 472 Z`
     - Liseré BR gonflé : `M390 466 C 372 500, 350 530, 310 570 C 234 646, 120 694, 0 716`
- **Timings désynchronisés** : TL 2.2s / BR 2.4s, `ease: "sine.inOut"`, enchaînés en `gsap.timeline({repeat:-1})` : 0s → 2.2s (creux) → 4.4s (gonflé) → 6.6s (retour baseline) = cycle ~6.6s total, mais BR décalé de 0.2s pour éviter synchronisation mécanique.
- **Amplitude perçue** : ~16–20px de débattement vertical sur l'apex de la courbe (V28 → V58 = 30px de différence sur V), liseré suit exactement le même morph avec même duration.
- **60fps** : animation sur attribut `d` uniquement, pas de layout thrashing. GSAP gère l'interpolation.

### 3.2 Losange — Seule la lumière pulse

**Clarification client (01/09)** : "la pulsation c'est la lumiere pas le losange lui meme, le losange brille, c'est tout"

**Interdit** :
- `scale` sur le losange lui-même (V2/V3 faisaient `scale 1→1.18`, recalé "comportement étrange").
- Changement de `fill` du losange.

**Exigé** :
- Losange **fixe** : `<rect x="-11" y="-11" width="22" height="22" transform="rotate(45)" fill="url(#gold)"/>` à `translate(195,430)`, **aucune animation** sur ce nœud.
- Lumière séparée **derrière** : `<g id="diamondGlow" opacity="0.12" transform="translate(195,430)"><rect x="-22" y="-22" width="44" height="44" transform="rotate(45)" fill="#f4d585" filter="url(#glow)"/></g>`
  - Filtre : `feGaussianBlur stdDeviation="9"` + `feColorMatrix` warm (1, 0.85, 0.52).
  - Animation **unique** : `gsap.to('#diamondGlow', {duration:1.4, opacity:0.88, ease:"sine.inOut", repeat:-1, yoyo:true})`
  - Pas de `scale` sur le losange ; le glow peut optionnellement `scale` 1→1.05 mais en V4 on ne scale que l'opacity pour rester fidèle à "juste la lumière".
- Couleur lumière : #f4d585 vive au pic, #c9a86a au repos (via le fill du glow).

### 3.3 Texte "Chrisroi Agence" — Luise tout le long

**Exigé** :
- **Un seul** "Chrisroi Agence" (pas de doublon image + SVG — bug V3).
- Effet **shimmer traversant de gauche à droite**, pas un fade global, pas un clignotement.
- Technique SVG : `linearGradient` avec 6 stops sur le `fill` du `<text>` :
  ```
  <linearGradient id="shimmer" gradientUnits="objectBoundingBox">
    <stop 0% #3d1e0a/><stop 38% #3d1e0a/><stop 50% #f4d585/><stop 53% #cc6641/><stop 62% #3d1e0a/><stop 100% #3d1e0a/>
  </linearGradient>
  ```
  - Au repos : gradient centré, texte apparaît #3d1e0a.
  - Animation : `gsap.set(grad, {attr:{gradientTransform:"translate(-90 0)"}})` puis `gsap.to(grad, {duration:2.8, attr:{gradientTransform:"translate(120 0)"}, ease:"none", repeat:-1, repeatDelay:0.5})`
  - La bande dorée (#f4d585 50% → #cc6641 53%) traverse le mot en 2.8s, pause 0.5s, boucle.
- Texte à `translate(195,590)` dans viewBox 390×780, bien dans le viewport (pas coupé — bug V2/V3 où y était trop bas ou image trop grande).
- Sous-texte "L'EXCELLENCE..." **sans shimmer**, couleur fixe #8a7a6a.

---

## 4. Mise en page — Phone frame

- Container `.phone` : `width:100%; max-width:390px; aspect-ratio:390/780; border-radius:36px; overflow:hidden; background:#faf1e8; box-shadow:0 20px 60px rgba(0,0,0,.55)`
- SVG : `viewBox="0 0 390 780" preserveAspectRatio="xMidYMid slice"` — couvre tout le phone.
- Monogramme : `<image href="monogram_ca_only.png" x="45" y="242" width="300" height="240" preserveAspectRatio="xMidYMid meet"/>` — centrée horizontalement, au-dessus du losange (y 242 + 120 centre = 362, losange à 430 = 68px en dessous).
- Maquette de validation : 2 colonnes `.stage {grid-template-columns:1fr 1fr}` — animé à gauche, statique à droite, fond page #0d0a09, cards #16100c avec border rgba(201,168,106,.12).
- Boutons : Rejouer (`gsap.globalTimeline.play()`) / Pause (`gsap.globalTimeline.pause()`).

---

## 5. Spécification technique — Implémentation

### 5.1 Maquette HTML (validation client)
- **Stack** : HTML + SVG pur + GSAP 3.12.5 CDN (`https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js`) — pas de CSS keyframes brouillon.
- **Fichier** : `mockups/splash_wave_animation_v4.html` (9659 bytes, vectoriel pur, 60fps).
- **Dépendances** : Google Fonts Cormorant Garamond + Plus Jakarta Sans.

### 5.2 Portage React Native (après validation V4)
- **Vagues + losange glow** : `react-native-reanimated` 3.x — `useSharedValue` + `withRepeat(withTiming(..., {duration: 2200, easing: Easing.inOut(Easing.sin)}), -1, true)` pour le morph. Les paths SVG seront rendus via `react-native-svg` (même `d` que la maquette). Alternative si morph trop coûteux : extraire 3 paths et interpoler via `interpolatePath` (mais GSAP le fait déjà à 60fps sur RN avec Reanimated).
- **Shimmer texte** : `expo-linear-gradient` + `@react-native-masked-view/masked-view` — Masquer le texte, animer `translateX` du gradient (même gradient que §3.3, width 200%, `Animated.timing` 2800ms linear, loop).
- **Durée splash** : 1.8–2.2s puis `fadeOut` 400ms vers app (navigation). Ne pas bloquer plus de 2.5s.
- **Sans Skia** — volontairement, pour rester léger (Reanimated + SVG suffisent, Skia était envisagé en V2 puis abandonné).
- **Assets** : `assets/icon.png` / `assets/splash-icon.png` (1024×1024, 911K, fond crème #faf1e8 intégré, pas de adaptiveIcon) — déjà committés `e035539`.

### 5.3 Fichiers impactés
```
mockups/LOGO_SOURCE_VISUALISER.png      — source 2000px (référence)
mockups/monogram_ca_only.png            — crop CA seul 1000×800 (utilisé)
mockups/monogram_center_crop.png        — OBSOLÈTE (contient texte, ne plus utiliser)
mockups/splash_wave_animation_v4.html   — maquette V4 (référence validée)
assets/icon.png / splash-icon.png       — icônes haute-rés 1024 (commit e035539)
app.json                                — icon: ./assets/icon.png, splash background #0d0a09, sans adaptiveIcon
components/SplashAnimated.tsx (à créer) — portage RN de la V4
```

---

## 6. Historique des erreurs à ne pas reproduire

| Version | Problème | Cause | Correctif V4 |
|---------|----------|-------|--------------|
| V1 `splash_wave_animation.html` | CSS brouillon, anim cassée | `transform: translate` sur div, pas de SVG morph | SVG pur + GSAP |
| V2 `splash_wave_animation_v2.html` | Vas-et-viens pas ondulation, losange "comportement étrange", lettres coupées | amplitude 3px, losange scale+fill qui saute, image 1300×1400 trop grande à y220 | 3 états vifs +16px, losange fixe, CA seul 300×240 à y242 |
| V3 `splash_wave_animation_v3.html` | 2× "Chrisroi Agence" superposés, lettres encore coupées | `monogram_center_crop.png` contient déjà le texte | Passage à `monogram_ca_only.png` |
| V3 aussi | Losange pulsait (scale 1→1.18) | Glow et losange confondus | Séparation glow / losange, seul glow pulse |

---

## 7. Critères de validation client

- [ ] Vagues TL/BR ondulent visiblement (gonflent/creusent, pas juste glissent).
- [ ] Amplitude jugée "vive" (client a demandé explicitement plus vive que V3).
- [ ] Losange ne bouge pas, seule une lueur dorée pulse doucement (1.4s, sans saccade).
- [ ] Un seul "Chrisroi Agence", bien centré, non coupé, qui luise de gauche à droite en continu.
- [ ] Aucun vas-et-viens mécanique, aucune duplication, aucune coupe de lettre.
- [ ] 60fps fluide sur mobile (test Expo Go, iOS + Android).

Une fois coché, portage à l'identique en RN Reanimated avec mêmes durées/easings.

---

## 8. Annexes — Codes couleurs

```
Fond           #faf1e8
Terracotta     #cc6641 → #b4532a (dégradé vagues)
Or clair       #c9a86a
Or vif         #f4d585 (pic shimmer + glow)
Brun texte     #3d1e0a
Gris sous-texte #8a7a6a
Fond page      #0d0a09 (autour du phone)
Card           #16100c
```

*Document généré le 01/09/2026 — à committer avec la V4.*
