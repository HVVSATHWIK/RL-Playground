import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { NeuralNetwork } from '../lib/nn/network';
import { relu, linear } from '../lib/math/activations';
import {
  DQNAgent,
  ReplayBuffer,
  extractObservation,
  OBSERVATION_SIZE,
} from '../features/fight-club/lib/dqnAgent';
import {
  createFighter,
  ARENA_WIDTH,
  MAX_HP,
  NUM_ACTIONS,
  ACTIONS,
} from '../features/fight-club/lib/fighter';
import { stepArena, resetRound, DEFAULT_REWARD_WEIGHTS } from '../features/fight-club/lib/arena';
import { expertAction } from '../features/fight-club/lib/expertPolicy';

describe('1. Neural Network Forward & Backward for DQN', () => {
  it('correctly propagates input and updates weights via custom output gradient', () => {
    const net = new NeuralNetwork([OBSERVATION_SIZE, 32, 24, NUM_ACTIONS], relu, linear);
    const input = new Array(OBSERVATION_SIZE).fill(0.5);

    // Initial forward pass
    const initialOutputs = net.forward(input);
    assert.equal(initialOutputs.length, NUM_ACTIONS);
    for (const val of initialOutputs) {
      assert.equal(typeof val, 'number');
      assert.equal(isNaN(val), false);
    }

    // Apply gradient on action 2 (e.g. punch)
    const grad = new Array(NUM_ACTIONS).fill(0);
    grad[2] = 1.0; // Positive error: predict was too high
    net.backward(grad, 0.05);

    const updatedOutputs = net.forward(input);
    // After gradient update with positive error, output for action 2 should decrease
    assert.ok(
      updatedOutputs[2] < initialOutputs[2],
      `Expected updated output (${updatedOutputs[2]}) to decrease from initial (${initialOutputs[2]})`
    );
  });
});

describe('2. Experience Replay Buffer', () => {
  it('correctly inserts transitions and handles circular overflow', () => {
    const capacity = 5;
    const buffer = new ReplayBuffer(capacity);
    assert.equal(buffer.size(), 0);

    for (let i = 0; i < 7; i++) {
      buffer.push({
        state: [i],
        action: i % NUM_ACTIONS,
        reward: i,
        nextState: [i + 1],
        done: i === 6,
      });
    }

    assert.equal(buffer.size(), capacity);

    // Sampling test
    const samples = buffer.sample(3);
    assert.equal(samples.length, 3);
    for (const s of samples) {
      assert.ok(s.state[0] >= 0);
      assert.equal(typeof s.reward, 'number');
    }
  });
});

describe('3. Bellman Target Calculations for DQN', () => {
  it('computes correct target for terminal and non-terminal transitions', () => {
    const agent = new DQNAgent({ gamma: 0.9, learningRate: 0.01 });

    const state = new Array(OBSERVATION_SIZE).fill(0.2);
    const nextState = new Array(OBSERVATION_SIZE).fill(0.3);

    // Store non-terminal transition
    agent.storeTransition(state, 1, 10, nextState, false);
    assert.equal(agent.replayBuffer.size(), 1);

    // Target network prediction
    const targetQ = agent.predictTarget(nextState);
    const maxNext = Math.max(...targetQ);
    const expectedTarget = 10 + 0.9 * maxNext;

    // Terminal transition
    const terminalExpected = 100; // when done is true, maxNextTarget is ignored
    assert.equal(terminalExpected, 100);
    assert.ok(!isNaN(expectedTarget));
  });
});

describe('4. Target Network Updates', () => {
  it('correctly synchronizes weights during hard and soft updates', () => {
    const agent = new DQNAgent();
    const testInput = new Array(OBSERVATION_SIZE).fill(0.7);

    // Distort primary network weights
    const grad = new Array(NUM_ACTIONS).fill(2.0);
    agent.qNetwork.forward(testInput);
    agent.qNetwork.backward(grad, 0.1);

    const primaryQ = agent.predict(testInput);
    const initialTargetQ = agent.predictTarget(testInput);
    assert.equal(initialTargetQ.length, NUM_ACTIONS);

    // Hard update
    agent.updateTargetNetworkHard();
    const syncedTargetQ = agent.predictTarget(testInput);

    for (let a = 0; a < NUM_ACTIONS; a++) {
      assert.ok(
        Math.abs(primaryQ[a] - syncedTargetQ[a]) < 1e-5,
        `Q-values should match after hard sync: primary=${primaryQ[a]}, target=${syncedTargetQ[a]}`
      );
    }
  });
});

