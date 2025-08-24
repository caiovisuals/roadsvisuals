import * as THREE from "three";

export function initScene(canvas: HTMLCanvasElement, updateUI: (speed: number, distance: number) => void) {
	let gameTime = 0;
	const gameDayDuration = 12 * 30 * 30;
	const gravity = -9.81;

	let cameraAngleOffset = 0;
	let targetCameraAngleOffset = 0;
	const maxCameraOffsetAngle = Math.PI / 40;

	let isRain = false;
	let rainIntensity = 0;

	let velocity = 0;
	let verticalVelocity = 0;
	let acceleration = 0;
	const mass = 1350;
	const gears = 6;
	let currentGear = 0;
	const maxForwardSpeed = 70;
	const maxReverseSpeed = -15;
	const accelerationRate = 10;
	const brakeForce = 40;
	const steeringAngle = Math.PI * 2.2;
	const turnSpeed = 4.2;
	const drag = 5;
	const rollingResistance = 1.5;
	let steering = 0;
	
	const minTreeDistance = 12;

	let distanceTraveled = 0;
	let rotation = 0;
	let animationFrameId: number;

	const scene = new THREE.Scene();

	// === CÉU ===
	const skyDayColor = new THREE.Color(0x87ceeb);
	const skySunsetColor = new THREE.Color(0xffa50c)

	const timeRatio = gameTime / gameDayDuration;
	const skyColor = skyDayColor.clone().lerp(skySunsetColor, Math.sin(timeRatio * Math.PI));
	scene.background = skyColor;

	// === CHUVA ===
	const rainCount = 1000;
	const rainGeometry = new THREE.BufferGeometry();
	const rainPositions = new Float32Array(rainCount * 3);

	for (let i = 0; i < rainCount; i++) {
		rainPositions[i * 3] = Math.random() * 1000 - 500;
		rainPositions[i * 3 + 1] = Math.random() * 200 + 20;
		rainPositions[i * 3 + 2] = Math.random() * 1000 - 500;
	}

	rainGeometry.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));

	const rainMaterial = new THREE.PointsMaterial({
		color: 0xaaaaaa,
		size: 0.1,
		transparent: true,
		opacity: 0.45,
	});
	
	const rain = new THREE.Points(rainGeometry, rainMaterial);
	scene.add(rain);

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
		const headLightMaterial = new THREE.MeshStandardMaterial({
			color: 0xFF0000,
		});

		// === CORPO BAIXO ===
		const carDownGeometry = new THREE.BoxGeometry(2, 0.75, 4.5);
		const carDownMesh = new THREE.Mesh(carDownGeometry, carMaterial);
		carDownMesh.castShadow = true;
		carDownMesh.receiveShadow = true;
		carDownMesh.position.y = 0.40;

		// === CORPO CIMA ===
		const carTopGeometry = new THREE.BoxGeometry(2, 0.75, 3);
		const carTopMesh = new THREE.Mesh(carTopGeometry, carMaterial);
		carTopMesh.castShadow = true;
		carTopMesh.receiveShadow = true;
		carTopMesh.position.y = 1.15;
		carTopMesh.position.z = 0.2;

		// === RODAS ===
		const wheelGeometry = new THREE.CylinderGeometry(0.43, 0.43, 0.225, 32);
		
		// Rodas traseiras
		function createRearWheel(x: number, z: number) {
			const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
			wheel.rotation.z = Math.PI / 2;
			wheel.position.set(x, 0, z);

			wheel.castShadow = true;
			wheel.receiveShadow = true;

			return wheel;
		}

		// Rodas dianteiras
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

		// == FAROIS ===
		const headlightGeometry = new THREE.BoxGeometry(0.3, 0.1, 0.15);

		function createHeadLight(x: number, y: number, z: number) {
			const headLight = new THREE.Mesh(headlightGeometry, headLightMaterial);
			headLight.rotation.x = Math.PI / 2;
			headLight.position.set(x, y, z);
			return headLight;
		}

		const rearLightRight = createHeadLight(0.75, 0.65, 2.25);
		const rearLightLeft = createHeadLight(-0.75, 0.65, 2.25);

		// === AGRUPANDO O CARRO ===
		const car = new THREE.Group();
		car.add(carTopMesh, carDownMesh, frontRightWheel, frontLeftWheel, rearRightWheel, rearLeftWheel, rearLightRight, rearLightLeft);
		scene.add(car);

	// === ARVÓRE ===
	function createTree(x: number, z: number) {
		const tree = new THREE.Group();

		// Tronco
		const trunkGeo = new THREE.CylinderGeometry(0.1, 0.1, 2.5);
		const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
		const trunk = new THREE.Mesh(trunkGeo, trunkMat);
		trunk.castShadow = true;
		trunk.receiveShadow = true;
		trunk.position.y = 0;
		tree.add(trunk);

		// Folhagem
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

	const placedTrees: { x: number; z: number }[] = [];

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

	const keys: Record<string, boolean> = {};

	let lastTime = performance.now();
	const rotationSpeed = Math.PI;

	const cameraTarget = new THREE.Object3D();
	scene.add(cameraTarget);

	function animate(time: number) {
		const delta = (time - lastTime) / 1000;
		lastTime = time;

		gameTime += delta;
		if (gameTime > gameDayDuration) gameTime -= gameDayDuration;

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

		if (keys["w"] || keys["arrowup"]) throttle = 1;
		if (keys["s"] || keys["arrowdown"]) {
			if (velocity > 0.5) {
				brake = 1;
			} else {
				throttle = -1;
			}
		}

		// Freio de mão
		let handBrake = keys[" "] ? 1 : 0;

		// ===== FORÇAS =====
			// Força de tração (F = m * a)
			const engineForce = throttle * accelerationRate * mass;

			// Força de frenagem (considera freio normal + freio de mão)
			const brakeForceTotal = brake * brakeForce * mass + handBrake * brakeForce * 1.5 * mass;

			// Resistência do ar (quadrática na velocidade)
			const airResistance = drag * velocity * Math.abs(velocity);

			// Atrito de rolamento (sempre contrário ao movimento)
			const rolling = rollingResistance * velocity;

			// Força resultante
			const netForce = engineForce - brakeForceTotal * Math.sign(velocity) - airResistance - rolling;

			// Aceleração final (F = m*a)
			const netAcceleration = netForce / mass;

			// Atualiza velocidade
			velocity += netAcceleration * delta;

			// Limites de velocidade
			if (velocity > maxForwardSpeed) velocity = maxForwardSpeed;
			if (velocity < maxReverseSpeed) velocity = maxReverseSpeed;

			// Se a velocidade for muito baixa, zera (evita drift infinito)
			if (Math.abs(velocity) < 0.05 && throttle === 0 && brake === 0 && handBrake === 0) {
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

		// ===== MOVIMENTO =====
		const forward = new THREE.Vector3(0, 0, -1).applyEuler(car.rotation).normalize();
		const moveDistance = velocity * delta;
		car.position.add(forward.multiplyScalar(moveDistance));

		// Distância total
		distanceTraveled += Math.abs(moveDistance);

		const mapLimit = 500;
		if (Math.abs(car.position.x) > mapLimit) car.position.x = Math.sign(car.position.x) * mapLimit;
		if (Math.abs(car.position.z) > mapLimit) car.position.z = Math.sign(car.position.z) * mapLimit;

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
