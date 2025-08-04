import * as THREE from "three";

export function initScene(canvas: HTMLCanvasElement, updateUI: (speed: number, distance: number) => void) {
	let velocity = 0;
	const speedKmH = velocity * 3.6;
	let acceleration = 0;
	const mass = 1350;
	const maxForwardSpeed = 70;
	const maxReverseSpeed = -15;
	const accelerationRate = 50;
	const brakeForce = 40;
	const steeringAngle = Math.PI * 3;
	const turnSpeed = 4.5;
	const drag = 5;
	const rollingResistance = 1.5;
	let steering = 0;

	let cameraAngleOffset = 0;
	let targetCameraAngleOffset = 0;
	const maxCameraOffsetAngle = Math.PI / 50;

	let distance = 0;
	let rotation = 0;
	let animationFrameId: number;

	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0x87ceeb);

	// === ILUMINAÇÃO ===
	const ambientLight = new THREE.AmbientLight(0xffffff, 1);
	scene.add(ambientLight);

	const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
	directionalLight.position.set(10, 10, 10);
	scene.add(directionalLight);

	// === CÂMERA E RENDERER ===
	const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
	const renderer = new THREE.WebGLRenderer({ canvas });
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;

	// === MATERIAIS ===
	const carMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
	const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });

	// === CORPO ===
	const carGeometry = new THREE.BoxGeometry(2, 1.5, 4.5);
	const carMesh = new THREE.Mesh(carGeometry, carMaterial);
	carMesh.position.y = 1;

	// === RODAS ===
	const wheelGeometry = new THREE.CylinderGeometry(0.43, 0.43, 0.225, 32);
	function createWheel(x: number, z: number) {
		const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
		wheel.rotation.z = Math.PI / 2;
		wheel.position.set(x, 0.2, z);
		return wheel;
	}

	// === AGRUPANDO O CARRO ===
	const car = new THREE.Group();
	car.add(carMesh);
	car.add(createWheel(0.95, 1.5));   // frente direita
	car.add(createWheel(-0.95, 1.5));  // frente esquerda
	car.add(createWheel(0.95, -1.5));  // traseira direita
	car.add(createWheel(-0.95, -1.5));
	car.position.x = -5;
	scene.add(car);

	function createTree(x: number, z: number) {
		const tree = new THREE.Group();

		// Tronco
		const trunkGeo = new THREE.CylinderGeometry(0.1, 0.1, 2.5);
		const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
		const trunk = new THREE.Mesh(trunkGeo, trunkMat);
		trunk.position.y = 0;
		tree.add(trunk);

		// Folhagem
		const leavesGeo = new THREE.ConeGeometry(0.5, 2, 8);
		const leavesColor = getRandomLeavesColor();
		const leavesMat = new THREE.MeshStandardMaterial({ color: leavesColor });
		const leaves = new THREE.Mesh(leavesGeo, leavesMat);
		leaves.position.y = 1 + Math.random() * 1.2;
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

	const maxTrees = 100;
	const numberOfTrees = Math.floor(Math.random() * maxTrees) + 1;

	const posMin = -100;
	const posMax = 100;
	let treesCount = 0;

	while (treesCount < numberOfTrees) {
		const x = getRandomPosition(posMin, posMax);
		const z = getRandomPosition(posMin, posMax);

		if (isFarFromCar(x, z)) {
			const tree = createTree(x, z);
			scene.add(tree);
			treesCount++;
		}
	}

	const planeGeometry = new THREE.PlaneGeometry(1000, 1000);
	const textureLoader = new THREE.TextureLoader();

	const planeMaterial = new THREE.MeshStandardMaterial({ color: 0xA39A6D });
	const plane = new THREE.Mesh(planeGeometry, planeMaterial);
	plane.rotation.x = -Math.PI / 2;
	plane.position.y = -0.25;
	scene.add(plane);

	const keys: Record<string, boolean> = {};

	let lastTime = performance.now();
	const rotationSpeed = Math.PI;

	const cameraTarget = new THREE.Object3D();
	scene.add(cameraTarget);

	function animate(time: number) {
		const delta = (time - lastTime) / 1000;
		lastTime = time;

		let isAccelerating = false;

		// Atualiza aceleração
		if (keys["w"] || keys["arrowup"]) {
			acceleration = accelerationRate;
		} else if (keys["s"] || keys["arrowdown"]) {
			acceleration = -brakeForce;
		} else {
			acceleration = 0;
		}

		const handBrakeForce = 10;
		if (keys[" "]) {
			const handBrakeDeceleration = -handBrakeForce * Math.sign(velocity);
			acceleration = handBrakeDeceleration;
			isAccelerating = true;
		}

		// Resistência do ar e atrito
		const resistance = drag * velocity + rollingResistance * Math.sign(velocity);
		const netAcceleration = acceleration - resistance;

		// Atualiza velocidade com limites
		velocity += netAcceleration * delta;
		if (velocity > maxForwardSpeed) velocity = maxForwardSpeed;
		if (velocity < maxReverseSpeed) velocity = maxReverseSpeed;

		if (Math.abs(velocity) < 0.01 && !isAccelerating) velocity = 0;

		// Atualiza direção
		if (Math.abs(velocity) > 0.5) {
			if (keys["a"] || keys["arrowleft"]) steering = Math.min(steering + turnSpeed * delta, 1);
			else if (keys["d"] || keys["arrowright"]) steering = Math.max(steering - turnSpeed * delta, -1);
			else steering *= 0.9; // retorno do volante
		} else {
			steering *= 0.8;
		}

		// Aplica rotação baseada na velocidade
		const turn = steering * steeringAngle * (velocity / maxForwardSpeed);
		car.rotation.y += turn * delta;

		// Move carro para frente baseado na rotação atual
		const forward = new THREE.Vector3(0, 0, -1).applyEuler(car.rotation).normalize();
		const moveDistance = velocity * delta;
		car.position.add(forward.multiplyScalar(moveDistance));

		distance += Math.abs(moveDistance);

		// Câmera em terceira pessoa
		if (keys["a"] || keys["arrowleft"]) {
			targetCameraAngleOffset = maxCameraOffsetAngle;
		} else if (keys["d"] || keys["arrowright"]) {
			targetCameraAngleOffset = -maxCameraOffsetAngle;
		} else {
			targetCameraAngleOffset = 0;
		}

		cameraAngleOffset += (targetCameraAngleOffset - cameraAngleOffset) * 4 * delta;

		const baseOffset = new THREE.Vector3(0, 3, 7);
		const rotatedOffset = baseOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraAngleOffset);
		const cameraOffset = rotatedOffset.applyEuler(car.rotation);

		camera.position.copy(car.position).add(cameraOffset);

		cameraTarget.position.copy(car.position);
		cameraTarget.position.y += 1;
		camera.lookAt(cameraTarget.position);

		updateUI(velocity, distance);
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
		stop,
		cleanup,
	};
}
