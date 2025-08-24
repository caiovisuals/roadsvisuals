<script lang="ts">
	import '../global.css';
	import { onMount } from 'svelte';
	import { initScene } from '$lib/main';

	let canvas: HTMLCanvasElement;
	let speed = 0;
	let distance = 0;

	onMount(() => {
		const { stopAnimation } = initScene(canvas, (newSpeed, newDistance) => {
			speed = newSpeed;
			distance = newDistance;
		});

		return () => {
			stopAnimation();
		};
	});
</script>

<div id="ui-fixed">
	<div class="speed">
		<h1>{(Math.abs(speed) * 3.6).toFixed(0)}</h1>
		<h2>KM POR HORA</h2>
	</div>
	<div class="distance">
		<h1>{Math.floor(distance)}</h1>
		<h2>QUILÔMETROS RODADOS</h2>
	</div>
</div>

<canvas bind:this={canvas} class="svelte-game" data-engine="three.js r155" />
