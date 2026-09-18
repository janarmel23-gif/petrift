import { auth, passwordStrength, validateEmail, validatePassword, validateUsername } from '../lib/auth';
import { isSupabaseConfigured } from '../lib/supabase';
import { HEROES } from '../game/data/heroes';
import { drawPetPortrait } from '../game/render/pets';

export function renderAuthView(root: HTMLElement, onAuthed: () => void) {
  root.innerHTML = `
    <div class="auth-screen">
      <canvas class="auth-bg" aria-hidden="true"></canvas>
      <div class="auth-grid">
        <section class="auth-hero">
          <div class="brand"><span class="brand-mark"></span><h1>PetRift</h1></div>
          <p class="tagline">Legends of the Menagerie</p>
          <ul class="feature-list">
            <li><b>13 pet champions</b> with four animated abilities each</li>
            <li><b>52 items</b> and 52 skins to chase across the Rift</li>
            <li><b>5v5 bot matches</b> on easy, medium or hard</li>
            <li>Plays on <b>PC, tablet and phone</b> and installs like an app</li>
          </ul>
          <div class="roster" data-roster></div>
        </section>

        <section class="auth-card">
          <div class="auth-tabs">
            <button class="active" data-tab="login">Sign in</button>
            <button data-tab="register">Create account</button>
          </div>

          <form class="auth-form" data-form="login" novalidate>
            <label>
              <span>Email</span>
              <input type="email" name="email" autocomplete="username" placeholder="you@example.com" required />
              <em class="field-error"></em>
            </label>
            <label>
              <span>Password</span>
              <div class="pw-wrap">
                <input type="password" name="password" autocomplete="current-password" placeholder="Your password" required />
                <button type="button" class="pw-toggle" aria-label="Show password">👁</button>
              </div>
              <em class="field-error"></em>
            </label>
            <div class="row between">
              <label class="checkbox"><input type="checkbox" name="remember" checked /> <span>Stay signed in</span></label>
              <button type="button" class="link" data-action="forgot">Forgot password?</button>
            </div>
            <button class="btn primary wide" type="submit">Enter the Rift</button>
          </form>

          <form class="auth-form hidden" data-form="register" novalidate>
            <label>
              <span>Summoner name</span>
              <input type="text" name="username" autocomplete="nickname" placeholder="ShadowPounce" maxlength="18" required />
              <em class="field-error"></em>
            </label>
            <label>
              <span>Email</span>
              <input type="email" name="email" autocomplete="email" placeholder="you@example.com" required />
              <em class="field-error"></em>
            </label>
            <label>
              <span>Password</span>
              <div class="pw-wrap">
                <input type="password" name="password" autocomplete="new-password" placeholder="At least 8 characters" required />
                <button type="button" class="pw-toggle" aria-label="Show password">👁</button>
              </div>
              <div class="strength"><i data-strength></i></div>
              <em class="field-error"></em>
            </label>
            <label>
              <span>Confirm password</span>
              <input type="password" name="confirm" autocomplete="new-password" placeholder="Repeat password" required />
              <em class="field-error"></em>
            </label>
            <label class="checkbox terms"><input type="checkbox" name="terms" required /> <span>I agree to play fair and be kind in chat.</span></label>
            <button class="btn primary wide" type="submit">Create account</button>
          </form>

          <div class="auth-divider"><span>or</span></div>
          <div class="auth-alt">
            <button class="btn ghost wide" data-action="guest">Play as guest on this device</button>
            <div class="social-row">
              <button class="btn ghost" data-action="google">Google</button>
              <button class="btn ghost" data-action="discord">Discord</button>
            </div>
          </div>

          <p class="auth-status" data-status></p>
          <p class="auth-note">${
            isSupabaseConfigured
              ? 'Accounts, progress and match history sync through Supabase.'
              : 'Supabase is not configured yet, so accounts stay on this device. Add your keys to .env to sync.'
          }</p>
        </section>
      </div>
    </div>
  `;

  const status = root.querySelector<HTMLElement>('[data-status]')!;
  const tabs = root.querySelectorAll<HTMLButtonElement>('.auth-tabs button');
  const forms = root.querySelectorAll<HTMLFormElement>('.auth-form');

  const setStatus = (message: string, kind: 'ok' | 'err' | 'info' = 'info') => {
    status.textContent = message;
    status.className = `auth-status ${kind}`;
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      forms.forEach((f) => f.classList.toggle('hidden', f.dataset.form !== tab.dataset.tab));
      setStatus('');
    });
  });

  root.querySelectorAll<HTMLButtonElement>('.pw-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling as HTMLInputElement;
      input.type = input.type === 'password' ? 'text' : 'password';
      btn.textContent = input.type === 'password' ? '👁' : '🙈';
    });
  });

  const registerForm = root.querySelector<HTMLFormElement>('[data-form="register"]')!;
  const strengthBar = root.querySelector<HTMLElement>('[data-strength]')!;
  registerForm.password.addEventListener('input', () => {
    const { score, label } = passwordStrength(registerForm.password.value);
    strengthBar.style.width = `${(score / 5) * 100}%`;
    strengthBar.dataset.level = String(score);
    strengthBar.title = label;
  });

  const showFieldError = (form: HTMLFormElement, name: string, message: string | null) => {
    const field = form.querySelector(`[name="${name}"]`);
    const label = field?.closest('label');
    const err = label?.querySelector<HTMLElement>('.field-error');
    if (err) err.textContent = message ?? '';
    label?.classList.toggle('invalid', Boolean(message));
  };

  const busy = (form: HTMLFormElement, on: boolean) => {
    const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    btn.disabled = on;
    btn.classList.toggle('loading', on);
  };

  const loginForm = root.querySelector<HTMLFormElement>('[data-form="login"]')!;
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (loginForm.email as HTMLInputElement).value;
    const password = (loginForm.password as HTMLInputElement).value;
    const emailError = isSupabaseConfigured ? validateEmail(email) : null;
    showFieldError(loginForm, 'email', emailError);
    showFieldError(loginForm, 'password', password.length === 0 ? 'Enter your password.' : null);
    if (emailError || password.length === 0) return;

    busy(loginForm, true);
    setStatus('Signing in...', 'info');
    const result = await auth.login(email, password);
    busy(loginForm, false);
    setStatus(result.message, result.ok ? 'ok' : 'err');
    if (result.ok) onAuthed();
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = (registerForm.username as HTMLInputElement).value;
    const email = (registerForm.email as HTMLInputElement).value;
    const password = (registerForm.password as HTMLInputElement).value;
    const confirm = (registerForm.confirm as HTMLInputElement).value;
    const terms = (registerForm.terms as HTMLInputElement).checked;

    const usernameError = validateUsername(username);
    const emailError = isSupabaseConfigured ? validateEmail(email) : null;
    const passwordError = validatePassword(password);
    const confirmError = password !== confirm ? 'Passwords do not match.' : null;

    showFieldError(registerForm, 'username', usernameError);
    showFieldError(registerForm, 'email', emailError);
    showFieldError(registerForm, 'password', passwordError);
    showFieldError(registerForm, 'confirm', confirmError);
    if (usernameError || emailError || passwordError || confirmError) return;
    if (!terms) {
      setStatus('Please accept the fair play agreement.', 'err');
      return;
    }

    busy(registerForm, true);
    setStatus('Creating your account...', 'info');
    const result = await auth.register(email, password, username);
    busy(registerForm, false);
    setStatus(result.message, result.ok ? 'ok' : 'err');
    if (result.ok && !result.needsConfirmation) onAuthed();
  });

  root.querySelector('[data-action="forgot"]')?.addEventListener('click', async () => {
    const email = (loginForm.email as HTMLInputElement).value;
    if (validateEmail(email)) {
      setStatus('Enter your email address first, then press Forgot password.', 'err');
      return;
    }
    const result = await auth.resetPassword(email);
    setStatus(result.message, result.ok ? 'ok' : 'err');
  });

  root.querySelector('[data-action="guest"]')?.addEventListener('click', async () => {
    const result = await auth.playAsGuest('Guest' + Math.floor(Math.random() * 900 + 100));
    setStatus(result.message, 'ok');
    if (result.ok) onAuthed();
  });

  root.querySelector('[data-action="google"]')?.addEventListener('click', async () => {
    const result = await auth.signInWithProvider('google');
    setStatus(result.message, result.ok ? 'info' : 'err');
  });

  root.querySelector('[data-action="discord"]')?.addEventListener('click', async () => {
    const result = await auth.signInWithProvider('discord');
    setStatus(result.message, result.ok ? 'info' : 'err');
  });

  renderRoster(root.querySelector<HTMLElement>('[data-roster]')!);
  animateBackground(root.querySelector<HTMLCanvasElement>('.auth-bg')!);
}

