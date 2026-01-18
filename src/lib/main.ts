import * as THREE from "three";

export async function initScene(canvas: HTMLCanvasElement, updateUI: (speed: number, distance: number) => void) {
	let gameTime = 0;
	const gameDayDuration = 6 * 15 * 15;
	const gravity = -9.81;

	let cameraAngleOffset = 0;
	let targetCameraAngleOffset = 0;
	const maxCameraOffsetAngle = Math.PI / 40;

	let isRain = false;
	let rainTimer = 0;
	let nextRainChange = 30 + Math.random() * 50;
	let rainStrength = 0;
	let rainSpeed = 25;

	let velocity = 0;
	let verticalVelocity = 0;
	let acceleration = 0;

	const mass = 1350;

	const gears = 6;
	const gearRatios = [3.6, 2.1, 1.3, 1.0, 0.8, 0.6];
	let currentGear = 0;
	
	const maxForwardSpeed = 70;
	const maxReverseSpeed = -15;
	const accelerationRate = 10;
	const dragCoeff = 0.32;  
	const brakeForce = 40;
	const steeringAngle = Math.PI * 2.2;
	const turnSpeed = 4.2;
	const drag = 5;
	const rollingResistance = 1.5;
	let steering = 0;

	let headlightsOn = true;
	
	const minTreeDistance = 12;

	let distanceTraveled = 0;
	let rotation = 0;
	let animationFrameId: number;

	const scene = new THREE.Scene();

	let lastTime = performance.now();
	const cameraTarget = new THREE.Object3D();
	scene.add(cameraTarget);

	const keys: Record<string, boolean> = {};

	// === FUNÇÃO PARA PEGAR HORÁRIO DE BRASÍLIA VIA API ===
		async function fetchBrasiliaTime(): Promise<number> {
			try {
			const response = await fetch("http://worldtimeapi.org/api/timezone/America/Sao_Paulo");
			const data = await response.json();
			const date = new Date(data.datetime);
			const totalSeconds = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
			return totalSeconds * 4;
			} catch (err) {
			console.error("Erro ao pegar hora de Brasília:", err);
			return 0;
			}
		}

		gameTime = await fetchBrasiliaTime() % gameDayDuration;

	// === CÉU ===
		const skyDayColor = new THREE.Color(0x87ceeb);
		const skySunsetColor = new THREE.Color(0xe5910b);

	// === CHUVA ===
		const rainCount = 90000;
		const rainGeometry = new THREE.BufferGeometry();
		const rainPositions = new Float32Array(rainCount * 3);

		const rainArea = 1100;
		const rainHeight = 150;

		const rainSpeeds = new Float32Array(rainCount);

		const colors = new Float32Array(rainCount * 4);

		for (let i = 0; i < rainCount; i++) {
			rainPositions[i * 3] = Math.random() * rainArea - rainArea / 2;
			rainPositions[i * 3 + 1] = Math.random() * rainHeight;
			rainPositions[i * 3 + 2] = Math.random() * rainArea - rainArea / 2;

    		colors[i * 4] = 0.666;
    		colors[i * 4 + 1] = 0.666;
    		colors[i * 4 + 2] = 0.666;
    		colors[i * 4 + 3] = 0.35 + Math.random() * 0.1;
		}

		rainGeometry.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
		rainGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 4));

		const rainMaterial = new THREE.PointsMaterial({
			color: 0xaaaaaa,
			size: 0.1,
			transparent: true,
			vertexColors: true,
			sizeAttenuation: true,
		});

		const rain = new THREE.Points(rainGeometry, rainMaterial);
		scene.add(rain);

		function updateRain(delta: number) {
			rainTimer += delta;

			if (rainTimer >= nextRainChange) {
				isRain = !isRain;
				rainTimer = 0;
				nextRainChange = 15 + Math.random() * 25;
			}

			if (isRain) {
				rainStrength = Math.min(rainStrength + delta * 0.15, 1);
			} else {
				rainStrength = Math.max(rainStrength - delta * 0.15, 0);
			}

			const positions = rainGeometry.attributes.position as THREE.BufferAttribute;

			for (let i = 0; i < rainCount; i++) {
				// movimento da gota
				positions.array[i * 3 + 1] -= rainSpeeds[i] * rainStrength * delta;

				// se cair abaixo do chão, reseta
				if (positions.array[i * 3 + 1] < 0) {
				positions.array[i * 3 + 1] = rainHeight;

				// centraliza no carro
				positions.array[i * 3] = car.position.x + (Math.random() * rainArea - rainArea / 2);
				positions.array[i * 3 + 2] = car.position.z + (Math.random() * rainArea - rainArea / 2);
				}
			}

			positions.needsUpdate = true;
			rain.visible = rainStrength > 0.05;
		}

	// === CÂMERA E RENDERER ===
		const minCameraDistance = 7;
		const maxCameraDistance = 7.6;

		const minCameraFov = 75;
		const maxCameraFov = 82;
		
		let currentCameraDistance = minCameraDistance;

		let currentCameraFov = minCameraFov;

		const camera = new THREE.PerspectiveCamera(currentCameraFov, window.innerWidth / window.innerHeight, 0.1, 1000);
		const renderer = new THREE.WebGLRenderer({ canvas });
		renderer.setSize(window.innerWidth, window.innerHeight);
	
	// === SOMBRAS ===
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	
	// === ILUMINAÇÃO ===
		const ambientLight = new THREE.AmbientLight(0xffffff, 1);
		scene.add(ambientLight);
		
		const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
		directionalLight.position.set(500, 500, 500);
		directionalLight.castShadow = true;

		directionalLight.shadow.mapSize.width = 16384;
		directionalLight.shadow.mapSize.height = 16384;
		directionalLight.shadow.camera.near = 0.5;
		directionalLight.shadow.camera.far = 2000;
		directionalLight.shadow.camera.left = -600;
		directionalLight.shadow.camera.right = 600;
		directionalLight.shadow.camera.top = 600;
		directionalLight.shadow.camera.bottom = -600;

		scene.add(directionalLight);

	// === CARRO ===
		// === MATERIAIS ===
		const carMaterial = new THREE.MeshStandardMaterial({ 
			color: 0xff0000,
			roughness: 0.25,
		});
		const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
		const rearLightMaterial = new THREE.MeshStandardMaterial({
			color: 0xFF0000,
		});
		const headLightMaterial = new THREE.MeshStandardMaterial({
			color: 0xFFFFFF,
		});

		// === CORPO DE BAIXO ===
		const carDownGeometry = new THREE.BoxGeometry(2, 0.75, 4.5);
		const carDownMesh = new THREE.Mesh(carDownGeometry, carMaterial);
		carDownMesh.castShadow = true;
		carDownMesh.receiveShadow = true;
		carDownMesh.position.y = 0.40;

		// === CORPO DE CIMA ===
		const carTopGeometry = new THREE.BoxGeometry(2, 0.75, 3.2);
		const carTopMesh = new THREE.Mesh(carTopGeometry, carMaterial);

		const positions = carTopGeometry.attributes.position;
		const vertex = new THREE.Vector3();

		for (let i = 0; i < positions.count; i++) {
			vertex.fromBufferAttribute(positions, i);
			if (vertex.y > 0) {
				vertex.x *= 0.75;
				vertex.z *= 0.55;
			}
			positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
		}

		carTopGeometry.computeVertexNormals();

		carTopMesh.castShadow = true;
		carTopMesh.receiveShadow = true;
		carTopMesh.position.y = 1.15;
		carTopMesh.position.z = 0.12;

		// === RODAS ===
		const wheelGeometry = new THREE.CylinderGeometry(0.43, 0.43, 0.225, 32);
			// RODAS TRASEIRAS
			function createRearWheel(x: number, z: number) {
				const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
				wheel.rotation.z = Math.PI / 2;
				wheel.position.set(x, 0, z);

				wheel.castShadow = true;
				wheel.receiveShadow = true;

				return wheel;
			}
			// RODAS DIANTEIRAS
			function createFrontWheel(x: number, z: number) {
				const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
				wheel.rotation.z = Math.PI / 2;
				
				wheel.castShadow = true;
				wheel.receiveShadow = true;

				const wheelGroup = new THREE.Group();
				wheelGroup.position.set(x, 0, z);
				wheelGroup.add(wheel);

				(wheelGroup as any).wheelMesh = wheel;

				return wheelGroup;
			}

		const rearRightWheel = createRearWheel(0.95, 1.5);
		const rearLeftWheel = createRearWheel(-0.95, 1.5);
		const frontRightWheel = createFrontWheel(0.95, -1.5);
		const frontLeftWheel = createFrontWheel(-0.95, -1.5);

		// === FAROIS ===
			// FAROIS TRASEIROS
			const rearlightGeometry = new THREE.BoxGeometry(0.3, 0.1, 0.15);

			function createRearLight(x: number, y: number, z: number) {
				const rearLight = new THREE.Mesh(rearlightGeometry, rearLightMaterial);
				rearLight.rotation.x = Math.PI / 2;
				rearLight.position.set(x, y, z);
				return rearLight;
			}

			const rearLightRight = createRearLight(0.75, 0.60, 2.25);
			const rearLightLeft = createRearLight(-0.75, 0.60, 2.25);
			// FAROIS DIANTEIROS

			const headlightGeometry = new THREE.BoxGeometry(0.4, 0.25, 0.15);

			function createHeadLight(x: number, y: number, z: number) {
				const headLight = new THREE.Mesh(headlightGeometry, headLightMaterial);
				headLight.rotation.x = Math.PI / 2;
				headLight.position.set(x, y, z);
				return headLight;
			}

			const headLightRight = createHeadLight(0.82, 0.60, -2.18);
			const headLightLeft = createHeadLight(-0.82, 0.60, -2.18);

		// === RETROVISORES ===
		const mirrorGeometry = new THREE.BoxGeometry(0.4, 0.18, 0.05);

		function createMirror(x: number, y: number, z: number) {
			const mirror = new THREE.Mesh(mirrorGeometry, carMaterial);
			mirror.position.set(x, y, z);
			mirror.castShadow = true;
			mirror.receiveShadow = true;
			return mirror;
		}

		const rightMirror1 = createMirror(1.1, 0.90, -1);
		const leftMirror1 = createMirror(-1.1, 0.90, -1);

		// === AGRUPANDO O CARRO ===
		const car = new THREE.Group();
		car.add(carTopMesh, carDownMesh, frontRightWheel, frontLeftWheel, rearRightWheel, rearLeftWheel, rearLightRight, rearLightLeft, headLightRight, headLightLeft, rightMirror1, leftMirror1);
		scene.add(car);

	// === ARVÓRES ===
		const placedTrees: { x: number; z: number }[] = [];
		const treeBoxes: THREE.Box3[] = [];

		function createTree(x: number, z: number) {
			const tree = new THREE.Group();

			// TRONCO
			const trunkGeo = new THREE.CylinderGeometry(0.1, 0.1, 2.5);
			const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
			const trunk = new THREE.Mesh(trunkGeo, trunkMat);
			trunk.castShadow = true;
			trunk.receiveShadow = true;
			trunk.position.y = 0;
			tree.add(trunk);

			// FOLHAGEM
			const base = getRandomInRange(0.5, 0.6);
			const height = getRandomInRange(2, 2.2);
			const leavesGeo = new THREE.ConeGeometry(base, height, 64);
			const leavesColor = getRandomLeavesColor();
			const leavesMat = new THREE.MeshStandardMaterial({ color: leavesColor });
			const leaves = new THREE.Mesh(leavesGeo, leavesMat);
			leaves.castShadow = true;
			leaves.receiveShadow = true;
			leaves.position.y = 1 + Math.random() * 1.1;
			tree.add(leaves);

			tree.position.set(x, 0, z);
			placedTrees.push({ x, z });
			treeBoxes.push(new THREE.Box3().setFromObject(tree));
			return tree;
		}
	
		function getRandomLeavesColor(): THREE.Color {
			const r = getRandomInRange(0.1, 0.2);
			const g = getRandomInRange(0.6, 0.9);
			const b = getRandomInRange(0.1, 0.2);

			return new THREE.Color(r, g, b);
		}

		function getRandomInRange(min: number, max: number): number {
			return Math.random() * (max - min) + min;
		}

		function getRandomPosition(min: number, max: number) {
			return Math.random() * (max - min) + min;
		}

		function isFarFromCar(x: number, z: number, carX = 0, carZ = 0, minDistance = 25) {
			const dx = x - carX;
			const dz = z - carZ;
			const distance = Math.sqrt(dx * dx + dz * dz);
			return distance >= minDistance;
		}

		const minTrees = 750;
		const maxTrees = 1200;
		const numberOfTrees = Math.floor(Math.random() * (maxTrees - minTrees + 1)) + minTrees;

		const posMin = -500;
		const posMax = 500;
		let treesCount = 0;

		function isFarFromOtherTrees(x: number, z: number, minDistance = minTreeDistance) {
			for (const tree of placedTrees) {
				const dx = x - tree.x;
				const dz = z - tree.z;
				const distance = Math.sqrt(dx * dx + dz * dz);
				if (distance < minDistance) return false;
			}
			return true;
		}

		let attempts = 0;
		const maxAttempts = numberOfTrees * 10;

		while (treesCount < numberOfTrees && attempts < maxAttempts) {
			attempts++;
			const x = getRandomPosition(posMin, posMax);
			const z = getRandomPosition(posMin, posMax);

			if (isFarFromCar(x, z) && isFarFromOtherTrees(x, z, minTreeDistance)) {
				const tree = createTree(x, z);
				scene.add(tree);
				placedTrees.push({ x, z });
				treeBoxes.push(new THREE.Box3().setFromObject(tree));
				treesCount++;
			}
		}

	// ===== CHÃO =====
		const planeGeometry = new THREE.PlaneGeometry(1000, 1000);
		const textureLoader = new THREE.TextureLoader();

		const planeMaterial = new THREE.MeshStandardMaterial({ color: 0xA39A6D });
		const plane = new THREE.Mesh(planeGeometry, planeMaterial);

		plane.rotation.x = -Math.PI / 2;
		plane.position.y = -0.25;
		plane.receiveShadow = true;
		scene.add(plane);

	function animate(time: number) {
		const delta = (time - lastTime) / 1000;
		lastTime = time;

		gameTime += delta;
		if (gameTime > gameDayDuration) gameTime -= gameDayDuration;

		// ===== CÉU =====
		const timeRatio = gameTime / gameDayDuration;
		const skyColor = skyDayColor.clone().lerp(skySunsetColor, Math.sin(timeRatio * Math.PI));
		scene.background = skyColor;

		// ===== CHUVA =====
		updateRain(delta);

		// ===== LUZ AMBIENTE VARIÁVEL =====
		const ambientIntensity = THREE.MathUtils.lerp(1, 0.8, Math.sin(timeRatio * Math.PI));
		ambientLight.intensity = ambientIntensity;

		const directionalIntensity = THREE.MathUtils.lerp(1, 0.55, Math.sin(timeRatio * Math.PI));
		directionalLight.intensity = directionalIntensity;

		// ===== GRAVIDADE =====
		const carBottomY = 0.55 - 0.375;
		const groundY = 0;

		verticalVelocity += gravity * delta;
		car.position.y += verticalVelocity * delta;

		if (car.position.y - carBottomY <= groundY) {
			car.position.y = groundY + carBottomY;
			verticalVelocity = 0;
		}

		// ===== CONTROLES =====
		let throttle = 0;
		let brake = 0;
		let handBrake = keys[" "] ? 1 : 0;

		if (keys["w"] || keys["arrowup"]) throttle = 1;
		if (keys["s"] || keys["arrowdown"]) {
			if (velocity > 0.5) {
				brake = 1;
			} else {
				throttle = -1;
			}
		}

		// ===== FORÇAS =====
			// Força de tração (F = m * a)
			const engineForce = throttle * accelerationRate * mass;
			const brakeForceTotal = brake * brakeForce * mass + handBrake * brakeForce * 1.5 * mass;
			const airResistance = drag * velocity * Math.abs(velocity);
			const rolling = rollingResistance * velocity;
			const netForce = engineForce - brakeForceTotal * Math.sign(velocity) - airResistance - rolling;
			const netAcceleration = netForce / mass;
			velocity += netAcceleration * delta;

			// Limites de velocidade
			if (velocity > maxForwardSpeed) velocity = maxForwardSpeed;
			if (velocity < maxReverseSpeed) velocity = maxReverseSpeed;

			// Se a velocidade for muito baixa, zera (evita drift infinito)
			if (Math.abs(velocity) < 0.08 && throttle === 0 && brake === 0 && handBrake === 0) {
				velocity = 0;
			}

		// ===== DIREÇÃO =====
		if (Math.abs(velocity) > 0.2) {
			if (keys["a"] || keys["arrowleft"]) {
				steering = Math.min(steering + turnSpeed * delta, 1);
			} else if (keys["d"] || keys["arrowright"]) {
				steering = Math.max(steering - turnSpeed * delta, -1);
			} else {
				// retorno natural do volante
				steering *= 0.9;
			}
		} else {
			steering *= 0.8;
		}

		// Rotação do carro
		const turn = steering * steeringAngle * (velocity / maxForwardSpeed);
		car.rotation.y += turn * delta;

		// Rotaciona rodas dianteiras
		const maxWheelSteering = Math.PI / 15;

		// Rotaciona apenas as rodas dianteiras conforme o steering
		(frontLeftWheel as any).wheelMesh.rotation.y = steering * maxWheelSteering;
		(frontRightWheel as any).wheelMesh.rotation.y = steering * maxWheelSteering;

		// Rodas traseiras ficam fixas
		rearLeftWheel.rotation.y = 0;
		rearRightWheel.rotation.y = 0;

		// ===== Luzes traseiras =====
		const brakingOrReversing = brake > 0 || handBrake > 0 || throttle < 0;

		const rearLightMaterialRight = rearLightRight.material as THREE.MeshStandardMaterial;
		const rearLightMaterialLeft = rearLightLeft.material as THREE.MeshStandardMaterial;

		if (brakingOrReversing) {
			rearLightMaterialRight.color.set(0xA00000);
			rearLightMaterialLeft.color.set(0xA00000);

			rearLightMaterialRight.emissive.set(0xFF0000);
			rearLightMaterialRight.emissiveIntensity = 1.5;

			rearLightMaterialLeft.emissive.set(0xFF0000);
			rearLightMaterialLeft.emissiveIntensity = 1.5;
		} else {
			rearLightMaterialRight.color.set(0x440000);
			rearLightMaterialLeft.color.set(0x440000);

			rearLightMaterialRight.emissive.set(0x000000);
			rearLightMaterialLeft.emissive.set(0x000000);
		}

		const headLightMaterialRight = headLightRight.material as THREE.MeshStandardMaterial;
		const headLightMaterialLeft = headLightLeft.material as THREE.MeshStandardMaterial;

		if (headlightsOn) {
			headLightMaterialRight.color.set(0xFFFFFF);
			headLightMaterialLeft.color.set(0xFFFFFF);
			headLightMaterialRight.emissive.set(0xFFFFFF);
			headLightMaterialRight.emissiveIntensity = 1;
			headLightMaterialLeft.emissive.set(0xFFFFFF);
			headLightMaterialLeft.emissiveIntensity = 1;
		} else {
			headLightMaterialRight.color.set(0x7F7F7F);
			headLightMaterialLeft.color.set(0x7F7F7F);
			headLightMaterialRight.emissive.set(0x000000);
			headLightMaterialRight.emissiveIntensity = 0;
			headLightMaterialLeft.emissive.set(0x000000);
			headLightMaterialLeft.emissiveIntensity = 0;
		}

		// ===== MOVIMENTO =====
		const forward = new THREE.Vector3(0, 0, -1).applyEuler(car.rotation).normalize();
		const moveDistance = velocity * delta;
		car.position.add(forward.multiplyScalar(moveDistance));

		// Distância total
		distanceTraveled += Math.abs(moveDistance);

		const mapLimit = 500;
		if (Math.abs(car.position.x) > mapLimit) { car.position.x = Math.sign(car.position.x) * mapLimit; velocity = 0; }
		if (Math.abs(car.position.z) > mapLimit) { car.position.z = Math.sign(car.position.z) * mapLimit; velocity = 0; }

		// ===== CÂMERA =====
		if (keys["a"] || keys["arrowleft"]) {
			targetCameraAngleOffset = maxCameraOffsetAngle;
		} else if (keys["d"] || keys["arrowright"]) {
			targetCameraAngleOffset = -maxCameraOffsetAngle;
		} else {
			targetCameraAngleOffset = 0;
		}

		cameraAngleOffset += (targetCameraAngleOffset - cameraAngleOffset) * 4 * delta;

		const speedRatio = Math.min(Math.abs(velocity) / maxForwardSpeed, 1);
		
    	const targetCameraDistance = THREE.MathUtils.lerp(minCameraDistance, maxCameraDistance, speedRatio);
		currentCameraDistance += (targetCameraDistance - currentCameraDistance) * 2 * delta;

		const targetCameraFov = THREE.MathUtils.lerp(minCameraFov, maxCameraFov, speedRatio);
		currentCameraFov += (targetCameraFov - currentCameraFov) * 2 * delta;
		camera.fov = currentCameraFov;
		camera.updateProjectionMatrix();

		const baseOffset = new THREE.Vector3(0, 3, currentCameraDistance);
		const rotatedOffset = baseOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraAngleOffset);
		const cameraOffset = rotatedOffset.applyEuler(car.rotation);

		camera.position.copy(car.position).add(cameraOffset);
		cameraTarget.position.copy(car.position).setY(car.position.y + 1);
		camera.lookAt(cameraTarget.position);

		// ===== RENDER =====
		updateUI(velocity, distanceTraveled);
		renderer.render(scene, camera);
		animationFrameId = requestAnimationFrame(animate);
	}

	function onKeyDown(event: KeyboardEvent) {
		keys[event.key.toLowerCase()] = true;
		const key = event.key.toLowerCase();

		if (key === "h") {
			headlightsOn = !headlightsOn;
		} else {
			keys[key] = true;
		}
	}

	function onKeyUp(event: KeyboardEvent) {
		keys[event.key.toLowerCase()] = false;
	}

	window.addEventListener("keydown", onKeyDown);
	window.addEventListener("keyup", onKeyUp);

	window.addEventListener("resize", () => {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(window.innerWidth, window.innerHeight);
	});

	animationFrameId = requestAnimationFrame(animate);

	function cleanup() {
		cancelAnimationFrame(animationFrameId);
		window.removeEventListener("keydown", onKeyDown);
		window.removeEventListener("keyup", onKeyUp);
	}

	return {
		stopAnimation: () => cancelAnimationFrame(animationFrameId),
		cleanup,
	};
}