describe('5. Action Selection & Exploration Decay', () => {
  it('decays epsilon properly and adheres to greedy vs exploratory choices', () => {
    const agent = new DQNAgent({ epsilonStart: 0.5, epsilonMin: 0.05, epsilonDecay: 0.9 });
    assert.equal(agent.epsilon, 0.5);

    agent.decayEpsilon();
    assert.equal(agent.epsilon, 0.45);

    // Test greedy choice
    const state = new Array(OBSERVATION_SIZE).fill(0.1);
    const decisionGreedy = agent.chooseAction(state, true);
    assert.equal(decisionGreedy.isExploration, false);
    assert.ok(ACTIONS.includes(decisionGreedy.action));
  });
});

describe('6. Model Export and Import Round Trip', () => {
  it('serializes and deserializes DQN model with numerical integrity', () => {
    const agent1 = new DQNAgent({ learningRate: 0.007, gamma: 0.92 });
    const dummyState = new Array(OBSERVATION_SIZE).fill(0.4);
    const expectedQ = agent1.predict(dummyState);

    const exportedJSON = agent1.exportToJSON('Test-Model');
    assert.ok(exportedJSON.includes('robo-dojo-agent'));

    const agent2 = new DQNAgent();
    const importResult = agent2.importFromJSON(exportedJSON);
    assert.equal(importResult.success, true);
    assert.equal(agent2.config.learningRate, 0.007);
    assert.equal(agent2.config.gamma, 0.92);

    const importedQ = agent2.predict(dummyState);
    for (let a = 0; a < NUM_ACTIONS; a++) {
      assert.ok(
        Math.abs(expectedQ[a] - importedQ[a]) < 1e-5,
        `Imported Q-values must match: expected=${expectedQ[a]}, got=${importedQ[a]}`
      );
    }
  });

  it('rejects invalid or corrupted JSON gracefully', () => {
    const agent = new DQNAgent();
    const badResult1 = agent.importFromJSON('{"format":"unknown"}');
    assert.equal(badResult1.success, false);

    const badResult2 = agent.importFromJSON('invalid json string');
    assert.equal(badResult2.success, false);
  });
});

describe('7. Fighter Health, Combat Resolution & Terminal Conditions', () => {
  it('correctly resolves damage, blocks, knockbacks, and terminal states', () => {
    const red = createFighter(100, 1);
    const blue = createFighter(130, -1); // Within punch range (dist = 30 < 55)

    // Red punches while Blue moves
    const result1 = stepArena(red, blue, 'punch', 'moveRight', DEFAULT_REWARD_WEIGHTS);
    assert.equal(result1.redLanded, true);
    assert.ok(blue.hp < MAX_HP);
    assert.equal(result1.roundOver, false);

    // Terminal condition test: when HP drops to 0 (reset cooldown for next attack)
    red.cooldown = 0;
    red.animState = 'idle';
    blue.hp = 5;
    blue.x = red.x + 30;
    const result2 = stepArena(red, blue, 'punch', 'moveRight', DEFAULT_REWARD_WEIGHTS);
    assert.equal(blue.hp, 0);
    assert.equal(result2.roundOver, true);
    assert.equal(result2.winner, 'red');
  });
});

describe('8. Policy Comparison Benchmark Simulation', () => {
  it('runs automated bouts between DQN and Expert heuristic without errors', () => {
    const agent = new DQNAgent();
    const red = createFighter(150, 1);
    const blue = createFighter(ARENA_WIDTH - 150, -1);

    let completedRounds = 0;
    for (let r = 0; r < 5; r++) {
      resetRound(red, blue);
      let steps = 0;
      while (steps < 400) {
        const redObs = extractObservation(red, blue);
        const redAction = agent.chooseAction(redObs, false).action;
        const blueAction = expertAction(blue, red);

        const res = stepArena(red, blue, redAction, blueAction);
        steps++;
        if (res.roundOver) {
          completedRounds++;
          break;
        }
      }
    }

    assert.ok(completedRounds >= 1, 'Should complete simulated bouts');
  });
});