function renderRoster(host: HTMLElement) {
  host.innerHTML = '';
  for (const hero of HEROES.slice(0, 8)) {
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 96;
    canvas.title = `${hero.name}, ${hero.title}`;
    const ctx = canvas.getContext('2d')!;
    drawPetPortrait(ctx, hero.art, hero.skins[0], 96, Math.random() * 10);
    host.appendChild(canvas);
  }
}

function animateBackground(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const motes: Array<{ x: number; y: number; r: number; s: number; a: number }> = [];
  const resize = () => {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  };
  resize();
  window.addEventListener('resize', resize);
  for (let i = 0; i < 70; i++) {
    motes.push({
      x: Math.random(),
      y: Math.random(),
      r: 1 + Math.random() * 3,
      s: 0.006 + Math.random() * 0.02,
      a: 0.1 + Math.random() * 0.4
    });
  }
  let t = 0;
  const frame = () => {
    if (!canvas.isConnected) {
      window.removeEventListener('resize', resize);
      return;
    }
    t += 0.016;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.3, h * 0.35, 40, w * 0.4, h * 0.5, Math.max(w, h));
    g.addColorStop(0, 'rgba(38,84,150,0.55)');
    g.addColorStop(0.5, 'rgba(12,22,44,0.9)');
    g.addColorStop(1, 'rgba(4,7,14,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (const m of motes) {
      m.y -= m.s * 0.01;
      if (m.y < -0.05) m.y = 1.05;
      const x = (m.x + Math.sin(t * 0.4 + m.y * 8) * 0.01) * w;
      const y = m.y * h;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, m.r * 6);
      rg.addColorStop(0, `rgba(160,220,255,${m.a})`);
      rg.addColorStop(1, 'rgba(160,220,255,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(x, y, m.r * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(frame);
  };
  frame();
}
