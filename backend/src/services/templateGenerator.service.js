/**
 * Template Generator Service
 * Generates complete HTML landing pages from layer assets
 * Supports: wheel, boxes mechanics with full CSS animations
 *
 * Based on real landing archives: 585, 684, 688, 691
 */

import { log } from '../utils/logger.js';

/**
 * Default configuration for landings
 */
const DEFAULT_CONFIG = {
  offerUrl: 'https://your-offer-url.com',
  currency: '$',
  prizeAmount: '1500',
  buttonText: 'SPIN',
  claimButtonText: 'CLAIM PRIZE',
  title: 'Spin & Win',
  subtitle: 'Register and claim your prize!',
  winSector: 1,
  useSound: true,
  enableProtection: true,
  lang: 'en',
  themeColor: '#000536',
  primaryColor: '#FFD700',
  secondaryColor: '#FF6600',
  redirectDelay: 3000,
  showEffects: true
};

/**
 * CSS animations for wheel mechanic (from real landings 585, 688, 691)
 */
const WHEEL_ANIMATIONS = `
    /* Spin animations for 8 sectors */
    @keyframes spinTo1{0%{transform:rotate(-44deg)}to{transform:rotate(1080deg)}}
    @keyframes spinTo2{0%{transform:rotate(-4deg)}to{transform:rotate(1396deg)}}
    @keyframes spinTo3{0%{transform:rotate(-4deg)}to{transform:rotate(1351deg)}}
    @keyframes spinTo4{0%{transform:rotate(-4deg)}to{transform:rotate(1305deg)}}
    @keyframes spinTo5{0%{transform:rotate(-4deg)}to{transform:rotate(1261deg)}}
    @keyframes spinTo6{0%{transform:rotate(-4deg)}to{transform:rotate(1217deg)}}
    @keyframes spinTo7{0%{transform:rotate(-4deg)}to{transform:rotate(1531deg)}}
    @keyframes spinTo8{0%{transform:rotate(-4deg)}to{transform:rotate(1485deg)}}

    /* Win state animation */
    @keyframes spinner-win{0%,to{transform:rotate(1080deg)}50%{transform:rotate(1085deg)}}

    /* Logo scale animation */
    @keyframes scaleLogo{0%,to{transform:scale(.9)}50%{transform:scale(1)}}

    /* Idle wheel wobble */
    @keyframes spinWheel{0%,to{transform:rotate(-40deg)}50%{transform:rotate(-52deg)}}

    /* Effect ring scaling */
    @keyframes scaleRing1{0%,to{opacity:1;transform:scale(1.8)}50%{opacity:1;transform:scale(3.8)}}
    @keyframes scaleRing2{0%,to{opacity:1;transform:scale(1.3)}50%{opacity:1;transform:scale(2.3)}}
    @keyframes scaleRing3{0%,to{opacity:1;transform:scale(1.3)}50%{opacity:1;transform:scale(2.3)}}

    /* Button pulse */
    @keyframes pulseButton{0%,65%,to{transform:rotate(-4deg)}15%,50%{transform:rotate(4deg)}}

    /* Character movement */
    @keyframes movePerson{0%,to{transform:translate(0,0)}50%{transform:translate(-5em,-5em)}}
    @keyframes movePersonCoin{0%,to{transform:translateY(0);filter:drop-shadow(0 0 0 #ffc014)}50%{transform:translateY(-5em);filter:drop-shadow(0 0 20px #ffc014)}}

    /* Decorative images movement */
    @keyframes moveImagesRight{0%,65%,to{transform:rotate(0deg) scale(1)}15%,50%{transform:rotate(-35deg) scale(1.1)}}
    @keyframes moveImagesLeft{0%,65%,to{transform:rotate(0deg) scale(1)}15%,50%{transform:rotate(35deg) scale(1.1)}}

    /* Modal background rotation */
    @keyframes rotateModalBgLeft{0%{transform:rotate(0deg)}to{transform:rotate(-360deg)}}
    @keyframes rotateModalBgRight{0%{transform:rotate(0deg)}to{transform:rotate(360deg)}}

    /* Winning sector glow animation */
    @keyframes winSectorGlow{
        0%,100%{filter:drop-shadow(0 0 10px #FFD700) drop-shadow(0 0 20px #FFA500)}
        50%{filter:drop-shadow(0 0 30px #FFD700) drop-shadow(0 0 50px #FFA500) drop-shadow(0 0 70px #FF6600)}
    }
    @keyframes winTextGlow{
        0%,100%{text-shadow:0 0 10px #FFD700,0 0 20px #FFA500}
        50%{text-shadow:0 0 20px #FFD700,0 0 40px #FFA500,0 0 60px #FF6600}
    }

    /* Winner glow effect (from 585) */
    @keyframes winnerGlow {
        0%, 100% { filter: drop-shadow(0 0 5px rgba(255, 215, 0, 0.6)); }
        50% { filter: drop-shadow(0 0 12px rgba(255, 215, 0, 0.8)) drop-shadow(0 0 20px rgba(255, 165, 0, 0.5)); }
    }

    /* Flare animations (from 585) */
    @keyframes showFlare1{0%,60%,to{opacity:0}15%,30%{opacity:1}}
    @keyframes showFlare2{0%,20%,80%{opacity:0}50%,to{opacity:1}}
    @keyframes showFlare3{0%,40%,to{opacity:0}70%{opacity:1}}

    /* Light pulse */
    @keyframes lightPulse{0%,to{transform:scale(1)}50%{transform:scale(1.2)}}

    /* Branch wobble */
    @keyframes branchWobble{to{transform:rotate(4deg)}}

    /* Modal item scale */
    @keyframes scaleModalItem{0%{transform:scale(0)}33%,to{transform:scale(1)}66%{transform:scale(.9)}}

    /* Logo movement */
    @keyframes moveLogo{0%,to{transform:translate(0,1em)}50%{transform:translate(0,-1em)}}
`;

/**
 * CSS animations for boxes mechanic (from real landing 684)
 */
const BOXES_ANIMATIONS = `
    /* Epic shake animation */
    @keyframes epicShake {
        0%, 100% { transform: translate(0) rotate(0) scale(1); }
        10% { transform: translate(-6px, 3px) rotate(-5deg) scale(1.02); }
        20% { transform: translate(6px, -3px) rotate(5deg) scale(1.05); }
        30% { transform: translate(-5px, 2px) rotate(-4deg) scale(1.03); }
        40% { transform: translate(5px, -2px) rotate(4deg) scale(1.06); }
        50% { transform: translate(-4px, 3px) rotate(-3deg) scale(1.04); }
        60% { transform: translate(4px, -3px) rotate(3deg) scale(1.07); }
        70% { transform: translate(-3px, 2px) rotate(-2deg) scale(1.05); }
        80% { transform: translate(3px, -2px) rotate(2deg) scale(1.08); }
        90% { transform: translate(-2px, 1px) rotate(-1deg) scale(1.06); }
    }

    /* Tease jump */
    @keyframes teaseJump {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-15px) scale(1.08); }
    }

    /* Tease wiggle */
    @keyframes teaseWiggle {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(-8deg); }
        75% { transform: rotate(8deg); }
    }

    /* Tease dance */
    @keyframes teaseDance {
        0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
        25% { transform: translateY(-10px) rotate(-5deg) scale(1.05); }
        50% { transform: translateY(-5px) rotate(3deg) scale(1.08); }
        75% { transform: translateY(-12px) rotate(-3deg) scale(1.05); }
    }

    /* Glow pulse */
    @keyframes glowPulse {
        0%, 100% { transform: scale(1); opacity: 0.6; }
        50% { transform: scale(1.2); opacity: 0.9; }
    }

    /* Shake glow */
    @keyframes shakeGlow {
        0% { transform: scale(1); opacity: 0.5; }
        50% { transform: scale(1.5); opacity: 1; }
        100% { transform: scale(1); opacity: 0.5; }
    }

    /* Reward popup animations */
    @keyframes rewardPopIn {
        0% { opacity: 0; transform: translateX(-50%) translateY(30px) scale(0); }
        60% { transform: translateX(-50%) translateY(-15px) scale(1.1); }
        100% { opacity: 1; transform: translateX(-50%) translateY(-10px) scale(1); }
    }
    @keyframes rewardPopOut {
        0% { opacity: 1; transform: translateX(-50%) translateY(-10px) scale(1); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-40px) scale(0.5); }
    }

    /* Shockwave effect */
    @keyframes shockwaveExpand {
        0% { transform: translate(-50%, -50%) scale(1); border: 3px solid var(--gold); opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(15); border: 1px solid var(--gold); opacity: 0; }
    }

    /* Confetti fall */
    @keyframes confettiFall {
        0% { top: -30px; opacity: 1; transform: rotate(0deg) translateX(0); }
        100% { top: 120%; opacity: 0.6; transform: rotate(1080deg) translateX(var(--x)); }
    }

    /* CTA button pulse */
    @keyframes ctaPulse {
        0%, 100% { box-shadow: 0 6px 0 #993300, 0 10px 30px rgba(255,102,0,0.4); }
        50% { box-shadow: 0 6px 0 #993300, 0 10px 50px rgba(255,102,0,0.7), 0 0 30px rgba(255,102,0,0.3); }
    }

    /* Background particle float */
    @keyframes floatParticle {
        0% { opacity: 0; transform: translateY(100vh) scale(0); }
        10% { opacity: 0.8; }
        90% { opacity: 0.8; }
        100% { opacity: 0; transform: translateY(-20vh) scale(1); }
    }

    /* Modal slide in */
    @keyframes modalSlideIn {
        0% { opacity: 0; transform: scale(0.5) translateY(50px); }
        100% { opacity: 1; transform: scale(1) translateY(0); }
    }

    /* Light blink */
    @keyframes lightBlink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
    }

    /* Title glow */
    @keyframes titleGlow {
        0%, 100% { text-shadow: 0 0 20px var(--gold); }
        50% { text-shadow: 0 0 40px var(--gold), 0 0 60px var(--neon-orange); }
    }

    /* Slot spin effect */
    @keyframes slotSpin {
        0% { opacity: 1; }
        50% { opacity: 0.3; }
        100% { opacity: 1; }
    }

    /* Character float */
    @keyframes characterFloat {
        0%, 100% { transform: translateX(-50%) translateY(0); }
        50% { transform: translateX(-50%) translateY(-8px); }
    }

    /* Shimmer effect */
    @keyframes shimmer {
        0% { opacity: 0.5; }
        50% { opacity: 1; }
        100% { opacity: 0.5; }
    }

    /* Checkpoint pulse */
    @keyframes checkpointPulse {
        0%, 100% { box-shadow: 0 0 20px var(--gold); }
        50% { box-shadow: 0 0 40px var(--gold), 0 0 60px var(--neon-orange); }
    }

    /* Particle fly */
    @keyframes particleFly {
        0% { opacity: 1; transform: translate(0, 0) rotate(0deg) scale(1); }
        100% { opacity: 0; transform: translate(var(--dx), var(--dy)) rotate(var(--rot)) scale(0.3); }
    }

    /* Fade in */
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
`;

