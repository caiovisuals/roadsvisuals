<script lang="ts">
	import '../global.css';
	import { onDestroy } from 'svelte';
	import { initScene } from '$lib/main';

	let canvas: HTMLCanvasElement;
	let speed = 0;
	let distance = 0;

	// Estados: 'menu' | 'loading' | 'game'
	let state: 'menu' | 'loading' | 'game' = 'menu';
	let showInfo = false;
	let isPaused = false;
	let loadingProgress = 0;
	let stopAnimation: (() => void) | null = null;

	async function startGame() {
		state = 'loading';
		loadingProgress = 0;

		// Simula progresso visual enquanto a cena carrega
		const progressInterval = setInterval(() => {
			if (loadingProgress < 85) {
				loadingProgress += Math.random() * 12;
			}
		}, 120);

		try {
			// Aguarda a cena inicializar (fetchBrasiliaTime + Three.js setup)
			const scene = await initScene(canvas, (newSpeed, newDistance) => {
				speed = newSpeed;
				distance = newDistance;
			});

			stopAnimation = scene.stopAnimation;

			clearInterval(progressInterval);
			loadingProgress = 100;

			// Pequeno delay para o usuário ver 100%
			await new Promise(r => setTimeout(r, 500));

			state = 'game';
		} catch (err) {
			console.error('Erro ao iniciar cena:', err);
			clearInterval(progressInterval);
			state = 'menu';
		}
	}

	async function openInfo() {
		showInfo = true;
	}

	function closeInfo() {
		showInfo = false;
	}

	function goToMenu() {
		stopAnimation?.();
		isPaused = false;
		state = 'menu';
	}

	onDestroy(() => {
		stopAnimation?.();
	});
</script>