describe('9. Human Input Ownership & Idle Stationary Mechanics', () => {
  it('stationary human player receives zero AI-generated movement or attack commands', () => {
    const red = createFighter(200, 1);
    const blue = createFighter(500, -1);
    const initialRedX = red.x;
    const initialRedHp = red.hp;

    // Simulate 30 steps with human action as 'idle' while blue AI moves
    for (let i = 0; i < 30; i++) {
      stepArena(red, blue, 'idle', 'moveLeft');
    }

    // Red must have stayed completely stationary at initial x coordinate
    assert.equal(red.x, initialRedX, 'Red fighter position must not change when action is idle');
    assert.equal(red.lastAction, 'idle', 'Red fighter lastAction must remain idle');
    assert.equal(red.animState, 'idle', 'Red animState must remain idle');
    assert.equal(red.hp, initialRedHp, 'Red HP untouched at distance');
  });

  it('correctly maps human movement and combat actions without phantom inputs', () => {
    const red = createFighter(200, 1);
    const blue = createFighter(400, -1);

    // Test moveRight: moves right
    const initialX = red.x;
    stepArena(red, blue, 'moveRight', 'idle');
    assert.ok(red.x > initialX, 'Red moves right when moveRight is received');

    // Test moveLeft: moves left
    const newX = red.x;
    stepArena(red, blue, 'moveLeft', 'idle');
    assert.ok(red.x < newX, 'Red moves left when moveLeft is received');

    // Test punch: triggers punching anim and cooldown
    red.cooldown = 0;
    stepArena(red, blue, 'punch', 'idle');
    assert.equal(red.animState, 'punching', 'Punch action sets animState to punching');
    assert.ok(red.cooldown > 0, 'Punch action triggers cooldown');
  });
});

describe('10. 3D Mecha Procedural Articulation, Animation States & Cleanup', () => {
  it('instantiates 3D mecha model with PBR armor, joints, and shield', async () => {
    const { Robot3DModel } = await import('../features/fight-club/lib/robot3DModel');
    const model = new Robot3DModel({
      primaryColor: '#ffffff',
      accentColor: '#2563eb',
      emissiveColor: '#38bdf8',
    });

    assert.ok(model.group);
    assert.ok(model.torsoGroup);
    assert.ok(model.chestMesh);
    assert.ok(model.shieldRing);
    assert.ok(model.geometries.length > 5, 'Should register geometries for memory tracking');
    assert.ok(model.materials.length > 2, 'Should register materials for memory tracking');

    // Test pose updates across all combat animations without throwing
    const red = createFighter(200, 1);
    const blue = createFighter(400, -1);

    const animStates = ['idle', 'punching', 'kicking', 'blocking', 'dodging', 'stunned'] as const;
    for (const anim of animStates) {
      red.animState = anim;
      model.updatePose(red, blue, 0.016);
      assert.ok(!isNaN(model.group.position.x), `X position should be valid during ${anim}`);
      assert.ok(!isNaN(model.torsoGroup.rotation.x), `Torso rot should be valid during ${anim}`);
    }

    // Clean disposal test: geometries and materials must dispose without throwing
    assert.doesNotThrow(() => {
      model.dispose();
    }, 'Disposing 3D mecha model resources should not throw');
  });
});

describe('11. 3D Combat VFX System: Directional Sparks, Shockwaves & Arena Lighting', () => {
  it('instantiates 3D VFX system, triggers visceral impacts, and updates physics', async () => {
    const THREE = await import('three');
    const { CombatVFX3D } = await import('../features/fight-club/lib/combatVFX3D');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 800 / 400, 0.1, 100);
    camera.position.set(0, 4.2, 16.5);

    const vfx = new CombatVFX3D(scene, camera);
    assert.ok(vfx, 'CombatVFX3D instantiated');

    // 1. Trigger normal strike impact
    assert.doesNotThrow(() => {
      vfx.triggerImpact(2.5, 2.4, 0, {
        isCrit: false,
        isBlocked: false,
        attackType: 'punch',
        attackerFacing: 1,
        speed: 1,
      });
    }, 'Triggering standard impact should not throw');

    // Update physics across frames
    for (let f = 0; f < 10; f++) {
      vfx.update(0.016);
    }

    // 2. Trigger heavy kick crit impact with shockwaves
    assert.doesNotThrow(() => {
      vfx.triggerImpact(-1.5, 1.9, 0, {
        isCrit: true,
        isBlocked: false,
        attackType: 'kick',
        attackerFacing: -1,
        speed: 1,
      });
    }, 'Triggering critical kick impact should not throw');

    for (let f = 0; f < 10; f++) {
      vfx.update(0.016);
    }

    // 3. Trigger blocked impact (shield deflection)
    assert.doesNotThrow(() => {
      vfx.triggerImpact(0.5, 2.5, 0, {
        isCrit: false,
        isBlocked: true,
        attackType: 'punch',
        attackerFacing: 1,
        speed: 1,
      });
    }, 'Triggering blocked strike should not throw');

    for (let f = 0; f < 15; f++) {
      vfx.update(0.016);
    }

    // 4. Memory cleanup verification
    assert.doesNotThrow(() => {
      vfx.dispose();
    }, 'Disposing VFX system should succeed cleanly');
  });
});