/**
 * Common base styles
 */
const BASE_STYLES = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; scroll-behavior: smooth; }
    body {
        font-family: 'Libre Franklin', 'Roboto', sans-serif;
        font-weight: 900;
        user-select: none;
        -webkit-user-select: none;
        overflow-x: hidden;
        overflow-y: auto;
    }
    img { width: 100%; max-width: 100%; height: auto; }
    .hidden { display: none !important; }
    .visible { display: flex !important; }
`;

/**
 * Loader styles (common for both mechanics)
 */
const LOADER_STYLES = `
    .loader {
        position: fixed;
        inset: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
        z-index: 999;
        padding: 15px;
    }
    .loader.is--loaded { display: none; }
    .loader__logo {
        margin-bottom: 35px;
        width: 100%;
        max-width: 350px;
    }
    @media(max-width:767px) {
        .loader__logo { margin-top: -35%; max-width: 250px; }
    }
    .loader__progress {
        width: 100%;
        height: 28px;
        max-width: 340px;
        padding: 4px;
        border-radius: 100px;
        position: relative;
    }
    .loader__progress::before {
        position: absolute;
        content: '';
        left: 4px;
        top: 4px;
        border-radius: 100px;
        width: calc(100% - 8px);
        height: calc(100% - 8px);
        background-color: #fff;
    }
    .loader__progress-line {
        position: relative;
        z-index: 2;
        width: 0;
        height: 100%;
        border-radius: 100px;
        transition: width 0.5s ease;
    }
    @media(max-width:767px) {
        .loader__progress { max-width: 220px; }
    }
`;

/**
 * Anti-copy protection script
 */
const PROTECTION_SCRIPT = `
    // Anti-copy protection
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('selectstart', e => e.preventDefault());
    document.addEventListener('dragstart', e => e.preventDefault());
    document.addEventListener('keydown', e => {
        if (e.key === 'F12' ||
            (e.ctrlKey && e.shiftKey && ['I','J','C','i','j','c'].includes(e.key)) ||
            (e.ctrlKey && ['U','u','S','s'].includes(e.key))) {
            e.preventDefault();
            return false;
        }
    });
    document.querySelectorAll('img').forEach(img => {
        img.setAttribute('draggable', 'false');
        img.style.pointerEvents = 'none';
    });
`;

/**
 * Convert image buffer to base64 data URL
 * @param {Buffer|string} imageData - Image buffer or URL
 * @param {string} mimeType - MIME type (default: image/png)
 * @returns {string} Data URL or original URL
 */
function toDataUrl(imageData, mimeType = 'image/png') {
  if (!imageData) return '';
  if (typeof imageData === 'string') {
    if (imageData.startsWith('data:') || imageData.startsWith('http')) {
      return imageData;
    }
    return `data:${mimeType};base64,${imageData}`;
  }
  if (Buffer.isBuffer(imageData)) {
    return `data:${mimeType};base64,${imageData.toString('base64')}`;
  }
  return imageData;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate wheel landing HTML
 * Based on real landings: 585_landing_archive, 688_landing_archive, 691_landing_archive
 *
 * @param {Object} layers - Layer assets { background, wheel, logo, character, pointer, frame, button, effects }
 * @param {Object} config - Configuration options
 * @returns {string} Complete HTML string
 */
export function generateWheelHTML(layers = {}, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const prizes = cfg.prizes || [
    `${cfg.currency}${cfg.prizeAmount}`,
    `${cfg.currency}100`,
    `${cfg.currency}50`,
    `${cfg.currency}25`,
    `${cfg.currency}10`,
    `${cfg.currency}100`,
    `${cfg.currency}50`,
    `${cfg.currency}25`
  ];

  // Extract layer URLs (support both URL strings and objects with url property)
  const getUrl = (layer) => {
    if (!layer) return '';
    if (typeof layer === 'string') return layer;
    if (layer.url) return layer.url;
    if (Buffer.isBuffer(layer)) return toDataUrl(layer);
    return '';
  };

  const bgImage = getUrl(layers.background);
  const bgMobileImage = getUrl(layers.backgroundMobile) || bgImage;
  const wheelImage = getUrl(layers.wheel);
  const logoImage = getUrl(layers.logo);
  const characterImage = getUrl(layers.character);
  const pointerImage = getUrl(layers.pointer);
  const frameImage = getUrl(layers.frame);
  const buttonCenterImage = getUrl(layers.buttonCenter) || getUrl(layers.button);
  const effectFlareImage = getUrl(layers.effectFlare);
  const effectRingImage = getUrl(layers.effectRing);
  const coinsRainGif = getUrl(layers.coinsRain) || getUrl(layers.effects);

  const html = `<!DOCTYPE html>