<!-- MENU -->
{#if state === 'menu'}
	<div class="menu-overlay">
		<div class="menu-bg">
			<div class="road-lines">
				{#each Array(8) as _, i}
					<div class="road-line" style="--i: {i}"></div>
				{/each}
			</div>
		</div>

		<div class="menu-content">
			<div class="title-block">
				<span class="title-label">caiovisuals apresenta</span>
				<h1 class="title-main">ROADS<span class="title-accent">VISUALS</span></h1>
				<p class="title-sub">MUNDO ABERTO — GUIADO PELA FÍSICA — FEITO POR UM BR</p>
			</div>

			
			<div class="buttons-menu">
				<button class="play-btn" on:click={startGame}>
					<span class="play-btn-text">JOGAR</span>
				</button>
				<button class="info-btn" on:click={openInfo}>
					<span class="info-btn-text">INFOS</span>
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- MODAL INFOS -->
<div class="info-backdrop {showInfo ? 'active' : ''}" on:click={closeInfo}>
	<div class="info-overlay">
		<div class="controls-hint">
			<h3 class="controls-title">Controles</h3>
			<div class="control-row">
				<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>
				<span>ou</span>
				<kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd>
				<span>Mover</span>
			</div>
			<div class="control-row">
				<kbd>ESPAÇO</kbd><span>Freio de mão</span>
			</div>
			<div class="control-row">
				<kbd>H</kbd><span>Faróis</span>
			</div>
		</div>
	</div>
</div>

<!-- LOADING -->
{#if state === 'loading'}
	<div class="loading-overlay">
		<div class="loading-content">
			<div class="loading-car">
				<div class="car-body"></div>
				<div class="car-wheel car-wheel--front"></div>
				<div class="car-wheel car-wheel--rear"></div>
			</div>

			<p class="loading-title">CARREGANDO O MUNDO</p>

			<div class="progress-track">
				<div class="progress-fill" style="width: {Math.min(loadingProgress, 100)}%"></div>
				<div class="progress-glow" style="left: {Math.min(loadingProgress, 100)}%"></div>
			</div>

			<span class="loading-pct">{Math.floor(Math.min(loadingProgress, 100))}%</span>
		</div>
	</div>
{/if}

<!-- CANVAS (sempre montado, mas invisível até o jogo iniciar) -->
<canvas
	bind:this={canvas}
	class="svelte-game"
	style:opacity={state === 'game' ? '1' : '0'}
	style:pointer-events={state === 'game' ? 'all' : 'none'}
	data-engine="three.js r155"
/>

<div class="canvas-overlay" />

<!-- HUD (só no jogo) -->
{#if state === 'game'}
	<div id="ui-fixed">
		<div class="speed">
			<h1>{(Math.abs(speed) * 3.6).toFixed(0)}</h1>
			<h2>KM POR HORA</h2>
		</div>
		<div class="distance">
			<h1>{Math.floor(distance / 1000)}</h1>
			<h2>QUILÔMETROS RODADOS</h2>
		</div>
	</div>
{/if}

<!-- PAUSE DO JOGO -->
{#if state === 'game' && isPaused}
	<div class="pause-overlay">
		<div class="pause-box">
			<h2>PAUSADO</h2>

			<button on:click={togglePause}>
				Continuar
			</button>

			<button on:click={goToMenu}>
				Menu Principal
			</button>
		</div>
	</div>
{/if}

<style>
/* ===== MENU ===== */
.menu-overlay {
	position: fixed;
	inset: 0;
	z-index: 100;
	background: #0a0a0a;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
}

.menu-overlay::after {
	content: '';
	position: absolute;
	inset: 0;
	background:
		radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, #0a0a0a 100%);
	pointer-events: none;
}

.menu-bg {
	position: absolute;
	inset: 0;
	overflow: hidden;
}

/* LINE ANIMTIONS */
.road-lines {
	position: absolute;
	bottom: 0;
	left: 50%;
	transform: translateX(-50%) perspective(600px) rotateX(65deg);
	width: 280px;
	height: 200%;
	display: flex;
	flex-direction: column;
	gap: 48px;
	animation: roadScroll 1.4s linear infinite;
}

.road-line {
	width: 12px;
	height: 60px;
	background: rgba(255, 15, 20, 0.22);
	border-radius: 2px;
	align-self: center;
}

@keyframes roadScroll {
	from { transform: translateX(-50%) perspective(600px) rotateX(65deg) translateY(0); }
	to   { transform: translateX(-50%) perspective(600px) rotateX(65deg) translateY(108px); }
}

.menu-content {
	position: relative;
	z-index: 2;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 4rem;
	text-align: center;
}

.title-block {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.4rem;
}

.title-label {
	font-family: 'Geologica', monospace;
	font-size: 0.9rem;
	letter-spacing: 0.25em;
	color: rgba(255,255,255,0.75);
	text-transform: uppercase;
}

.title-main {
	font-family: 'Geologica', serif;
	font-size: clamp(3rem, 9vw, 6rem);
	font-weight: 900;
	letter-spacing: -0.03em;
	color: #f5f0e8;
	line-height: 1;
	text-shadow: 0 0 50px rgba(245, 64, 30, 0.15);
}

.title-accent {
	color: #f70e0e;
}

.title-sub {
	font-family: 'Geologica', monospace;
	font-size: 0.9rem;
	letter-spacing: 0.3em;
	color: rgba(255,255,255,0.75);
	text-transform: uppercase;
	margin-top: 0.4rem;
}

/* Buttons Menu */
.buttons-menu {
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

/* Play button */
.play-btn {
	display: flex;
	align-items: center;
	gap: 1rem;
	background: #f70e0e;
	border: none;
	border-radius: 15px;
	padding: 1rem 6rem;
	cursor: pointer;
	transition: transform 0.3s ease, box-shadow 0.15s ease, background 0.15s ease;
	box-shadow: 0 0 0 0 rgba(250, 64, 32, 0.3);
}

.play-btn:hover {
	transform: scale(1.03);
	background: #9e0000;
	box-shadow: 0 0 32px rgba(250, 64, 32, 0.15);
}

.play-btn:active {
	transform: translateY(0) scale(0.98);
}

.play-btn-text {
	font-family: 'Geologica', serif;
	font-size: 1.2rem;
	font-weight: 700;
	letter-spacing: 0.15em;
	color: #0a0a0a;
}

/* Info button */
.info-btn {
	display: flex;
	align-items: center;
	gap: 1rem;
	background: #f70e0e;
	border: none;
	border-radius: 15px;
	padding: 1rem 6rem;
	cursor: pointer;
	transition: transform 0.3s ease, box-shadow 0.15s ease, background 0.15s ease;
	box-shadow: 0 0 0 0 rgba(250, 64, 32, 0.3);
}

.info-btn:hover {
	transform: scale(1.03);
	background: #9e0000;
	box-shadow: 0 0 32px rgba(250, 64, 32, 0.15);
}

.info-btn:active {
	transform: translateY(0) scale(0.98);
}

.info-btn-text {
	font-family: 'Geologica', serif;
	font-size: 1.2rem;
	font-weight: 700;
	letter-spacing: 0.15em;
	color: #0a0a0a;
}

/* ===== INFO-MODAL ===== */
.info-backdrop {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.6);
	backdrop-filter: blur(4px);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 150;
	opacity: 0;
	pointer-events: none;
	transition: opacity 0.18s ease;
}

.info-backdrop.active {
	opacity: 1;
	pointer-events: auto;
}

.info-overlay {
	position: absolute;
	background: #111;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 2rem;
	transform: scale(0.92);
	opacity: 0;
	transition: transform 0.18s ease, opacity 0.18s ease;
}

.info-backdrop.active .info-overlay {
	transform: scale(1);
	opacity: 1;
}

/* Controls */
.controls-hint {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	padding: 2rem 2.6rem;
}

.controls-title {
	text-align: text-center;
	font-family: 'Geologica', monospace;
	font-size: 2rem;
	color: rgba(255,255,255,1);
	margin-bottom: 0.4rem;
}

.control-row {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	font-family: 'Geologica', monospace;
	font-size: 0.75rem;
	color: rgba(255,255,255,0.7);
}

kbd {
	display: inline-block;
	background: rgba(255,255,255,0.08);
	border: 1px solid rgba(255,255,255,0.15);
	border-radius: 4px;
	padding: 3px 8px;
	font-family: 'Geologica', monospace;
	font-size: 0.7rem;
	color: rgba(255,255,255,0.75);
	line-height: 1.5;
}

/* ===== LOADING ===== */
.loading-overlay {
	position: fixed;
	inset: 0;
	z-index: 100;
	background: #0a0a0a;
	display: flex;
	align-items: center;
	justify-content: center;
}

.loading-overlay::after {
	content: '';
	position: absolute;
	inset: 0;
	background:
		radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, #0a0a0a 100%);
	pointer-events: none;
}

.loading-content {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 1.6rem;
	width: min(360px, 80vw);
}

/* Carrozinho animado */
.loading-car {
	position: relative;
	width: 80px;
	height: 32px;
}

.car-body {
	position: absolute;
	top: 0;
	left: 6px;
	right: 6px;
	height: 18px;
	background: #f70e0e;
	border-radius: 3px 3px 1px 1px;
}

.car-body::before {
	content: '';
	position: absolute;
	top: -9px;
	left: 12px;
	right: 12px;
	height: 10px;
	background: #f70e0e;
	border-radius: 3px 3px 0 0;
}

.car-wheel {
	position: absolute;
	bottom: 0;
	width: 14px;
	height: 14px;
	background: #222;
	border: 2px solid #555;
	border-radius: 50%;
	animation: wheelSpin 0.4s linear infinite;
}

@keyframes wheelSpin {
	from { transform: rotate(0deg); }
	to   { transform: rotate(360deg); }
}

.car-wheel--rear  { left: 8px; }
.car-wheel--front { right: 8px; }

.loading-title {
	font-family: 'Geologica', monospace;
	font-size: 0.7rem;
	letter-spacing: 0.3em;
	color: rgba(255,255,255,0.4);
	text-transform: uppercase;
}

.progress-track {
	position: relative;
	width: 100%;
	height: 3px;
	background: rgba(255,255,255,0.08);
	border-radius: 2px;
	overflow: visible;
}

.progress-fill {
	height: 100%;
	background: #f70e0e;
	border-radius: 2px;
	transition: width 0.15s ease;
}

.progress-glow {
	position: absolute;
	top: 50%;
	transform: translate(-50%, -50%);
	width: 12px;
	height: 12px;
	background: #f70e0e;
	border-radius: 50%;
	filter: blur(6px);
	opacity: 0.9;
	transition: left 0.15s ease;
}

.loading-pct {
	font-family: 'Geologica', monospace;
	font-size: 0.75rem;
	color: rgba(255,255,255,0.3);
	letter-spacing: 0.1em;
}

/* CANVAS */
.canvas-overlay {
	position: fixed;
	inset: 0;
	z-index: 10;
	background:
		radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, rgba(0,0,0,0.25) 100%);
	pointer-events: none;
}
</style>