<html lang="${cfg.lang}">
<head>
    <meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=0.9, maximum-scale=0.9, minimum-scale=0.9, viewport-fit=cover">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta name="theme-color" content="${cfg.themeColor}">
    <meta name="robots" content="noindex, nofollow">
    <title>${escapeHtml(cfg.title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@700;900&display=swap" rel="stylesheet">
    <style>
${WHEEL_ANIMATIONS}
${BASE_STYLES}
${LOADER_STYLES}

    html { background: ${cfg.themeColor}; font-size: min(4.5px + 5.5*(100vw - 375px)/1545, 10px); }
    @media(min-width:1024px) { html { font-size: clamp(5px, 0.85vh, 10px) !important; } }
    body { font-size: 80%; }
    @media(max-width:1440px) { body { font-size: 70%; } }
    @media(max-width:1023px) { body { font-size: 110%; } }
    @media(max-width:420px) { body { font-size: 105%; } }

    .loader { background: radial-gradient(72.76% 50% at 50% 50%, ${cfg.themeColor} 0%, #000536 100%); }
    .loader__progress { background: linear-gradient(to right, #000B55, #000B55); }
    .loader__progress-line { background: linear-gradient(to right, #FCEE21, #FF4732); }

    .body-wrapper {
        position: relative;
        display: flex;
        min-height: 100vh;
        overflow: hidden;
        background-repeat: no-repeat;
        background-position: center;
        background-size: cover;
        ${bgImage ? `background-image: url('${bgImage}');` : `background: ${cfg.themeColor};`}
    }
    @media(max-width:767px) {
        .body-wrapper {
            background-position: top center;
            ${bgMobileImage ? `background-image: url('${bgMobileImage}');` : ''}
        }
    }

    .container-wrap { display: flex; flex: 1 1 auto; flex-direction: column; justify-content: center; width: 100%; }
    .container { position: relative; display: flex; flex: 1 1 auto; flex-direction: column; justify-content: center; width: 100%; padding: 0 16px; overflow: hidden; }
    @media(max-width:1023px) { .container { display: block; flex: unset; height: 100%; padding: 5em 16px; } }

    .logo { position: relative; z-index: 7; display: block; width: 90em; margin: 0 auto; animation: 2s scaleLogo ease-in-out infinite; }
    @media(max-width:768px) { .logo { width: 55em; } }

    .wheel { position: relative; width: 65.4em; height: 65.4em; margin: 7em auto 0; }
    @media(max-width:768px) { .wheel { margin-top: 15em; font-size: 90%; } }

    .wheel__spinner { position: relative; z-index: 5; width: 100%; }
    .wheel__spinner_animated { animation: 4s spinWheel ease-in-out infinite; }

    .wheel__around {
        position: absolute;
        z-index: 5;
        left: 49.7%;
        top: 49.5%;
        width: 89em;
        height: 89em;
        ${frameImage ? `background-image: url('${frameImage}');` : ''}
        background-size: contain;
        background-position: center;
        background-repeat: no-repeat;
        transform: translate(-50%, -50%);
        pointer-events: none;
    }

    .wheel__arrow {
        position: absolute;
        z-index: 6;
        left: 50%;
        top: 1em;
        width: 18em;
        height: 18em;
        background-size: contain;
        background-position: center;
        background-repeat: no-repeat;
        ${pointerImage ? `background-image: url('${pointerImage}');` : ''}
        transform: translate(-50%, -15em);
    }

    .wheel__btn {
        position: absolute;
        z-index: 6;
        left: 50%;
        top: 50%;
        width: 18em;
        height: 18em;
        border-radius: 50%;
        ${buttonCenterImage ? `background: url('${buttonCenterImage}') 50% 0;` : `background: ${cfg.primaryColor};`}
        background-size: 100%;
        border: 0;
        outline: 0;
        transform: translate(-50%, -50%);
        cursor: pointer;
    }
    .wheel__btn:disabled, .wheel__btn.disabled { background-position: 50% 100%; pointer-events: none; }

    .wheel__texts {
        position: absolute;
        left: 50%;
        top: 50%;
        z-index: 5;
        width: 100%;
        height: 100%;
        transform: translate(-50%, -50%) rotate(45deg);
        pointer-events: none;
    }

    .wheel__texts-block {
        display: flex;
        flex-direction: column;
        justify-content: center;
        height: 8em;
        width: 23em;
        align-items: center;
        color: #fff;
        position: absolute;
        padding-right: 1em;
        padding-left: 2em;
        transition: all 0.3s ease;
    }
    .wheel__texts-block:nth-child(even) { color: #6c044e; }
    .wheel__texts-block p { font-size: 3.2em; font-weight: 900; line-height: 1.5; text-transform: uppercase; white-space: nowrap; }

    .wheel__texts-1 { transform: rotate(-137deg); left: 11%; top: 23%; }
    .wheel__texts-2 { transform: rotate(-93deg); left: 32%; top: 14%; }
    .wheel__texts-3 { transform: rotate(-45deg); left: 54%; top: 23%; }
    .wheel__texts-4 { transform: rotate(-2deg); left: 63%; top: 44%; }
    .wheel__texts-5 { transform: rotate(43deg); left: 54%; top: 65%; }
    .wheel__texts-6 { transform: rotate(87deg); left: 33%; top: 74%; }
    .wheel__texts-7 { transform: rotate(133deg); left: 11%; top: 66%; }
    .wheel__texts-8 { transform: rotate(177deg); left: 2%; top: 45%; }

    .wheel__texts-block.is--winner { animation: winSectorGlow 0.4s ease-in-out infinite; }
    .wheel__texts-block.is--winner p { animation: winTextGlow 0.4s ease-in-out infinite; }

    .effect { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
    .effect__ring {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        display: block;
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
        mix-blend-mode: screen;
        opacity: 0;
        ${effectRingImage ? `background-image: url('${effectRingImage}');` : ''}
    }
    .effect__ring.is--1 { animation: 3s scaleRing1 ease-in-out infinite; }
    .effect__ring.is--2 { animation: 3s scaleRing2 ease-in-out infinite; animation-delay: 1s; }
    .effect__ring.is--3 { animation: 3s scaleRing3 ease-in-out infinite; animation-delay: 2s; }

    .left-person {
        position: absolute;
        z-index: 5;
        left: max(0%, 50% - 120em);
        bottom: calc(50% - 100em);
        width: 128em;
        height: 140em;
        animation: movePerson 6s ease-in-out infinite;
    }
    @media(max-width:1023px) { .left-person { left: -25em; bottom: -35em; font-size: 66%; transform: scaleX(-1); } }

    .bottom__section {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        z-index: 8;
        width: 100%;
        margin-top: 14em;
    }
    @media(max-width:1023px) { .bottom__section { position: fixed; left: 0; bottom: 16em; margin-top: 0; } }

    .bottom__section-button {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 12em;
        min-width: 50px;
        padding: 0 3em;
        background: linear-gradient(180deg, ${cfg.primaryColor} 0%, ${cfg.secondaryColor} 100%);
        border-radius: 2em;
        outline: 0;
        border: 0;
        cursor: pointer;
        text-decoration: none;
        -webkit-tap-highlight-color: transparent;
        filter: drop-shadow(0 0 20px rgba(86, 215, 255, 0.68));
    }
    .bottom__section-button span {
        position: relative;
        z-index: 3;
        font-size: 6em;
        text-align: center;
        text-decoration: none;
        text-transform: uppercase;
        color: #fff;
        text-shadow: 0 .1em 0 rgba(0, 0, 0, 0.7);
    }
    .bottom__section-button.pulse { animation: 2s pulseButton ease-in-out infinite; }

    .modal {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        min-height: 100vh;
        opacity: 0;
        overflow: hidden;
        visibility: hidden;
        z-index: 100;
    }
    .modal.is--active { opacity: 1; visibility: visible; }
    .modal__wrapper { position: relative; top: 14%; }
    @media(max-width:768px) { .modal__wrapper { top: 5%; } }

    .modal__content {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        max-width: 100em;
        margin: 10em auto 12em;
    }
    @media(max-width:767px) { .modal__content { margin-top: 12em; } }

    .modal__content::before {
        content: "";
        position: absolute;
        top: calc(50% - 85em);
        left: calc(50% - 85em);
        width: 170em;
        height: 170em;
        ${effectFlareImage ? `background-image: url('${effectFlareImage}');` : ''}
        background-position: center;
        background-size: 100%;
        background-repeat: no-repeat;
        mix-blend-mode: plus-lighter;
        animation: rotateModalBgLeft 20s linear infinite;
    }
    @media(max-width:768px) { .modal__content::before { font-size: 75%; } }

    .modal__logo {
        position: relative;
        z-index: 7;
        display: block;
        width: 90em;
        margin: 0 auto;
        animation: 2s scaleLogo ease-in-out infinite;
    }
    @media(max-width:768px) { .modal__logo { width: 55em; } }

    .modal__title {
        position: relative;
        z-index: 2;
        padding: 0 16px;
        font-size: 5.2em;
        text-align: center;
        text-transform: uppercase;
        color: #0059f2;
        text-shadow: 0 -2px 1px #fff, -1px -1px 1px #fff, 0 -1px 1px #fff, 1px -1px 1px #fff,
                     -2px 0 1px #fff, -1px 0 1px #fff, 0 0 1px #fff, 1px 0 1px #fff, 2px 0 1px #fff,
                     -1px 1px 1px #fff, 0 1px 1px #fff, 1px 1px 1px #fff, 0 2px 1px #fff;
    }

    .modal__text {
        position: relative;
        z-index: 2;
        margin-top: 10px;
        padding: 0 16px;
        font-size: 7.3em;
        text-align: center;
        text-transform: uppercase;
        color: #f00800;
        text-shadow: 0 -2px 1px #fff, -1px -1px 1px #fff, 0 -1px 1px #fff, 1px -1px 1px #fff,
                     -2px 0 1px #fff, -1px 0 1px #fff, 0 0 1px #fff, 1px 0 1px #fff, 2px 0 1px #fff,
                     -1px 1px 1px #fff, 0 1px 1px #fff, 1px 1px 1px #fff, 0 2px 1px #fff;
    }

    .modal.is--active .bottom__section { opacity: 1; z-index: 999; margin-top: 0; bottom: 0; position: relative; }
    @media(max-width:1023px) { .modal.is--active .bottom__section { bottom: 8em; } }
    .modal.is--active .bottom__section-button { animation: 2s pulseButton ease-in-out infinite; cursor: pointer; pointer-events: auto; }

    .effects {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        z-index: 5;
        display: none;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        mix-blend-mode: screen;
        pointer-events: none;
    }
    .effects.visible { display: flex; }
    .effects__block {
        position: fixed;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background-repeat: no-repeat;
        background-size: cover;
        background-position: center;
    }

    .wheel__spinner_win_1 { animation: 3s spinTo1 ease-in-out forwards !important; }
    .wheel__spinner_win_2 { animation: 3s spinTo2 ease-in-out forwards !important; }
    .wheel__spinner_win_3 { animation: 3s spinTo3 ease-in-out forwards !important; }
    .wheel__spinner_win_4 { animation: 3s spinTo4 ease-in-out forwards !important; }
    .wheel__spinner_win_5 { animation: 3s spinTo5 ease-in-out forwards !important; }
    .wheel__spinner_win_6 { animation: 3s spinTo6 ease-in-out forwards !important; }
    .wheel__spinner_win_7 { animation: 3s spinTo7 ease-in-out forwards !important; }
    .wheel__spinner_win_8 { animation: 3s spinTo8 ease-in-out forwards !important; }
    .is--win-spinner { animation: 2s spinner-win ease-in-out infinite !important; }

    .is--modal-open .bottom__section,
    .is--modal-open .left-person,
    .is--modal-open .logo,
    .is--modal-open .wheel { z-index: 0; opacity: 0; }
    body.is--winner .bottom__section { opacity: 0; }
    </style>
</head>
<body>
<div class="loader" id="loader">
    ${logoImage ? `<img class="loader__logo" src="${logoImage}" alt="logo">` : '<div class="loader__logo"></div>'}
    <div class="loader__progress">
        <div class="loader__progress-line" id="progressLine"></div>
    </div>
</div>
<div class="body-wrapper">
    <div class="container-wrap">
        <div class="container">
            <div class="logo">
                ${logoImage ? `<img src="${logoImage}" alt="">` : ''}
            </div>
            <div class="wheel">
                <div class="wheel__btn" id="wheelBtn"></div>
                <div class="wheel__around"></div>
                <div class="wheel__arrow"></div>
                <div class="wheel__spinner wheel__spinner_animated" id="wheelSpinner">
                    <div class="wheel__texts">
                        ${prizes.map((prize, i) => `
                        <div class="wheel__texts-${i + 1} wheel__texts-block" data-sector="${i + 1}"><p>${escapeHtml(prize)}</p></div>
                        `).join('')}
                    </div>
                    ${wheelImage ? `<img src="${wheelImage}" alt="">` : ''}
                </div>
                <div class="effect">
                    <span class="effect__ring is--1"></span>
                    <span class="effect__ring is--2"></span>
                    <span class="effect__ring is--3"></span>
                </div>
            </div>
            ${characterImage ? `<div class="left-person"><img src="${characterImage}" alt=""></div>` : ''}
            <div class="bottom__section" id="bottomSection">
                <button class="bottom__section-button pulse" id="spinBtn"><span>${escapeHtml(cfg.buttonText)}</span></button>
            </div>
            <div class="modal" id="modal">
                <div class="modal__wrapper">
                    <div class="modal__logo">
                        ${logoImage ? `<img src="${logoImage}" alt="">` : ''}
                    </div>
                    <div class="modal__content">
                        <div class="modal__title"><span>${escapeHtml(cfg.title)} - <span id="prizeText">${escapeHtml(prizes[cfg.winSector - 1])}</span></span></div>
                        <div class="modal__text"><span>${escapeHtml(cfg.subtitle)}</span></div>
                    </div>
                    <div class="bottom__section">
                        <button class="bottom__section-button" id="claimBtn"><span>${escapeHtml(cfg.claimButtonText)}</span></button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="effects" id="effects">
        ${coinsRainGif ? `<div class="effects__block" style="background-image:url('${coinsRainGif}')"></div>` : ''}
    </div>
</div>
<script>
const CONFIG = {
    winSector: ${cfg.winSector},
    prizes: ${JSON.stringify(prizes)},
    offerUrl: '${escapeHtml(cfg.offerUrl)}',
    useSound: ${cfg.useSound},
    redirectDelay: ${cfg.redirectDelay}
};

const loader = document.getElementById('loader');
const progressLine = document.getElementById('progressLine');
const wheelSpinner = document.getElementById('wheelSpinner');
const wheelBtn = document.getElementById('wheelBtn');
const spinBtn = document.getElementById('spinBtn');
const modal = document.getElementById('modal');
const effects = document.getElementById('effects');
const prizeText = document.getElementById('prizeText');
const claimBtn = document.getElementById('claimBtn');
let isSpinning = false;

// Loader
let progress = 0;
const loaderInterval = setInterval(function() {
    if (progress >= 99) { progressLine.style.width = '100%'; }
    else { progress += 2; progressLine.style.width = progress + '%'; }
}, 50);

window.addEventListener('load', function() {
    setTimeout(function() {
        progressLine.style.width = '100%';
        clearInterval(loaderInterval);
        setTimeout(function() { loader.classList.add('is--loaded'); }, 500);
    }, 300);
});

// Spin
function spinWheel(sector) {
    if (isSpinning) return;
    isSpinning = true;
    if (navigator.vibrate) navigator.vibrate(30);
    spinBtn.style.pointerEvents = 'none';
    wheelBtn.classList.add('disabled');
    document.body.classList.add('is--winner');
    wheelSpinner.classList.remove('wheel__spinner_animated');
    wheelSpinner.classList.add('wheel__spinner_win_' + sector);
    setTimeout(function() { showResult(sector); }, 3200);
}

function showResult(sector) {
    if (navigator.vibrate) navigator.vibrate([50, 30, 50, 30, 100]);
    wheelSpinner.classList.add('is--win-spinner');
    var winningBlock = document.querySelector('.wheel__texts-block[data-sector="' + sector + '"]');
    if (winningBlock) { winningBlock.classList.add('is--winner'); }
    setTimeout(function() {
        prizeText.textContent = CONFIG.prizes[sector - 1];
        document.body.classList.add('is--modal-open');
        modal.classList.add('is--active');
        effects.classList.add('visible');
        setTimeout(function() {
            var urlParams = window.location.search || '';
            window.location.href = CONFIG.offerUrl + urlParams;
        }, CONFIG.redirectDelay);
    }, 2000);
}

function claimPrize() {
    if (navigator.vibrate) navigator.vibrate([40, 20, 40]);
    var urlParams = window.location.search || '';
    if (CONFIG.offerUrl) {
        window.location.href = CONFIG.offerUrl + urlParams;
    }
}

spinBtn.addEventListener('click', function() { spinWheel(CONFIG.winSector); });
wheelBtn.addEventListener('click', function() { spinWheel(CONFIG.winSector); });
claimBtn.addEventListener('click', claimPrize);

${cfg.enableProtection ? PROTECTION_SCRIPT : ''}
</script>
</body>
</html>`;

  log.info('Generated wheel HTML template', {
    prizesCount: prizes.length,
    hasBackground: !!bgImage,
    hasWheel: !!wheelImage,
    hasCharacter: !!characterImage
  });

  return html;
}

/**
 * Generate boxes landing HTML
 * Based on real landing: 684_landing_archive
 *
 * @param {Object} layers - Layer assets { background, logo, character, boxClosed, boxOpen, effects }
 * @param {Object} config - Configuration options
 * @returns {string} Complete HTML string
 */
export function generateBoxesHTML(layers = {}, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const requiredBoxes = cfg.requiredBoxes || 3;
  const totalCash = cfg.totalCash || 1500;
  const totalFs = cfg.totalFs || 250;

  // Extract layer URLs
  const getUrl = (layer) => {
    if (!layer) return '';
    if (typeof layer === 'string') return layer;
    if (layer.url) return layer.url;
    if (Buffer.isBuffer(layer)) return toDataUrl(layer);
    return '';
  };

  const bgImage = getUrl(layers.background);
  const logoImage = getUrl(layers.logo);
  const characterImage = getUrl(layers.character);
  const boxClosedImage = getUrl(layers.boxClosed);
  const boxOpenImage = getUrl(layers.boxOpen);

  const html = `<!DOCTYPE html>
<html lang="${cfg.lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no" />
  <meta name="robots" content="noindex, nofollow">
  <title>${escapeHtml(cfg.title)}</title>
  <meta name="theme-color" content="${cfg.themeColor}"/>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Russo+One&family=Orbitron:wght@400;700;900&family=Roboto:wght@400;700;900&display=swap" rel="stylesheet">

  <style>
    :root {
      --gold: #ffd700;
      --gold-light: #fff4b8;
      --gold-dark: #b8860b;
      --neon-orange: #ff6600;
      --neon-blue: #00d4ff;
      --neon-green: #00ff88;
      --neon-pink: #ff00aa;
      --neon-purple: #aa00ff;
      --bg-dark: ${cfg.themeColor};
    }

${BOXES_ANIMATIONS}
${BASE_STYLES}

    html, body {
      height: 100%;
      font-family: 'Roboto', sans-serif;
      background: var(--bg-dark);
      overflow: hidden;
    }

    .game {
      position: relative;
      width: 100%;
      max-width: 500px;
      margin: 0 auto;
      height: 100dvh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .bg-layer {
      position: absolute;
      inset: 0;
      ${bgImage ? `background: url('${bgImage}') center top/cover no-repeat;` : `background: var(--bg-dark);`}
      z-index: 0;
    }

    .bg-particles {
      position: absolute;
      inset: 0;
      z-index: 1;
      overflow: hidden;
      pointer-events: none;
    }

    .bg-particles span {
      position: absolute;
      width: 4px;
      height: 4px;
      background: var(--gold);
      border-radius: 50%;
      animation: floatParticle 8s linear infinite;
      opacity: 0;
    }

    .bg-overlay {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse at 50% 0%, rgba(255,102,0,0.15) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.9) 0%, transparent 50%),
        linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.7) 100%);
      z-index: 2;
    }

    .header {
      position: relative;
      z-index: 20;
      padding: 10px 16px;
      padding-top: calc(10px + env(safe-area-inset-top, 0px));
      background: linear-gradient(180deg, rgba(10,10,18,0.95) 0%, rgba(20,20,30,0.9) 100%);
      border-bottom: 2px solid var(--neon-orange);
      box-shadow: 0 4px 20px rgba(255,102,0,0.2);
      flex-shrink: 0;
    }

    .header::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--gold), var(--neon-orange), var(--gold), transparent);
      animation: shimmer 2s linear infinite;
    }

    .stats-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }

    .stat-box {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: rgba(0,0,0,0.5);
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.1);
    }

    .stat-box.cash { border-color: rgba(0,255,136,0.3); box-shadow: 0 0 15px rgba(0,255,136,0.1); }
    .stat-box.spins { border-color: rgba(0,212,255,0.3); box-shadow: 0 0 15px rgba(0,212,255,0.1); }

    .stat-icon { font-size: 20px; }
    .stat-value { font-family: 'Orbitron', monospace; font-size: 18px; font-weight: 700; }
    .stat-box.cash .stat-value { color: var(--neon-green); text-shadow: 0 0 10px var(--neon-green); }
    .stat-box.spins .stat-value { color: var(--neon-blue); text-shadow: 0 0 10px var(--neon-blue); }

    .progress-container {
      position: relative;
      height: 40px;
      background: linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%);
      border-radius: 20px;
      overflow: visible;
      border: 2px solid #333;
      box-shadow: inset 0 3px 8px rgba(0,0,0,0.5);
    }

    .progress-track {
      position: absolute;
      top: 50%;
      left: 25px;
      right: 25px;
      height: 6px;
      transform: translateY(-50%);
      background: rgba(255,255,255,0.1);
      border-radius: 4px;
    }

    .progress-fill {
      position: absolute;
      left: 0;
      top: 0;
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, var(--neon-orange), var(--gold), var(--neon-orange));
      border-radius: 4px;
      transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 0 20px var(--neon-orange);
    }

    .progress-fill::after {
      content: '';
      position: absolute;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 16px;
      height: 16px;
      background: #fff;
      border-radius: 50%;
      box-shadow: 0 0 20px var(--gold), 0 0 40px var(--neon-orange);
    }

    .checkpoints {
      position: absolute;
      top: 50%;
      left: 30px;
      right: 30px;
      transform: translateY(-50%);
      display: flex;
      justify-content: space-between;
      z-index: 5;
    }

    .checkpoint {
      width: 28px;
      height: 28px;
      background: linear-gradient(180deg, #2a2a3e, #1a1a2e);
      border: 2px solid #444;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Orbitron', monospace;
      font-size: 10px;
      font-weight: 700;
      color: #666;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 3px 10px rgba(0,0,0,0.5);
    }

    .checkpoint.active {
      background: linear-gradient(180deg, var(--gold), var(--gold-dark));
      border-color: #fff;
      color: #000;
      transform: scale(1.15);
      animation: checkpointPulse 1s ease-in-out infinite;
      box-shadow: 0 0 20px var(--gold);
    }

    .checkpoint.completed {
      background: linear-gradient(180deg, var(--neon-green), #00aa55);
      border-color: #88ffaa;
      color: #fff;
      transform: scale(1.1);
      box-shadow: 0 0 20px var(--neon-green);
    }

    .checkpoint.completed::after { content: '\\2713'; font-size: 16px; }
    .checkpoint.completed span { display: none; }

    .character {
      position: absolute;
      top: calc(85px + env(safe-area-inset-top, 0px));
      left: 50%;
      transform: translateX(-50%);
      width: 55%;
      max-width: 280px;
      z-index: 5;
      filter: drop-shadow(0 10px 40px rgba(0,0,0,0.8));
      animation: characterFloat 3s ease-in-out infinite;
    }

    .character img { width: 100%; height: auto; }

    .speech-bubble {
      position: absolute;
      top: calc(120px + env(safe-area-inset-top, 0px));
      left: 10px;
      z-index: 100;
      background: linear-gradient(180deg, #fff 0%, #f0f0f0 100%);
      border: 3px solid var(--neon-orange);
      border-radius: 16px;
      padding: 12px 14px;
      max-width: 150px;
      text-align: center;
      opacity: 0;
      transform: scale(0) rotate(-5deg);
      transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      box-shadow: 0 8px 30px rgba(0,0,0,0.4), 0 0 20px rgba(255,153,0,0.2);
    }

    .speech-bubble.show { opacity: 1; transform: scale(1) rotate(0deg); }

    .speech-bubble::after {
      content: '';
      position: absolute;
      right: -12px;
      bottom: 15px;
      border: 12px solid transparent;
      border-left-color: #fff;
    }

    .speech-bubble::before {
      content: '';
      position: absolute;
      right: -18px;
      bottom: 12px;
      border: 15px solid transparent;
      border-left-color: var(--neon-orange);
    }

    .speech-bubble .message { font-family: 'Russo One', sans-serif; font-size: 11px; color: #1a1a1a; line-height: 1.4; }
    .speech-bubble .message .highlight { color: var(--neon-orange); font-size: 13px; }
    .speech-bubble .message .cash { color: #00aa55; font-size: 13px; }
    .speech-bubble .message .spins { color: #0088cc; font-size: 13px; }

    .boxes-area {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 0 10px;
      padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
      z-index: 10;
    }

    .boxes-container {
      display: flex;
      flex-direction: column;
      gap: 2.5vw;
      width: 100%;
      max-width: 420px;
      margin: 0 auto;
    }

    .boxes-row { display: flex; justify-content: center; gap: 2.5vw; }
    .boxes-row.row-3 { gap: 5vw; }

    .box {
      position: relative;
      width: 20vw;
      height: 20vw;
      max-width: 85px;
      max-height: 85px;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 0;
      outline: none;
      perspective: 500px;
      transition: transform 0.3s ease;
    }

    .box-inner {
      position: absolute;
      inset: -45%;
      width: 190%;
      height: 190%;
      transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
      transform-style: preserve-3d;
    }

    .box img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      backface-visibility: hidden;
    }

    .box img.closed { filter: drop-shadow(0 8px 20px rgba(0,0,0,0.6)) drop-shadow(0 0 10px rgba(255,153,0,0.3)); }
    .box img.open { opacity: 0; transform: scale(0.5) rotateY(180deg); }

    .box .glow {
      position: absolute;
      inset: -60%;
      background: radial-gradient(circle, rgba(255,215,0,0.6) 0%, rgba(255,102,0,0.3) 30%, transparent 60%);
      opacity: 0;
      pointer-events: none;
      z-index: -1;
      transition: opacity 0.3s ease;
    }

    .box:not(.opened):not(.disabled):hover { transform: scale(1.05); }
    .box:not(.opened):not(.disabled):hover .glow { opacity: 0.5; }
    .box:not(.opened):not(.disabled):active { transform: scale(0.95); }

    .box.disabled { pointer-events: none; opacity: 0.2; }
    .box.opened { pointer-events: none; }

    .box.opened .box-inner { transform: rotateY(10deg) rotateX(-5deg) scale(1.1); }
    .box.opened img.closed { opacity: 0; filter: blur(10px); }
    .box.opened img.open {
      opacity: 1;
      transform: scale(1) rotateY(0deg);
      filter: drop-shadow(0 8px 20px rgba(0,0,0,0.6)) drop-shadow(0 0 30px var(--gold));
    }
    .box.opened .glow { opacity: 0.8; animation: glowPulse 1s ease-in-out infinite; }

    .box.shaking { animation: epicShake 0.6s ease; z-index: 30; }
    .box.shaking .glow { opacity: 1; animation: shakeGlow 0.6s ease; }

    .box.teasing { z-index: 20; }
    .box.teasing img.closed { filter: drop-shadow(0 8px 20px rgba(0,0,0,0.6)) drop-shadow(0 0 25px var(--gold)); }

    .box.tease-jump { animation: teaseJump 0.5s cubic-bezier(0.36, 0, 0.66, -0.56); }
    .box.tease-wiggle { animation: teaseWiggle 0.4s ease-in-out; }
    .box.tease-dance { animation: teaseDance 0.7s ease-in-out; }

    .box-reward {
      position: absolute;
      bottom: 110%;
      left: 50%;
      transform: translateX(-50%) translateY(30px) scale(0);
      z-index: 150;
      background: linear-gradient(180deg, #1a2533 0%, #0f1a25 100%);
      border: 2px solid var(--gold);
      border-radius: 14px;
      padding: 10px 16px;
      text-align: center;
      opacity: 0;
      pointer-events: none;
      white-space: nowrap;
      box-shadow: 0 10px 40px rgba(0,0,0,0.7), 0 0 30px rgba(255,215,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1);
    }

    .box-reward::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 10px solid transparent;
      border-top-color: var(--gold);
    }

    .box-reward.show { animation: rewardPopIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
    .box-reward.hide { animation: rewardPopOut 0.3s ease forwards; }

    .box-reward .reward-content { display: flex; align-items: center; gap: 8px; }
    .box-reward .reward-value { font-family: 'Orbitron', monospace; font-size: 18px; font-weight: 700; }
    .box-reward .reward-value.cash { color: var(--neon-green); text-shadow: 0 0 15px var(--neon-green); }
    .box-reward .reward-value.spins { color: var(--neon-blue); text-shadow: 0 0 15px var(--neon-blue); }
    .box-reward .reward-separator { color: #666; font-size: 14px; }

    .particle { position: fixed; width: 20px; height: 20px; pointer-events: none; z-index: 200; animation: particleFly 0.8s ease-out forwards; }
    .particle.coin { background: radial-gradient(circle at 30% 30%, var(--gold-light), var(--gold), var(--gold-dark)); border-radius: 50%; box-shadow: 0 0 10px var(--gold); }
    .particle.ticket { background: linear-gradient(135deg, var(--neon-blue), var(--neon-purple)); border-radius: 3px; box-shadow: 0 0 10px var(--neon-blue); }

    .shockwave { position: fixed; width: 20px; height: 20px; border-radius: 50%; pointer-events: none; z-index: 180; animation: shockwaveExpand 0.6s ease-out forwards; }

    .confetti-container { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 90; }
    .confetti-container i { position: absolute; top: -30px; width: 12px; height: 16px; border-radius: 3px; opacity: 0; }

    .modal { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; z-index: 500; padding: 20px; }
    .modal.show { display: flex; }
    .modal-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.9); animation: fadeIn 0.5s ease; }

    .modal-content {
      position: relative;
      width: 100%;
      max-width: 380px;
      background: linear-gradient(180deg, #1a1a2e 0%, #0a0a15 100%);
      border-radius: 24px;
      border: 3px solid var(--gold);
      padding: 30px 20px;
      text-align: center;
      animation: modalSlideIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      box-shadow: 0 20px 60px rgba(0,0,0,0.8), 0 0 50px rgba(255,215,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1);
    }

    .modal-lights { position: absolute; top: -10px; left: 20px; right: 20px; display: flex; justify-content: space-around; }
    .modal-light { width: 12px; height: 12px; border-radius: 50%; animation: lightBlink 0.5s ease infinite; }
    .modal-light:nth-child(odd) { background: var(--neon-orange); box-shadow: 0 0 15px var(--neon-orange); }
    .modal-light:nth-child(even) { background: var(--gold); box-shadow: 0 0 15px var(--gold); animation-delay: 0.25s; }

    .modal-title {
      font-family: 'Orbitron', sans-serif;
      font-size: 28px;
      font-weight: 900;
      color: var(--gold);
      text-transform: uppercase;
      letter-spacing: 3px;
      margin-bottom: 5px;
      text-shadow: 0 0 30px var(--gold);
      animation: titleGlow 1s ease-in-out infinite;
    }

    .modal-subtitle { font-family: 'Russo One', sans-serif; font-size: 14px; color: #888; margin-bottom: 25px; }

    .prize-display { display: flex; justify-content: center; gap: 15px; margin-bottom: 25px; }

    .prize-box {
      flex: 1;
      max-width: 140px;
      padding: 20px 15px;
      background: rgba(0,0,0,0.5);
      border-radius: 16px;
      border: 2px solid rgba(255,255,255,0.1);
    }

    .prize-box.cash { border-color: rgba(0,255,136,0.4); box-shadow: 0 0 30px rgba(0,255,136,0.2); }
    .prize-box.spins { border-color: rgba(0,212,255,0.4); box-shadow: 0 0 30px rgba(0,212,255,0.2); }

    .prize-icon { font-size: 32px; margin-bottom: 10px; }
    .prize-value { font-family: 'Orbitron', monospace; font-size: 28px; font-weight: 700; margin-bottom: 5px; }
    .prize-box.cash .prize-value { color: var(--neon-green); text-shadow: 0 0 20px var(--neon-green); }
    .prize-box.spins .prize-value { color: var(--neon-blue); text-shadow: 0 0 20px var(--neon-blue); }
    .prize-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
    .prize-value.spinning { animation: slotSpin 0.1s linear infinite; }

    .cta-btn {
      width: 100%;
      padding: 18px 30px;
      background: linear-gradient(180deg, var(--neon-orange) 0%, #cc5500 100%);
      border: none;
      border-radius: 14px;
      font-family: 'Orbitron', sans-serif;
      font-size: 16px;
      font-weight: 700;
      color: #fff;
      text-transform: uppercase;
      letter-spacing: 2px;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 6px 0 #993300, 0 10px 30px rgba(255,102,0,0.4);
      animation: ctaPulse 1.5s ease-in-out infinite;
    }

    .cta-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 0 #993300, 0 15px 40px rgba(255,102,0,0.5); }
    .cta-btn:active { transform: translateY(4px); box-shadow: 0 2px 0 #993300; }

    .timer { margin-top: 15px; font-size: 13px; color: #666; }
    .timer span { color: var(--gold); font-family: 'Orbitron', monospace; font-weight: 700; }

    .preloader { position: fixed; inset: 0; z-index: 9999; background: #1a1a1a; }
    .roller-shutter {
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(180deg, #4a4a4a 0px, #3a3a3a 2px, #4a4a4a 4px, #333 8px, #444 12px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      transform-origin: top center;
      transition: transform 1s ease-in-out;
    }
    .preloader.open .roller-shutter { transform: scaleY(0); }
    .preloader.hidden { display: none; }
    .preloader-logo { width: 250px; max-width: 70vw; margin-bottom: 25px; }
    .preloader-progress { width: 220px; height: 14px; background: #222; border-radius: 7px; }
    .preloader-progress-fill { width: 0%; height: 100%; background: linear-gradient(90deg, #ff6600, #ffaa00); border-radius: 7px; transition: width 0.15s; }
  </style>
</head>
<body>
  <div class="preloader" id="preloader">
    <div class="roller-shutter" id="rollerShutter">
      ${logoImage ? `<img src="${logoImage}" alt="Logo" class="preloader-logo">` : ''}
      <div class="preloader-progress">
        <div class="preloader-progress-fill" id="progressFill"></div>
      </div>
    </div>
  </div>

  <div class="game" style="opacity: 0; transition: opacity 0.5s ease;">
    <div class="bg-layer"></div>
    <div class="bg-particles" id="bgParticles"></div>
    <div class="bg-overlay"></div>

    <div class="header">
      <div class="stats-row">
        <div class="stat-box cash">
          <span class="stat-icon">&#128176;</span>
          <span class="stat-value"><span id="totalCash">0</span>${cfg.currency}</span>
        </div>
        <div class="stat-box spins">
          <span class="stat-icon">&#127920;</span>
          <span class="stat-value"><span id="totalSpins">0</span> FS</span>
        </div>
      </div>

      <div class="progress-container">
        <div class="progress-track">
          <div class="progress-fill" id="progressFillBar"></div>
        </div>
        <div class="checkpoints" id="checkpoints"></div>
      </div>
    </div>

    ${characterImage ? `<div class="character"><img src="${characterImage}" alt="Host"></div>` : ''}

    <div class="speech-bubble" id="speechBubble">
      <div class="message" id="speechText"></div>
    </div>

    <div class="boxes-area">
      <div class="boxes-container" id="boxesContainer"></div>
    </div>

    <div class="confetti-container" id="confetti"></div>

    <div class="modal" id="modal">
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <div class="modal-lights">
          <div class="modal-light"></div>
          <div class="modal-light"></div>
          <div class="modal-light"></div>
          <div class="modal-light"></div>
          <div class="modal-light"></div>
          <div class="modal-light"></div>
          <div class="modal-light"></div>
        </div>

        <div class="modal-title">JACKPOT!</div>
        <div class="modal-subtitle">${escapeHtml(cfg.subtitle)}</div>

        <div class="prize-display">
          <div class="prize-box cash">
            <div class="prize-icon">&#128142;</div>
            <div class="prize-value" id="finalCash">???</div>
            <div class="prize-label">Bonus</div>
          </div>
          <div class="prize-box spins">
            <div class="prize-icon">&#127920;</div>
            <div class="prize-value" id="finalSpins">???</div>
            <div class="prize-label">Free Spins</div>
          </div>
        </div>

        <button class="cta-btn" id="claimBtn">${escapeHtml(cfg.claimButtonText)}</button>
        <div class="timer">Redirecting in <span id="countdown">5</span>s</div>
      </div>
    </div>
  </div>

  <script>
  var CONFIG = {
    offerUrl: "${escapeHtml(cfg.offerUrl)}",
    totalCash: ${totalCash},
    totalFs: ${totalFs},
    currency: "${cfg.currency}",
    requiredBoxes: ${requiredBoxes},
    claimButtonText: "${escapeHtml(cfg.claimButtonText)}",
    enableProtection: ${cfg.enableProtection},
    boxClosedImage: "${boxClosedImage}",
    boxOpenImage: "${boxOpenImage}"
  };

  (function(){
    var preloader = document.getElementById('preloader');
    var progressFillEl = document.getElementById('progressFill');
    var gameContainer = document.querySelector('.game');

    var progress = 0;
    var progressInterval = setInterval(function() {
      progress += Math.random() * 8 + 3;
      if (progress >= 100) {
        progress = 100;
        clearInterval(progressInterval);
        setTimeout(function() {
          preloader.classList.add('open');
          setTimeout(function() {
            preloader.classList.add('hidden');
            gameContainer.style.opacity = '1';
          }, 1000);
        }, 300);
      }
      progressFillEl.style.width = progress + '%';
    }, 100);

    ${cfg.enableProtection ? PROTECTION_SCRIPT : ''}

    var TOTAL_CASH = CONFIG.totalCash;
    var TOTAL_FS = CONFIG.totalFs;
    var REQUIRED = CONFIG.requiredBoxes;
    var CURRENCY = CONFIG.currency;

    var REWARD_SETS = [
      [{ cash: 500, fs: 100 }, { cash: 600, fs: 50 }, { cash: 400, fs: 100 }],
      [{ cash: 700, fs: 80 }, { cash: 400, fs: 70 }, { cash: 400, fs: 100 }],
      [{ cash: 450, fs: 120 }, { cash: 550, fs: 30 }, { cash: 500, fs: 100 }]
    ];

    var rewards = REWARD_SETS[Math.floor(Math.random() * REWARD_SETS.length)].slice();
    rewards = rewards.sort(function() { return Math.random() - 0.5; });

    var opened = 0, locked = false;
    var boxes = [];
    var speechTimeout = null;
    var wonCash = 0, wonSpins = 0;

    var container = document.getElementById('boxesContainer');
    var totalCashEl = document.getElementById('totalCash');
    var totalSpinsEl = document.getElementById('totalSpins');
    var modal = document.getElementById('modal');
    var confetti = document.getElementById('confetti');
    var progressFill = document.getElementById('progressFillBar');
    var checkpointsContainer = document.getElementById('checkpoints');
    var speechBubble = document.getElementById('speechBubble');
    var speechText = document.getElementById('speechText');

    var offerUrl = new URLSearchParams(location.search).get('offer') || CONFIG.offerUrl;

    function createBgParticles() {
      var particlesContainer = document.getElementById('bgParticles');
      for (var i = 0; i < 30; i++) {
        var span = document.createElement('span');
        span.style.left = Math.random() * 100 + '%';
        span.style.animationDelay = Math.random() * 8 + 's';
        span.style.animationDuration = (6 + Math.random() * 4) + 's';
        particlesContainer.appendChild(span);
      }
    }

    function createCheckpoints() {
      checkpointsContainer.innerHTML = '';
      for (var i = 0; i < REQUIRED; i++) {
        var cp = document.createElement('div');
        cp.className = 'checkpoint';
        cp.innerHTML = '<span>' + (i + 1) + '</span>';
        checkpointsContainer.appendChild(cp);
      }
    }

    function showSpeech(text, duration) {
      duration = duration || 3500;
      if (speechTimeout) clearTimeout(speechTimeout);
      speechText.innerHTML = text;
      speechBubble.classList.add('show');
      speechTimeout = setTimeout(function() { speechBubble.classList.remove('show'); }, duration);
    }

    function createBoxes() {
      container.innerHTML = '';
      boxes = [];
      var pattern = [4, 3, 4];
      for (var row = 0; row < pattern.length; row++) {
        var rowDiv = document.createElement('div');
        rowDiv.className = 'boxes-row';
        if (pattern[row] === 3) rowDiv.classList.add('row-3');
        for (var col = 0; col < pattern[row]; col++) {
          var box = document.createElement('button');
          box.className = 'box';
          var closedImg = CONFIG.boxClosedImage ? '<img src="' + CONFIG.boxClosedImage + '" class="closed" alt="">' : '<div class="closed" style="background:#333;border-radius:8px;width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#ffd700;font-size:24px;">?</div>';
          var openImg = CONFIG.boxOpenImage ? '<img src="' + CONFIG.boxOpenImage + '" class="open" alt="">' : '<div class="open" style="background:#222;border-radius:8px;width:100%;height:100%;"></div>';
          box.innerHTML = '<div class="glow"></div><div class="box-inner">' + closedImg + openImg + '</div>';
          box.onclick = (function(b) { return function() { openBox(b); }; })(box);
          rowDiv.appendChild(box);
          boxes.push(box);
        }
        container.appendChild(rowDiv);
      }
    }

    function updateUI() {
      totalCashEl.textContent = wonCash;
      totalSpinsEl.textContent = wonSpins;
      progressFill.style.width = (opened / REQUIRED) * 100 + '%';
      var checkpoints = document.querySelectorAll('.checkpoint');
      checkpoints.forEach(function(cp, index) {
        cp.classList.remove('active', 'completed');
        if (index < opened) cp.classList.add('completed');
        else if (index === opened && opened < REQUIRED) cp.classList.add('active');
      });
    }

    function createShockwave(x, y) {
      var wave = document.createElement('div');
      wave.className = 'shockwave';
      wave.style.left = x + 'px';
      wave.style.top = y + 'px';
      document.body.appendChild(wave);
      setTimeout(function() { wave.remove(); }, 600);
    }

    function particles(el, coins, tix) {
      var r = el.getBoundingClientRect();
      var cx = r.left + r.width/2, cy = r.top + r.height/2;
      createShockwave(cx, cy);
      function make(type, d) {
        setTimeout(function() {
          var p = document.createElement('div');
          p.className = 'particle ' + type;
          p.style.left = cx + 'px';
          p.style.top = cy + 'px';
          var a = Math.random() * Math.PI * 2;
          var dist = 80 + Math.random() * 100;
          p.style.setProperty('--dx', Math.cos(a)*dist + 'px');
          p.style.setProperty('--dy', (Math.sin(a)*dist - 50) + 'px');
          p.style.setProperty('--rot', (Math.random()*720) + 'deg');
          document.body.appendChild(p);
          setTimeout(function() { p.remove(); }, 900);
        }, d);
      }
      for (var i = 0; i < coins; i++) make('coin', i*25);
      for (var j = 0; j < tix; j++) make('ticket', j*35);
    }

    function burstConfetti() {
      var colors = ['#FF9900','#FFD700','#00ff88','#00d4ff','#fff','#ff00aa','#aa00ff'];
      for (var i = 0; i < 60; i++) {
        var c = document.createElement('i');
        c.style.left = Math.random()*100 + '%';
        c.style.background = colors[Math.floor(Math.random()*colors.length)];
        c.style.setProperty('--x', (Math.random()*120-60) + 'px');
        c.style.animation = 'confettiFall ' + (1.5+Math.random()*0.8) + 's linear forwards';
        c.style.animationDelay = Math.random()*0.5 + 's';
        confetti.appendChild(c);
        setTimeout(function(el) { return function() { el.remove(); }; }(c), 3000);
      }
    }

    function showBoxReward(box, cash, fs) {
      var popup = document.createElement('div');
      popup.className = 'box-reward';
      var content = '<div class="reward-content">';
      if (cash > 0) content += '<span class="reward-value cash">+' + CURRENCY + cash + '</span>';
      if (cash > 0 && fs > 0) content += '<span class="reward-separator">+</span>';
      if (fs > 0) content += '<span class="reward-value spins">' + fs + ' FS</span>';
      content += '</div>';
      popup.innerHTML = content;
      box.appendChild(popup);
      requestAnimationFrame(function() { popup.classList.add('show'); });
      setTimeout(function() {
        popup.classList.remove('show');
        popup.classList.add('hide');
        setTimeout(function() { popup.remove(); }, 300);
      }, 1800);
    }

    function openBox(box) {
      if (locked || opened >= REQUIRED || box.classList.contains('opened')) return;
      locked = true;
      box.classList.add('shaking');
      setTimeout(function() {
        box.classList.remove('shaking');
        box.classList.add('opened');
        var reward = rewards[opened];
        wonCash += reward.cash;
        wonSpins += reward.fs;
        opened++;
        updateUI();
        showBoxReward(box, reward.cash, reward.fs);
        var remaining = REQUIRED - opened;
        if (remaining > 0) {
          showSpeech('Great! +' + CURRENCY + reward.cash + ' + ' + reward.fs + ' FS!', 3500);
        }
        setTimeout(function() {
          particles(box, 8, 5);
          setTimeout(function() {
            locked = false;
            if (opened >= REQUIRED) {
              stopBoxTeasing();
              boxes.forEach(function(b) { b.classList.add('disabled'); });
              burstConfetti();
              setTimeout(burstConfetti, 400);
              setTimeout(burstConfetti, 800);
              showSpeech('AMAZING! You won EVERYTHING!', 4000);
              setTimeout(function() {
                modal.classList.add('show');
                var finalCashEl = document.getElementById('finalCash');
                var finalSpinsEl = document.getElementById('finalSpins');
                finalCashEl.classList.add('spinning');
                finalSpinsEl.classList.add('spinning');
                setTimeout(function() {
                  finalCashEl.classList.remove('spinning');
                  finalCashEl.textContent = CURRENCY + TOTAL_CASH;
                }, 800);
                setTimeout(function() {
                  finalSpinsEl.classList.remove('spinning');
                  finalSpinsEl.textContent = TOTAL_FS + ' FS';
                }, 1200);
                setTimeout(function() {
                  var countdown = 5;
                  var countdownEl = document.getElementById('countdown');
                  var countdownInterval = setInterval(function() {
                    countdown--;
                    countdownEl.textContent = countdown;
                    if (countdown <= 0) {
                      clearInterval(countdownInterval);
                      location.href = offerUrl + window.location.search;
                    }
                  }, 1000);
                }, 1500);
              }, 1200);
            }
          }, 300);
        }, 350);
      }, 600);
    }

    document.getElementById('claimBtn').onclick = function() {
      location.href = offerUrl + window.location.search;
    };

    var teaseInterval = null;
    var teaseAnimations = ['tease-jump', 'tease-wiggle', 'tease-dance'];

    function teaseRandomBoxes() {
      var unopenedBoxes = boxes.filter(function(b) { return !b.classList.contains('opened') && !b.classList.contains('shaking'); });
      if (unopenedBoxes.length === 0) { stopBoxTeasing(); return; }
      var numToTease = Math.min(unopenedBoxes.length, 2 + Math.floor(Math.random() * 2));
      var shuffled = unopenedBoxes.slice().sort(function() { return Math.random() - 0.5; });
      var boxesToTease = shuffled.slice(0, numToTease);
      boxesToTease.forEach(function(box, i) {
        setTimeout(function() {
          if (box.classList.contains('opened') || box.classList.contains('shaking')) return;
          var animation = teaseAnimations[Math.floor(Math.random() * teaseAnimations.length)];
          box.classList.add('teasing', animation);
          setTimeout(function() { box.classList.remove('teasing', 'tease-jump', 'tease-wiggle', 'tease-dance'); }, 700);
        }, i * 120);
      });
    }

    function startBoxTeasing() {
      if (teaseInterval) return;
      teaseRandomBoxes();
      teaseInterval = setInterval(teaseRandomBoxes, 900);
    }

    function stopBoxTeasing() {
      if (teaseInterval) { clearInterval(teaseInterval); teaseInterval = null; }
      boxes.forEach(function(b) { b.classList.remove('teasing', 'tease-jump', 'tease-wiggle', 'tease-dance'); });
    }

    createBgParticles();
    createCheckpoints();
    createBoxes();
    updateUI();
    setTimeout(function() { showSpeech('Pick <span class="highlight">' + REQUIRED + ' boxes</span> to win bonuses!', 5000); }, 500);
    startBoxTeasing();
  })();
  </script>
</body>
</html>`;

  log.info('Generated boxes HTML template', {
    requiredBoxes,
    totalCash,
    totalFs,
    hasBackground: !!bgImage,
    hasCharacter: !!characterImage
  });

  return html;
}

/**
 * Generate base HTML for any mechanic
 * @param {string} mechanic - 'wheel' or 'boxes'
 * @param {Object} layers - Layer assets
 * @param {Object} config - Configuration options
 * @returns {string} Complete HTML string
 */
export function generateBaseHTML(mechanic, layers = {}, config = {}) {
  switch (mechanic.toLowerCase()) {
    case 'wheel':
      return generateWheelHTML(layers, config);
    case 'boxes':
    case 'box':
      return generateBoxesHTML(layers, config);
    default:
      log.warn(`Unknown mechanic: ${mechanic}, defaulting to wheel`);
      return generateWheelHTML(layers, config);
  }
}

/**
 * Generate CSS animations string
 */
export function generateAnimationsCSS(mechanic = 'wheel') {
  if (mechanic === 'boxes' || mechanic === 'box') {
    return BOXES_ANIMATIONS;
  }
  return WHEEL_ANIMATIONS;
}

/**
 * Generate z-index layers object
 */
export function getZIndexLayers() {
  return {
    background: 0,
    particles: 1,
    overlay: 2,
    character: 5,
    gameElement: 5,
    frame: 6,
    pointer: 6,
    buttons: 8,
    headline: 10,
    header: 20,
    speechBubble: 100,
    modal: 500,
    loader: 999,
    preloader: 9999
  };
}

/**
 * Validate HTML template has all required elements
 */
export function validateTemplate(html, mechanic) {
  const issues = [];

  if (!html.includes('viewport')) {
    issues.push('Missing viewport meta tag for mobile responsiveness');
  }

  if (!html.includes('CONFIG')) {
    issues.push('Missing CONFIG object for JavaScript configuration');
  }

  if (!html.includes('offerUrl')) {
    issues.push('Missing offerUrl in configuration');
  }

  switch (mechanic) {
    case 'wheel':
      if (!html.includes('wheel') || !html.includes('spin')) {
        issues.push('Missing wheel or spin elements');
      }
      if (!html.includes('spinTo')) {
        issues.push('Missing spin animations');
      }
      break;
    case 'boxes':
    case 'box':
      if (!html.includes('box')) {
        issues.push('Missing box elements');
      }
      if (!html.includes('epicShake')) {
        issues.push('Missing shake animation');
      }
      break;
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Check service health
 */
export function checkHealth() {
  return {
    available: true,
    supportedMechanics: ['wheel', 'boxes'],
    features: [
      'responsive',
      'animations',
      'config-object',
      'protection',
      'loader',
      'modal',
      'effects',
      'utm-passthrough'
    ]
  };
}

export default {
  generateWheelHTML,
  generateBoxesHTML,
  generateBaseHTML,
  generateAnimationsCSS,
  getZIndexLayers,
  validateTemplate,
  checkHealth,
  DEFAULT_CONFIG
};
